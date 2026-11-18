import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  X,
} from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import { EMERGENCY_META } from '../lib/emergency';
import { formatDateTime, formatRelative, formatTime, shortId } from '../lib/format';
import { RESPONSE_OPTIONS, responseText } from '../lib/sla';
import type { ServerAlert } from '../lib/types';

type PanelFilter = 'all' | 'pending' | 'overdue' | 'received';

interface PanelToastState {
  message: string;
  tone: 'ok' | 'error';
}

let audioContext: AudioContext | null = null;

function playChime(): void {
  try {
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    if (!audioContext) audioContext = new Ctor();
    if (audioContext.state === 'suspended') void audioContext.resume();
    const ctx = audioContext;
    const start = ctx.currentTime + 0.02;
    [880, 1174.66, 1567.98].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = start + index * 0.13;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.35);
    });
  } catch {
    // El sonido es opcional; si el navegador lo bloquea, no interrumpimos.
  }
}

function isServerOverdue(alert: ServerAlert, now: number = Date.now()): boolean {
  if (alert.acknowledgedAt || !alert.ackDeadlineAt) return false;
  const deadline = Date.parse(alert.ackDeadlineAt);
  return !Number.isNaN(deadline) && deadline <= now;
}

function escalationBody(alert: ServerAlert): string {
  const meta = EMERGENCY_META[alert.type];
  const deadline = alert.ackDeadlineAt
    ? new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' }).format(
        new Date(alert.ackDeadlineAt),
      )
    : 'sin plazo';
  return [
    'MANGUARE ESCALAMIENTO',
    meta.label,
    alert.community || 'comunidad no indicada',
    `Ref ${shortId(alert.id)}`,
    `Plazo venció ${deadline}`,
  ].join(' | ');
}

function PanelStatus({ alert }: { alert: ServerAlert }) {
  if (alert.acknowledgedAt) {
    return (
      <span className="panel-status is-received">
        <CheckCircle2 size={14} aria-hidden="true" /> Recibida
      </span>
    );
  }
  if (isServerOverdue(alert)) {
    return (
      <span className="panel-status is-overdue">
        <TriangleAlert size={14} aria-hidden="true" /> Vencida
      </span>
    );
  }
  return (
    <span className="panel-status is-pending">
      <Clock3 size={14} aria-hidden="true" /> Por confirmar
    </span>
  );
}

