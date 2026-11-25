import crypto from 'node:crypto';

export const SESSION_COOKIE = 'manguare_session';
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
const MAP_TOKEN_TTL_MS = 30 * 60 * 1000;

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

/**
 * Autenticación mínima del panel, sin dependencias externas.
 *
 * Si no se configura `MANGUARE_PANEL_PASSWORD`, el panel queda en modo
 * demostración (sin login). Con contraseña, las sesiones viven en memoria y se
 * invalidan al reiniciar el servidor; es suficiente para un piloto y evita
 * añadir una base de datos solo para sesiones.
 */
export function createAuth({
  enabled = false,
  password = '',
  user = 'salud',
  secret = crypto.randomBytes(32),
  ttlMs = DEFAULT_TTL_MS,
  secureCookies = false,
} = {}) {
  const sessions = new Map();
  const mapTokens = new Map();
  const sessionTtlMs = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS;
  const passwordDigest = crypto.createHmac('sha256', secret).update(password).digest();
  const userDigest = crypto.createHmac('sha256', secret).update(user).digest();

  function prune(now = Date.now()) {
    for (const [token, session] of sessions) {
      if (session.expiresAt <= now) sessions.delete(token);
    }
    for (const [token, session] of mapTokens) {
      if (session.expiresAt <= now) mapTokens.delete(token);
    }
  }

  function bearerToken(req) {
    const header = req.headers.authorization;
    const match = typeof header === 'string' ? header.match(/^Bearer ([A-Za-z0-9_-]+)$/) : null;
    return match?.[1] ?? '';
  }

  function cookie(token, maxAgeSeconds) {
    const parts = [
      `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      secureCookies ? 'SameSite=None' : 'SameSite=Lax',
      `Max-Age=${maxAgeSeconds}`,
    ];
    if (secureCookies) parts.push('Secure');
    return parts.join('; ');
  }

  return {
    enabled,

    verify(username, candidate) {
      if (!enabled) return false;
      const candidateUser = crypto.createHmac('sha256', secret).update(String(username ?? '')).digest();
      const candidatePassword = crypto
        .createHmac('sha256', secret)
        .update(String(candidate ?? ''))
        .digest();
      // Se comparan ambos para no filtrar cuál de los dos falló.
      const userOk = safeEqual(userDigest, candidateUser);
      const passwordOk = safeEqual(passwordDigest, candidatePassword);
      return userOk && passwordOk;
    },

    login(username, candidate) {
      if (!this.verify(username, candidate)) return null;
      prune();
      const token = crypto.randomBytes(32).toString('base64url');
      const expiresAt = Date.now() + sessionTtlMs;
      if (sessions.size >= 100) {
        const oldest = sessions.keys().next().value;
        if (oldest) sessions.delete(oldest);
      }
      sessions.set(token, { user, expiresAt });
      return {
        token,
        user,
        expiresAt,
        cookie: cookie(token, Math.floor(sessionTtlMs / 1000)),
      };
    },

    createMapToken(username, candidate) {
      if (!this.verify(username, candidate)) return null;
      prune();
      if (mapTokens.size >= 100) {
        const oldest = mapTokens.keys().next().value;
        if (oldest) mapTokens.delete(oldest);
      }
      const token = crypto.randomBytes(32).toString('base64url');
      const expiresAt = Date.now() + MAP_TOKEN_TTL_MS;
      mapTokens.set(token, { user, expiresAt });
      return { token, user, expiresAt };
    },

    mapSession(req) {
      if (!enabled) return null;
      const token = bearerToken(req);
      if (!token) return null;
      prune();
      return mapTokens.get(token) ?? null;
    },

    revokeMapToken(req) {
      const token = bearerToken(req);
      return token ? mapTokens.delete(token) : false;
    },

    logout(req) {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      if (token) sessions.delete(token);
      return cookie('', 0);
    },

    session(req) {
      if (!enabled) return { user: 'demostración', demo: true };
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      if (!token) return null;
      prune();
      const session = sessions.get(token);
      if (!session) return null;
      return { user: session.user, expiresAt: session.expiresAt };
    },

    /** Solo para pruebas y diagnóstico. */
    get activeSessions() {
      prune();
      return sessions.size;
    },
  };
}

/**
 * Límite simple en memoria por IP y por ruta. Evita que un panel expuesto por
 * error o un teléfono con un error de configuración sature el servidor.
 */
export function createRateLimiter({ windowMs, max }) {
  const buckets = new Map();

  function hit(key, now = Date.now()) {
    if (buckets.size > 1000) {
      for (const [entryKey, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(entryKey);
      }
    }
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfter: 0 };
    }
    if (current.count >= max) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      };
    }
    current.count += 1;
    return { allowed: true, retryAfter: 0 };
  }

  hit.reset = (key) => {
    buckets.delete(key);
  };

  return hit;
}
