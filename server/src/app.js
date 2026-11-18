import fs from 'node:fs/promises';
import path from 'node:path';
import { createRateLimiter } from './auth.js';

const TYPES = new Set(['enfermedad', 'accidente', 'mordedura', 'parto', 'otro']);
const RESPONSE_CODES = new Set(['en_camino', 'acudir_posta', 'sin_medico', 'otra']);
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_CHARS = 2_500_000;
const DEFAULT_ACK_MINUTES = 10;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};

const HTML_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "font-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function sendJson(res, status, body, headers = {}) {
  if (res.writableEnded) return;
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

function sendText(res, status, text, headers = {}) {
  if (res.writableEnded) return;
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(text);
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let tooLarge = false;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        if (!tooLarge) {
          tooLarge = true;
          reject(new HttpError(413, 'payload_too_large'));
        }
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return;
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new HttpError(400, 'invalid_json'));
      }
    });
    req.on('error', (error) => reject(error));
  });
}

function readString(value, max, field) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new HttpError(400, `invalid_${field}`);
  return value.trim().slice(0, max);
}

function readLocation(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object') throw new HttpError(400, 'invalid_location');
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  const accuracy = Number(value.accuracy ?? 0);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new HttpError(400, 'invalid_location');
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new HttpError(400, 'invalid_location');
  }
  const capturedAt = new Date(value.capturedAt ?? Date.now());
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    accuracy: Math.max(0, Math.round(Number.isFinite(accuracy) ? accuracy : 0)),
    capturedAt: Number.isNaN(capturedAt.getTime())
      ? new Date().toISOString()
      : capturedAt.toISOString(),
  };
}

function readPhoto(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !value.startsWith('data:image/')) {
    throw new HttpError(400, 'invalid_photo');
  }
  if (value.length > MAX_PHOTO_CHARS) {
    throw new HttpError(413, 'photo_too_large');
  }
  return value;
}

function toAlert(body, now, ackMinutes) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'invalid_body');
  }
  const id = readString(body.id, 80, 'id');
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) {
    throw new HttpError(400, 'invalid_id');
  }
  if (!TYPES.has(body.type)) {
    throw new HttpError(400, 'invalid_type');
  }
  const createdAt = new Date(body.clientCreatedAt ?? Date.now());
  const consentLocation = Boolean(body.consentLocation);
  const serverReceivedAt = now();
  const minutes = Number.isFinite(ackMinutes) && ackMinutes >= 0 ? ackMinutes : DEFAULT_ACK_MINUTES;
  const alert = {
    id,
    type: body.type,
    note: readString(body.note, 1000, 'note'),
    community: readString(body.community, 80, 'community'),
    deviceName: readString(body.deviceName, 80, 'deviceName'),
    reportedBy: readString(body.reportedBy, 80, 'reportedBy') || undefined,
    reporterPhone: readString(body.reporterPhone, 30, 'reporterPhone') || undefined,
    consentLocation,
    clientCreatedAt: Number.isNaN(createdAt.getTime())
      ? serverReceivedAt
      : createdAt.toISOString(),
    serverReceivedAt,
    ackDeadlineAt: new Date(Date.parse(serverReceivedAt) + minutes * 60_000).toISOString(),
  };
  if (consentLocation) {
    const location = readLocation(body.location);
    if (location) alert.location = location;
  }
  const photo = readPhoto(body.photo);
  if (photo) alert.photo = photo;
  return alert;
}

async function serveStatic(req, res, pathname, staticDir) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, 'Método no permitido', { Allow: 'GET, HEAD' });
    return;
  }

  let requested = pathname;
  if (requested === '/' || requested === '') requested = '/index.html';
  else if (requested === '/panel' || requested === '/panel/') requested = '/panel.html';

  const decoded = requested;
  const full = path.join(staticDir, decoded);
  const normalizedRoot = path.resolve(staticDir) + path.sep;
  if (!path.resolve(full).startsWith(normalizedRoot)) {
    sendText(res, 403, 'Acceso denegado');
    return;
  }

  let stat;
  try {
    stat = await fs.stat(full);
  } catch {
    sendText(res, 404, 'No encontrado');
    return;
  }
  if (!stat.isFile()) {
    sendText(res, 404, 'No encontrado');
    return;
  }

  const ext = path.extname(full).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';
  const isHashedAsset = decoded.startsWith('/assets/');
  const cacheControl = isHashedAsset
    ? 'public, max-age=31536000, immutable'
    : ext === '.html' || decoded.endsWith('sw.js')
      ? 'no-cache'
      : 'public, max-age=3600';

  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
    'Content-Length': stat.size,
  };
  if (ext === '.html') {
    headers['Content-Security-Policy'] = HTML_CSP;
  }
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const content = await fs.readFile(full);
  res.end(content);
}