function AlertRow({
  alert,
  acking,
  onAck,
  onOpen,
}: {
  alert: ServerAlert;
  acking: boolean;
  onAck: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const meta = EMERGENCY_META[alert.type];
  const Icon = meta.icon;

  return (
    <article
      className={`panel-row ${alert.acknowledgedAt ? 'is-received' : 'is-unconfirmed'} ${
        isServerOverdue(alert) ? 'is-overdue' : ''
      }`}
    >
      <span className={`type-tile type-tile--${meta.tone}`}>
        <Icon size={23} aria-hidden="true" />
      </span>
      <div className="panel-row-main">
        <div className="panel-row-title">
          <strong>{meta.label}</strong>
          {alert.community ? <span className="panel-row-community">{alert.community}</span> : null}
          {!alert.acknowledgedAt ? <span className="panel-new">Nueva</span> : null}
        </div>
        <p className="panel-row-note">{alert.note || 'Sin detalle adicional'}</p>
        <p className="panel-row-meta">
          <span>{formatRelative(alert.clientCreatedAt)}</span>
          <span>{alert.deviceName || 'Equipo no indicado'}</span>
          {alert.reportedBy ? <span>Reportó {alert.reportedBy}</span> : null}
          <span>
            {alert.location ? `GPS ±${alert.location.accuracy} m` : 'Sin GPS'}
          </span>
          {alert.photo ? (
            <span>
              <ImageIcon size={13} aria-hidden="true" /> Foto
            </span>
          ) : null}
          {!alert.acknowledgedAt && alert.ackDeadlineAt ? (
            <span className={isServerOverdue(alert) ? 'panel-late' : ''}>
              {isServerOverdue(alert)
                ? `Vencida ${formatRelative(alert.ackDeadlineAt)}`
                : `Plazo ${formatTime(alert.ackDeadlineAt)}`}
            </span>
          ) : null}
          {alert.responses?.length ? (
            <span className="panel-response-flag">
              <MessageSquareText size={13} aria-hidden="true" /> Respuesta
            </span>
          ) : null}
          <span className="mono">Ref {shortId(alert.id)}</span>
        </p>
      </div>
      <div className="panel-row-time">
        <time dateTime={alert.clientCreatedAt}>{formatTime(alert.clientCreatedAt)}</time>
        <span>{formatRelative(alert.clientCreatedAt)}</span>
      </div>
      <div className="panel-row-actions">
        <PanelStatus alert={alert} />
        {!alert.acknowledgedAt ? (
          <button
            type="button"
            className="panel-ack"
            data-testid={`ack-${alert.id}`}
            onClick={() => onAck(alert.id)}
            disabled={acking}
          >
            {acking ? (
              <LoaderCircle size={15} className="spin" aria-hidden="true" />
            ) : (
              <Check size={15} aria-hidden="true" />
            )}
            Marcar recibida
          </button>
        ) : null}
        <button type="button" className="panel-detail" onClick={() => onOpen(alert.id)}>
          Ver detalle <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function AlertModal({
  alert,
  acking,
  responding,
  escalationPhone,
  onClose,
  onAck,
  onRespond,
  onEscalate,
}: {
  alert: ServerAlert | null;
  acking: boolean;
  responding: string | null;
  escalationPhone: string;
  onClose: () => void;
  onAck: (id: string) => void;
  onRespond: (id: string, code: string, message: string) => void;
  onEscalate: (id: string, channel: string) => void;
}) {
  const [custom, setCustom] = useState('');
  useEffect(() => {
    setCustom('');
  }, [alert?.id]);

  useEffect(() => {
    if (!alert) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('sheet-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('sheet-open');
    };
  }, [alert, onClose]);

  if (!alert) return null;
  const meta = EMERGENCY_META[alert.type];
  const Icon = meta.icon;
  const mapUrl = alert.location
    ? `https://www.openstreetmap.org/?mlat=${alert.location.lat}&mlon=${alert.location.lng}#map=15/${alert.location.lat}/${alert.location.lng}`
    : null;
  const overdue = isServerOverdue(alert);
  const cleanPhone = escalationPhone.replace(/[^\d+*#]/g, '');
  const smsUrl = cleanPhone
    ? `sms:${cleanPhone}?&body=${encodeURIComponent(escalationBody(alert))}`
    : 'tel:106';

  return createPortal(
    <div
      className="panel-modal-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="panel-modal" role="dialog" aria-modal="true" aria-label="Detalle de la alerta">
        <header className="panel-modal-head">
          <div className="panel-modal-heading">
            <span className={`type-tile type-tile--${meta.tone}`}>
              <Icon size={24} aria-hidden="true" />
            </span>
            <div>
              <h2>{meta.label}</h2>
              <p>
                {alert.community || 'Comunidad no indicada'} · Ref {shortId(alert.id)}
              </p>
            </div>
          </div>
          <div className="panel-modal-head-right">
            <PanelStatus alert={alert} />
            <button type="button" className="panel-icon-btn" onClick={onClose} aria-label="Cerrar">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className={`panel-modal-body ${alert.photo ? 'has-photo' : ''}`}>
          <div className="panel-modal-info">
            <dl className="panel-detail-list">
              <div>
                <dt>Detalle</dt>
                <dd>{alert.note || 'Sin detalle adicional'}</dd>
              </div>
              <div>
                <dt>Comunidad</dt>
                <dd>{alert.community || 'No indicada'}</dd>
              </div>
              <div>
                <dt>Equipo</dt>
                <dd>{alert.deviceName || 'No indicado'}</dd>
              </div>
              <div>
                <dt>Reportado por</dt>
                <dd>
                  {alert.reportedBy
                    ? `${alert.reportedBy}${alert.reporterPhone ? ` · ${alert.reporterPhone}` : ''}`
                    : 'No indicado'}
                </dd>
              </div>
              <div>
                <dt>Ubicación</dt>
                <dd>
                  {alert.location ? (
                    <>
                      <span className="panel-coords">
                        {alert.location.lat.toFixed(5)}, {alert.location.lng.toFixed(5)} (±
                        {alert.location.accuracy} m)
                      </span>
                      {mapUrl ? (
                        <a className="panel-link" href={mapUrl} target="_blank" rel="noreferrer">
                          Abrir mapa <ExternalLink size={13} aria-hidden="true" />
                        </a>
                      ) : null}
                    </>
                  ) : (
                    'Sin GPS'
                  )}
                </dd>
              </div>
              <div>
                <dt>Recibida por Manguaré</dt>
                <dd>{formatDateTime(alert.serverReceivedAt)}</dd>
              </div>
              <div>
                <dt>Confirmada por la red</dt>
                <dd>
                  {alert.acknowledgedAt
                    ? `${formatDateTime(alert.acknowledgedAt)}${
                        alert.acknowledgedBy ? ` · ${alert.acknowledgedBy}` : ''
                      }`
                    : 'Todavía no confirmada'}
                </dd>
              </div>
              <div>
                <dt>Plazo de acuse</dt>
                <dd>
                  {alert.ackDeadlineAt ? (
                    <span className={overdue ? 'panel-late' : ''}>
                      {formatDateTime(alert.ackDeadlineAt)}
                      {overdue ? ' · vencido' : ''}
                    </span>
                  ) : (
                    'Sin plazo definido'
                  )}
                </dd>
              </div>
              <div>
                <dt>Escalamiento</dt>
                <dd>
                  {alert.escalatedAt
                    ? `${formatDateTime(alert.escalatedAt)}${
                        alert.escalationCount ? ` · ${alert.escalationCount} veces` : ''
                      }`
                    : 'No escalada'}
                </dd>
              </div>
              <div>
                <dt>Enviada desde el teléfono</dt>
                <dd>{formatDateTime(alert.clientCreatedAt)}</dd>
              </div>
              <div>
                <dt>Consentimiento de ubicación</dt>
                <dd>{alert.consentLocation ? 'Sí, autorizado' : 'No autorizado'}</dd>
              </div>
              <div className="panel-detail-id">
                <dt>Referencia completa</dt>
                <dd className="mono">{alert.id}</dd>
              </div>
            </dl>

            <div className="panel-responses">
              <h3>Respuesta a la comunidad</h3>
              {alert.responses?.length ? (
                <ul className="panel-response-list">
                  {alert.responses.map((response) => (
                    <li key={`${response.at}-${response.code}`}>
                      <MessageSquareText size={14} aria-hidden="true" />
                      <span>
                        <strong>{responseText(response)}</strong>
                        <small>
                          {formatDateTime(response.at)}
                          {response.by ? ` · ${response.by}` : ''}
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-response-empty">
                  Todavía no se envió una indicación. Responder también confirma la recepción.
                </p>
              )}

              <div className="panel-response-grid">
                {RESPONSE_OPTIONS.filter((option) => option.code !== 'otra').map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    className="panel-response-btn"
                    data-testid={`respond-${option.code}`}
                    onClick={() => onRespond(alert.id, option.code, '')}
                    disabled={responding !== null}
                  >
                    {responding === option.code ? (
                      <LoaderCircle size={15} className="spin" aria-hidden="true" />
                    ) : (
                      <MessageSquareText size={15} aria-hidden="true" />
                    )}
                    {option.label}
                  </button>
                ))}
              </div>

              <form
                className="panel-response-custom"
                onSubmit={(event) => {
                  event.preventDefault();
                  const message = custom.trim();
                  if (!message) return;
                  onRespond(alert.id, 'otra', message);
                  setCustom('');
                }}
              >
                <input
                  type="text"
                  value={custom}
                  maxLength={300}
                  placeholder="Otra indicación para la comunidad"
                  onChange={(event) => setCustom(event.target.value)}
                />
                <button type="submit" disabled={responding !== null || !custom.trim()}>
                  Enviar
                </button>
              </form>
            </div>
          </div>
          {alert.photo ? (
            <div className="panel-modal-photo">
              <span>Foto adjunta</span>
              <a href={alert.photo} target="_blank" rel="noreferrer">
                <img src={alert.photo} alt="Foto adjunta a la emergencia" />
              </a>
            </div>
          ) : null}
        </div>

        <footer className="panel-modal-foot">
          <p>
            <ShieldCheck size={15} aria-hidden="true" /> La ubicación es un dato personal: compártela
            solo con el personal que responde.
          </p>
          {overdue ? (
            <div className="panel-escalate">
              <strong>
                <TriangleAlert size={15} aria-hidden="true" /> Plazo vencido sin confirmación
              </strong>
              <a
                href={smsUrl}
                onClick={() => onEscalate(alert.id, cleanPhone ? 'sms' : 'llamada')}
              >
                <MessageSquareText size={15} aria-hidden="true" />
                {cleanPhone ? 'Abrir SMS de escalamiento' : 'Llamar al 106'}
              </a>
              <span>
                {alert.escalatedAt
                  ? `Escalada ${formatRelative(alert.escalatedAt)}`
                  : 'El escalamiento quedará registrado.'}
              </span>
            </div>
          ) : null}
          <div>
            {!alert.acknowledgedAt ? (
              <button
                type="button"
                className="panel-ack panel-ack--large"
                onClick={() => onAck(alert.id)}
                disabled={acking}
              >
                {acking ? (
                  <LoaderCircle size={17} className="spin" aria-hidden="true" />
                ) : (
                  <Check size={17} aria-hidden="true" />
                )}
                Marcar como recibida
              </button>
            ) : null}
            <button type="button" className="panel-detail panel-detail--large" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

interface PanelSessionState {
  authRequired: boolean;
  authenticated: boolean;
  user?: string;
  config?: {
    ackMinutes: number;
    escalationPhone: string;
  };
}

function PanelLogin({
  busy,
  error,
  onLogin,
}: {
  busy: boolean;
  error: string | null;
  onLogin: (user: string, password: string) => void;
}) {
  const [user, setUser] = useState('salud');
  const [password, setPassword] = useState('');

  return (
    <div className="panel-page panel-login-page">
      <main className="panel-login">
        <div className="panel-login-brand">
          <BrandMark size={52} />
          <div>
            <span className="panel-brand-name">Manguaré</span>
            <span className="panel-brand-sub">Panel de la red de salud</span>
          </div>
        </div>

        <div className="panel-login-card">
          <span className="panel-login-icon">
            <KeyRound size={24} aria-hidden="true" />
          </span>
          <h1>Acceso restringido</h1>
          <p>
            Este panel muestra ubicaciones y datos personales. Ingresa con la cuenta de la red de
            salud para ver y confirmar alertas.
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;
              onLogin(user, password);
            }}
          >
            <label>
              <span>Usuario</span>
              <span className="panel-login-input">
                <UserRound size={17} aria-hidden="true" />
                <input
                  name="user"
                  data-testid="login-user"
                  autoComplete="username"
                  value={user}
                  onChange={(event) => setUser(event.target.value)}
                  required
                />
              </span>
            </label>
            <label>
              <span>Contraseña</span>
              <span className="panel-login-input">
                <KeyRound size={17} aria-hidden="true" />
                <input
                  name="password"
                  data-testid="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoFocus
                />
              </span>
            </label>

            {error ? (
              <p className="panel-login-error" role="alert">
                <TriangleAlert size={16} aria-hidden="true" /> {error}
              </p>
            ) : null}

            <button type="submit" className="panel-login-submit" data-testid="login-submit" disabled={busy}>
              {busy ? (
                <LoaderCircle size={18} className="spin" aria-hidden="true" />
              ) : (
                <LogIn size={18} aria-hidden="true" />
              )}
              {busy ? 'Ingresando…' : 'Ingresar al panel'}
            </button>
          </form>

          <p className="panel-login-foot">
            <ShieldCheck size={15} aria-hidden="true" /> La sesión dura 12 horas. Si no conoces la
            contraseña, pídela al responsable del piloto.
          </p>
        </div>
      </main>
    </div>
  );
}

export function PanelApp() {
  const [alerts, setAlerts] = useState<ServerAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filter, setFilter] = useState<PanelFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [acking, setAcking] = useState<string | null>(null);
  const [responding, setResponding] = useState<string | null>(null);
  const [toast, setToast] = useState<PanelToastState | null>(null);
  const [session, setSession] = useState<PanelSessionState | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return localStorage.getItem('manguare.panel.sound') === '1';
    } catch {
      return false;
    }
  });

  const knownIds = useRef<Set<string>>(new Set());
  const knownOverdue = useRef<Set<string>>(new Set());
  const hasLoadedOnce = useRef(false);
  const inFlight = useRef(false);
  const soundRef = useRef(soundOn);

  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const response = await fetch('/api/panel/session', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as PanelSessionState;
        if (!disposed) setSession(data);
      } catch {
        if (!disposed) {
          setSession({ authRequired: false, authenticated: true });
          setError('No se puede conectar con el servidor de alertas.');
        }
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);

  const load = useCallback(async (indicator = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (indicator) setRefreshing(true);
    try {
      const response = await fetch('/api/alerts', { cache: 'no-store' });
      if (response.status === 401) {
        setSession((current) => ({
          authRequired: true,
          authenticated: false,
          ...(current?.user ? { user: current.user } : {}),
        }));
        setAlerts([]);
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { alerts?: ServerAlert[] };
      const list = data.alerts ?? [];
      const fresh = list.filter((alert) => !knownIds.current.has(alert.id));
      const overdueIds = new Set(list.filter((alert) => isServerOverdue(alert)).map((alert) => alert.id));
      const newOverdue = [...overdueIds].some((id) => !knownOverdue.current.has(id));
      const hadLoaded = hasLoadedOnce.current;
      knownIds.current = new Set(list.map((alert) => alert.id));
      knownOverdue.current = overdueIds;
      hasLoadedOnce.current = true;
      if (hadLoaded && (fresh.length > 0 || newOverdue) && soundRef.current) playChime();
      setAlerts(list);
      setError(null);
      setLastUpdated(new Date());
    } catch {
      setError('No se puede conectar con el servidor de alertas.');
    } finally {
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const authenticated = session?.authenticated === true;

  useEffect(() => {
    if (!authenticated) return;
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const onFocus = () => void load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [load, authenticated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const pending = alerts.filter((alert) => !alert.acknowledgedAt);
  const overdue = alerts.filter((alert) => isServerOverdue(alert));
  const awaiting = pending.filter((alert) => !isServerOverdue(alert));
  const received = alerts.filter((alert) => Boolean(alert.acknowledgedAt));
  const ordered = [...alerts].sort((a, b) => {
    const aLate = isServerOverdue(a) ? 1 : 0;
    const bLate = isServerOverdue(b) ? 1 : 0;
    if (aLate !== bLate) return bLate - aLate;
    return String(b.serverReceivedAt).localeCompare(String(a.serverReceivedAt));
  });
  const filtered =
    filter === 'pending'
      ? awaiting
      : filter === 'overdue'
        ? overdue
        : filter === 'received'
          ? received
          : ordered;
  const selected = alerts.find((alert) => alert.id === selectedId) ?? null;

  useEffect(() => {
    document.title = `${pending.length > 0 ? `(${pending.length}) ` : ''}Manguaré · Panel de la red de salud`;
  }, [pending.length]);

  useEffect(() => {
    return () => {
      document.title = 'Manguaré · Panel de la red de salud';
    };
  }, []);

  const acknowledge = async (id: string) => {
    setAcking(id);
    try {
      const response = await fetch(`/api/alerts/${encodeURIComponent(id)}/received`, {
        method: 'POST',
      });
      if (response.status === 401) {
        setSession({ authRequired: true, authenticated: false });
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { alert?: ServerAlert };
      if (!data.alert) throw new Error('Respuesta incompleta');
      setAlerts((current) =>
        current.map((alert) => (alert.id === id ? (data.alert as ServerAlert) : alert)),
      );
      setLastUpdated(new Date());
      setToast({ message: 'Alerta marcada como recibida.', tone: 'ok' });
    } catch {
      setToast({
        message: 'No se pudo marcar la alerta. Revisa la conexión con el servidor.',
        tone: 'error',
      });
    } finally {
      setAcking(null);
    }
  };

  const respond = async (id: string, code: string, message: string) => {
    setResponding(code);
    try {
      const response = await fetch(`/api/alerts/${encodeURIComponent(id)}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, ...(message ? { message } : {}) }),
      });
      if (response.status === 401) {
        setSession({ authRequired: true, authenticated: false });
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { alert?: ServerAlert };
      if (!data.alert) throw new Error('Respuesta incompleta');
      setAlerts((current) =>
        current.map((alert) => (alert.id === id ? (data.alert as ServerAlert) : alert)),
      );
      setLastUpdated(new Date());
      setToast({ message: 'Respuesta enviada y alerta confirmada.', tone: 'ok' });
    } catch {
      setToast({ message: 'No se pudo enviar la respuesta a la comunidad.', tone: 'error' });
    } finally {
      setResponding(null);
    }
  };

  const escalate = async (id: string, channel: string) => {
    try {
      const response = await fetch(`/api/alerts/${encodeURIComponent(id)}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });
      if (response.status === 401) {
        setSession({ authRequired: true, authenticated: false });
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { alert?: ServerAlert };
      if (!data.alert) throw new Error('Respuesta incompleta');
      setAlerts((current) =>
        current.map((alert) => (alert.id === id ? (data.alert as ServerAlert) : alert)),
      );
      setToast({ message: 'Escalamiento registrado.', tone: 'ok' });
    } catch {
      setToast({ message: 'No se pudo registrar el escalamiento.', tone: 'error' });
    }
  };

  const handleLogin = async (user: string, password: string) => {
    setLoggingIn(true);
    setSessionError(null);
    try {
      const response = await fetch('/api/panel/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        user?: string;
        error?: string;
      };
      if (!response.ok) {
        setSessionError(
          response.status === 429
            ? 'Demasiados intentos. Espera unos minutos antes de volver a probar.'
            : 'Usuario o contraseña incorrectos.',
        );
        return;
      }
      setSession({ authRequired: true, authenticated: true, user: data.user ?? user });
      setLoading(true);
      setError(null);
    } catch {
      setSessionError('No se pudo conectar con el servidor. Revisa la red.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/panel/logout', { method: 'POST' });
    } catch {
      // Aunque falle la petición, se oculta la información en esta pantalla.
    }
    setSession({ authRequired: true, authenticated: false });
    setAlerts([]);
    knownIds.current = new Set();
    hasLoadedOnce.current = false;
    setLastUpdated(null);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    soundRef.current = next;
    try {
      localStorage.setItem('manguare.panel.sound', next ? '1' : '0');
    } catch {
      // Sin persistencia: el botón funciona durante la sesión.
    }
    if (next) playChime();
    setToast({
      message: next ? 'Sonido activado para alertas nuevas.' : 'Sonido desactivado.',
      tone: 'ok',
    });
  };

  const today = new Date().toDateString();
  const todayCount = alerts.filter(
    (alert) => new Date(alert.serverReceivedAt).toDateString() === today,
  ).length;

  const filters: Array<{ id: PanelFilter; label: string; count: number }> = [
    { id: 'all', label: 'Todas', count: alerts.length },
    { id: 'pending', label: 'En plazo', count: awaiting.length },
    { id: 'overdue', label: 'Vencidas', count: overdue.length },
    { id: 'received', label: 'Recibidas', count: received.length },
  ];

  if (!session) {
    return (
      <div className="panel-page panel-login-page">
        <main className="panel-login">
          <div className="panel-login-loading">
            <LoaderCircle size={22} className="spin" aria-hidden="true" /> Comprobando sesión…
          </div>
        </main>
      </div>
    );
  }

  if (session.authRequired && !session.authenticated) {
    return (
      <PanelLogin busy={loggingIn} error={sessionError} onLogin={(user, pass) => void handleLogin(user, pass)} />
    );
  }

  return (
    <div className="panel-page">
      <header className="panel-top">
        <div className="panel-brand">
          <BrandMark size={40} />
          <div>
            <span className="panel-brand-name">Manguaré</span>
            <span className="panel-brand-sub">Panel de la red de salud</span>
          </div>
        </div>
        <div className="panel-top-actions">
          <span className={`panel-live ${error ? 'is-offline' : ''}`}>
            <span className="panel-live-dot" aria-hidden="true" />
            {error ? 'Sin servidor' : 'En vivo · cada 5 s'}
          </span>
          <button
            type="button"
            className="panel-top-btn"
            onClick={toggleSound}
            aria-pressed={soundOn}
            title={soundOn ? 'Desactivar sonido' : 'Activar sonido'}
          >
            {soundOn ? <Bell size={17} aria-hidden="true" /> : <BellOff size={17} aria-hidden="true" />}
            <span>{soundOn ? 'Sonido' : 'Silencio'}</span>
          </button>
          <button
            type="button"
            className="panel-top-btn"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            <RefreshCw size={17} className={refreshing ? 'spin' : ''} aria-hidden="true" />
            <span>Actualizar</span>
          </button>
          {session.authRequired ? (
            <button
              type="button"
              className="panel-top-btn"
              onClick={() => void handleLogout()}
              title={`Cerrar sesión de ${session.user ?? 'la red de salud'}`}
            >
              <LogOut size={17} aria-hidden="true" />
              <span>Salir</span>
            </button>
          ) : null}
        </div>
      </header>

      <main className="panel-main">
        <section className="panel-hero">
          <div>
            <p className="panel-kicker">Red de salud · Amazonía</p>
            <h1>Alertas de emergencia</h1>
            <p className="panel-lead">
              Las alertas llegan cuando el teléfono recupera conexión. Confirma antes del plazo; si
              vence, el panel la marca como vencida y permite escalar por SMS o llamada.
            </p>
          </div>
          <div className="panel-updated">
            <span>Última actualización</span>
            <strong>{lastUpdated ? formatTime(lastUpdated.toISOString()) : '—'}</strong>
            <span>{lastUpdated ? formatRelative(lastUpdated.toISOString()) : 'Conectando…'}</span>
          </div>
        </section>

        <section className="panel-stats" aria-label="Resumen de alertas">
          <div className="panel-stat panel-stat--amber">
            <span className="panel-stat-label">En plazo</span>
            <strong>{awaiting.length}</strong>
            <span className="panel-stat-hint">Esperando confirmación</span>
          </div>
          <div className="panel-stat panel-stat--red">
            <span className="panel-stat-label">Vencidas</span>
            <strong>{overdue.length}</strong>
            <span className="panel-stat-hint">Sin confirmar en el plazo</span>
          </div>
          <div className="panel-stat panel-stat--green">
            <span className="panel-stat-label">Recibidas</span>
            <strong>{received.length}</strong>
            <span className="panel-stat-hint">Confirmadas desde el panel</span>
          </div>
          <div className="panel-stat panel-stat--teal">
            <span className="panel-stat-label">Alertas hoy</span>
            <strong>{todayCount}</strong>
            <span className="panel-stat-hint">Recibidas por el servidor</span>
          </div>
        </section>

        {error ? (
          <div className="panel-error" role="alert">
            <TriangleAlert size={20} aria-hidden="true" />
            <div>
              <strong>No se puede conectar con el servidor</strong>
              <p>Se muestran los últimos datos recibidos. Reintentando automáticamente cada 5 s.</p>
            </div>
            <button type="button" onClick={() => void load(true)}>
              Reintentar
            </button>
          </div>
        ) : null}

        <section className="panel-list-section" aria-label="Lista de alertas">
          <div className="panel-list-head">
            <div className="panel-filters" role="tablist" aria-label="Filtrar alertas">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  className={`panel-filter ${filter === item.id ? 'is-active' : ''}`}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label} <span>{item.count}</span>
                </button>
              ))}
            </div>
            <span className="panel-count">
              {filtered.length} {filtered.length === 1 ? 'alerta' : 'alertas'}
            </span>
          </div>

          {loading ? (
            <div className="panel-skeleton-list" aria-label="Cargando alertas">
              <div className="panel-skeleton" />
              <div className="panel-skeleton" />
              <div className="panel-skeleton" />
            </div>
          ) : filtered.length > 0 ? (
            <div className="panel-list">
              {filtered.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  acking={acking === alert.id}
                  onAck={(id) => void acknowledge(id)}
                  onOpen={setSelectedId}
                />
              ))}
            </div>
          ) : (
            <div className="panel-empty">
              <span>
                <Inbox size={28} aria-hidden="true" />
              </span>
              <h2>
                {filter === 'pending'
                  ? 'No hay alertas en plazo'
                  : filter === 'overdue'
                    ? 'No hay alertas vencidas'
                    : filter === 'received'
                      ? 'Todavía no se confirmó ninguna alerta'
                      : 'No hay alertas recibidas'}
              </h2>
              <p>
                Cuando una comunidad envíe una emergencia y el teléfono recupere conexión, la alerta
                aparecerá aquí automáticamente.
              </p>
            </div>
          )}
        </section>

        <footer className="panel-foot">
          {!session.authRequired ? (
            <p className="panel-demo-warning">
              <TriangleAlert size={15} aria-hidden="true" /> Panel sin contraseña (modo
              demostración). Define MANGUARE_PANEL_PASSWORD antes de exponerlo.
            </p>
          ) : null}
          <p>
            <ShieldCheck size={15} aria-hidden="true" /> Prototipo Manguaré MVP · Datos de
            demostración del piloto.
          </p>
          <p>
            <MapPin size={15} aria-hidden="true" /> La ubicación exacta solo debe compartirse con el
            personal que responde.
          </p>
        </footer>
      </main>

      <AlertModal
        alert={selected}
        acking={selected ? acking === selected.id : false}
        responding={responding}
        escalationPhone={session.config?.escalationPhone ?? ''}
        onClose={() => setSelectedId(null)}
        onAck={(id) => void acknowledge(id)}
        onRespond={(id, code, message) => void respond(id, code, message)}
        onEscalate={(id, channel) => void escalate(id, channel)}
      />

      {toast ? (
        <div className={`panel-toast ${toast.tone === 'error' ? 'is-error' : ''}`} role="status">
          {toast.tone === 'error' ? (
            <TriangleAlert size={18} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={18} aria-hidden="true" />
          )}
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Cerrar aviso">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