export function createHandler({
  store,
  staticDir,
  now = () => new Date().toISOString(),
  auth = null,
  ackMinutes = DEFAULT_ACK_MINUTES,
  escalationPhone = '',
}) {
  const alertLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 120 });
  const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 8 });
  const effectiveAckMinutes =
    Number.isFinite(ackMinutes) && ackMinutes >= 0 ? ackMinutes : DEFAULT_ACK_MINUTES;

  function clientIp(req) {
    if (process.env.MANGUARE_TRUST_PROXY === '1') {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
      }
    }
    return req.socket.remoteAddress ?? 'desconocida';
  }

  function sessionFor(req) {
    return auth?.enabled ? auth.session(req) : null;
  }

  return async function handler(req, res) {
    const started = Date.now();
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        sendText(res, 400, 'Ruta inválida');
        return;
      }

      if (pathname === '/api/health') {
        if (req.method !== 'GET') {
          sendJson(res, 405, { error: 'method_not_allowed' });
          return;
        }
        const alerts = await store.list();
        sendJson(res, 200, {
          ok: true,
          alerts: alerts.length,
          uptimeSeconds: Math.round(process.uptime()),
        });
        return;
      }

      if (pathname === '/api/panel/session') {
        if (req.method !== 'GET') {
          sendJson(res, 405, { error: 'method_not_allowed' });
          return;
        }
        const session = sessionFor(req);
        sendJson(res, 200, {
          authRequired: Boolean(auth?.enabled),
          authenticated: auth?.enabled ? Boolean(session) : true,
          ...(session?.user ? { user: session.user } : {}),
          config: {
            ackMinutes: effectiveAckMinutes,
            escalationPhone,
          },
        });
        return;
      }

      if (pathname === '/api/panel/login') {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'method_not_allowed' });
          return;
        }
        if (!auth?.enabled) {
          sendJson(res, 200, { authenticated: true, authRequired: false });
          return;
        }
        const loginKey = `login:${clientIp(req)}`;
        const limit = loginLimiter(loginKey);
        if (!limit.allowed) {
          sendJson(
            res,
            429,
            { error: 'too_many_attempts' },
            { 'Retry-After': String(limit.retryAfter) },
          );
          return;
        }
        const body = await readJsonBody(req);
        const username = body && typeof body.user === 'string' ? body.user.slice(0, 80) : '';
        const password = body && typeof body.password === 'string' ? body.password.slice(0, 200) : '';
        const session = auth.login(username, password);
        if (!session) {
          sendJson(res, 401, { error: 'invalid_credentials' });
          return;
        }
        loginLimiter.reset(loginKey);
        sendJson(
          res,
          200,
          { authenticated: true, user: session.user },
          { 'Set-Cookie': session.cookie },
        );
        return;
      }

      if (pathname === '/api/panel/logout') {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'method_not_allowed' });
          return;
        }
        const cookie = auth?.enabled ? auth.logout(req) : '';
        sendJson(
          res,
          200,
          { authenticated: false },
          cookie ? { 'Set-Cookie': cookie } : {},
        );
        return;
      }

      if (pathname === '/api/alerts') {
        if (req.method === 'GET') {
          if (auth?.enabled && !sessionFor(req)) {
            sendJson(res, 401, { error: 'authentication_required' });
            return;
          }
          await store.escalateOverdue(now());
          const alerts = await store.list();
          sendJson(res, 200, { alerts });
          return;
        }
        if (req.method === 'POST') {
          const limit = alertLimiter(`alerts:${clientIp(req)}`);
          if (!limit.allowed) {
            sendJson(
              res,
              429,
              { error: 'too_many_requests' },
              { 'Retry-After': String(limit.retryAfter) },
            );
            return;
          }
          const body = await readJsonBody(req);
          const alert = toAlert(body, now, effectiveAckMinutes);
          const existing = await store.get(alert.id);
          if (existing) {
            sendJson(res, 200, { alert: existing });
            return;
          }
          const result = await store.add(alert);
          sendJson(res, result.created ? 201 : 200, { alert: result.alert });
          return;
        }
        sendJson(res, 405, { error: 'method_not_allowed' });
        return;
      }

      const match = pathname.match(/^\/api\/alerts\/([^/]+)(\/(received|escalate|responses))?$/);
      if (match) {
        const id = match[1];
        const action = match[2];
        if (action) {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'method_not_allowed' });
            return;
          }
          const session = sessionFor(req);
          if (auth?.enabled && !session) {
            sendJson(res, 401, { error: 'authentication_required' });
            return;
          }
          const existing = await store.get(id);
          if (!existing) {
            sendJson(res, 404, { error: 'not_found' });
            return;
          }
          const actor = session?.user ?? 'demostración';

          if (action === '/received') {
            const updated = await store.acknowledge(id, now(), actor);
            sendJson(res, 200, { alert: updated });
            return;
          }

          if (action === '/escalate') {
            const body = await readJsonBody(req);
            const channel =
              body && typeof body.channel === 'string' ? body.channel.slice(0, 20) : 'manual';
            if (!['sms', 'llamada', 'manual'].includes(channel)) {
              throw new HttpError(400, 'invalid_channel');
            }
            const updated = await store.escalate(id, now(), actor, channel);
            sendJson(res, 200, { alert: updated });
            return;
          }

          // action === '/responses'
          const body = await readJsonBody(req);
          const code = body && typeof body.code === 'string' ? body.code : '';
          if (!RESPONSE_CODES.has(code)) {
            throw new HttpError(400, 'invalid_response_code');
          }
          const message = readString(body.message, 300, 'message');
          if (code === 'otra' && !message) {
            throw new HttpError(400, 'message_required');
          }
          const updated = await store.respond(id, { code, message }, now(), actor);
          sendJson(res, 200, { alert: updated });
          return;
        }

        if (req.method === 'GET') {
          await store.escalateOverdue(now());
          const alert = await store.get(id);
          if (!alert) {
            sendJson(res, 404, { error: 'not_found' });
            return;
          }
          sendJson(res, 200, { alert });
          return;
        }
        sendJson(res, 405, { error: 'method_not_allowed' });
        return;
      }

      if (pathname.startsWith('/api/')) {
        sendJson(res, 404, { error: 'not_found' });
        return;
      }

      await serveStatic(req, res, pathname, staticDir);
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: error.code });
      } else {
        console.error('[manguare] Error inesperado:', error);
        if (!res.writableEnded) {
          sendJson(res, 500, { error: 'internal_error' });
        }
      }
    } finally {
      if (process.env.MANGUARE_LOG !== '0') {
        const duration = Date.now() - started;
        console.log(`[manguare] ${req.method} ${req.url} → ${res.statusCode} (${duration} ms)`);
      }
    }
  };
}
