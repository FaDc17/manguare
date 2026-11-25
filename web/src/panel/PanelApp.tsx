// Traduce los avisos, filtros y estados visibles del panel de salud.

import { LocalizedText, useTranslation } from '../i18n/LanguageContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
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
  MapPinned,
  MapPin,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  X,
} from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import { LanguageSelect } from '../components/LanguageSelect';
import type { MessageKey } from '../i18n/catalog';
import { EMERGENCY_META, SOS_DEFAULT_NOTE } from '../lib/emergency';
import { formatDateTime, formatRelative, formatTime, shortId } from '../lib/format';
import { responseLabel, translatedResponse } from '../i18n/labels';
import { emergencyMapPlaces, type MapPlace } from '../lib/map-data';
import { RESPONSE_OPTIONS } from '../lib/sla';
import type { ServerAlert } from '../lib/types';
import { StatisticsSection } from './StatisticsSection';
import 'leaflet/dist/leaflet.css';

type PanelFilter = 'all' | 'pending' | 'overdue' | 'received';
type PanelView = 'alerts' | 'map';

interface PanelToastState {
  message: MessageKey;
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
  const { t } = useTranslation();
  if (alert.acknowledgedAt) {
    return (
      <span className="panel-status is-received">
        <CheckCircle2 size={14} aria-hidden="true" />{' '}{t('status.received')}
      </span>
    );
  }
  if (isServerOverdue(alert)) {
    return (
      <span className="panel-status is-overdue">
        <TriangleAlert size={14} aria-hidden="true" />{' '}{t('panel.vencida')}
      </span>
    );
  }
  return (
    <span className="panel-status is-pending">
      <Clock3 size={14} aria-hidden="true" />{' '}{t('panel.porConfirmar')}
    </span>
  );
}

function PanelMapBounds({ places }: { places: MapPlace[] }) {
  const map = useMap();
  const signature = places.map((place) => `${place.id}:${place.coordinates.lat}:${place.coordinates.lng}`).join('|');
  useEffect(() => {
    if (places.length === 1) {
      const [place] = places;
      map.flyTo([place.coordinates.lat, place.coordinates.lng], 13, { duration: 0.4 });
    } else if (places.length > 1) {
      map.fitBounds(places.map((place) => [place.coordinates.lat, place.coordinates.lng]), {
        padding: [28, 28],
        maxZoom: 12,
      });
    }
  }, [map, signature]);
  return null;
}

function PanelEmergencyMap({ alerts }: { alerts: ServerAlert[] }) {
  const { t } = useTranslation();
  const places = useMemo(() => emergencyMapPlaces(alerts, t), [alerts, t]);
  return (
    <div className="panel-emergency-map">
      <MapContainer
        className="panel-emergency-map-canvas"
        center={[-5.0, -77.95]}
        zoom={7}
        zoomControl
        scrollWheelZoom
        aria-label={t('panel.mapaEmergencias')}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <PanelMapBounds places={places} />
        {places.map((place) => (
          <CircleMarker
            key={place.id}
            center={[place.coordinates.lat, place.coordinates.lng]}
            radius={9}
            pathOptions={{ color: '#fff', fillColor: '#b3261e', fillOpacity: 0.95, weight: 3 }}
          >
            <Popup>
              <strong>{place.name}</strong>
              <br />
              {t(place.category)}
              {place.location ? <><br />{place.location}</> : null}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {places.length === 0 ? (
        <p className="panel-map-empty" role="status">{t('panel.mapaSinUbicacionesDisponibles')}</p>
      ) : null}
    </div>
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
  const { t } = useTranslation();
  const meta = EMERGENCY_META[alert.type];
  const Icon = alert.isSos ? TriangleAlert : meta.icon;
  const tone = alert.isSos ? 'red' : meta.tone;

  return (
    <article
      className={`panel-row ${alert.acknowledgedAt ? 'is-received' : 'is-unconfirmed'} ${
        isServerOverdue(alert) ? 'is-overdue' : ''
      }`}
    >
      <span className={`type-tile type-tile--${tone}`}>
        <Icon size={23} aria-hidden="true" />
      </span>
      <div className="panel-row-main">
        <div className="panel-row-title">
          <strong>{alert.isSos ? 'SOS' : <LocalizedText id={`emergency.${alert.type}`} />}</strong>
          {alert.community ? <span className="panel-row-community">{alert.community}</span> : null}
          {!alert.acknowledgedAt ? <span className="panel-new">{t('panel.nueva')}</span> : null}
        </div>
        <p className="panel-row-note">{alert.isSos && alert.note === SOS_DEFAULT_NOTE ? t('sos.title') : alert.note || t('panel.sinDetalleAdicional')}</p>
        <p className="panel-row-meta">
          <span>{formatRelative(alert.clientCreatedAt, t)}</span>
          <span>{alert.deviceName || t('panel.equipoNoIndicado')}</span>
          {alert.reportedBy ? <span>{t('panel.reporto')}{' '}{alert.reportedBy}</span> : null}
          <span>
            {alert.location ? t('panel.gpsM', { accuracy: alert.location.accuracy }) : t('panel.sinGps')}
          </span>
          {alert.photo ? (
            <span>
              <ImageIcon size={13} aria-hidden="true" />{' '}{t('common.photo')}
            </span>
          ) : null}
          {!alert.acknowledgedAt && alert.ackDeadlineAt ? (
            <span className={isServerOverdue(alert) ? 'panel-late' : ''}>
              {isServerOverdue(alert)
                ? t('panel.vencida2', { relativeTime: formatRelative(alert.ackDeadlineAt, t) })
                : t('panel.plazo', { time: formatTime(alert.ackDeadlineAt, t) })}
            </span>
          ) : null}
          {alert.responses?.length ? (
            <span className="panel-response-flag">
              <MessageSquareText size={13} aria-hidden="true" />{' '}{t('panel.respuesta')}
            </span>
          ) : null}
          <span className="mono">{t('panel.ref')}{' '}{shortId(alert.id)}</span>
        </p>
      </div>
      <div className="panel-row-time">
        <time dateTime={alert.clientCreatedAt}>{formatTime(alert.clientCreatedAt, t)}</time>
        <span>{formatRelative(alert.clientCreatedAt, t)}</span>
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
            {t('panel.marcarRecibida')}
          </button>
        ) : null}
        <button type="button" className="panel-detail" onClick={() => onOpen(alert.id)}>
          {t('panel.verDetalle')}{' '}<ChevronRight size={14} aria-hidden="true" />
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
  const { t } = useTranslation();
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
      <div className="panel-modal" role="dialog" aria-modal="true" aria-label={t('panel.detalleDeLaAlerta')}>
        <header className="panel-modal-head">
          <div className="panel-modal-heading">
            <span className={`type-tile type-tile--${meta.tone}`}>
              <Icon size={24} aria-hidden="true" />
            </span>
            <div>
              <h2>{alert.isSos ? <LocalizedText id="sos.title" /> : <LocalizedText id={`emergency.${alert.type}`} />}</h2>
              <p>
                {alert.community || t('panel.comunidadNoIndicada')}{' '}{t('panel.ref2')}{' '}{shortId(alert.id)}
              </p>
            </div>
          </div>
          <div className="panel-modal-head-right">
            <PanelStatus alert={alert} />
            <button type="button" className="panel-icon-btn" onClick={onClose} aria-label={t('common.close')}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className={`panel-modal-body ${alert.photo ? 'has-photo' : ''}`}>
          <div className="panel-modal-info">
            <dl className="panel-detail-list">
              <div>
                <dt>{t('panel.detalle')}</dt>
                <dd>{alert.isSos && alert.note === SOS_DEFAULT_NOTE ? t('sos.title') : alert.note || t('panel.sinDetalleAdicional')}</dd>
              </div>
              <div>
                <dt>{t('common.community')}</dt>
                <dd>{alert.community || t('panel.noIndicada')}</dd>
              </div>
              <div>
                <dt>{t('panel.equipo')}</dt>
                <dd>{alert.deviceName || t('panel.noIndicado')}</dd>
              </div>
              <div>
                <dt>{t('panel.reportadoPor')}</dt>
                <dd>
                  {alert.reportedBy
                    ? `${alert.reportedBy}${alert.reporterPhone ? ` · ${alert.reporterPhone}` : ''}`
                    : t('panel.noIndicado')}
                </dd>
              </div>
              <div>
                <dt>{t('common.location')}</dt>
                <dd>
                  {alert.location ? (
                    <>
                      <span className="panel-coords">
                        {alert.location.lat.toFixed(5)}, {alert.location.lng.toFixed(5)} (±
                        {alert.location.accuracy} m)
                      </span>
                      {mapUrl ? (
                        <a className="panel-link" href={mapUrl} target="_blank" rel="noreferrer">
                          {t('panel.abrirMapa')}{' '}<ExternalLink size={13} aria-hidden="true" />
                        </a>
                      ) : null}
                    </>
                  ) : (
                    t('panel.sinGps')
                  )}
                </dd>
              </div>
              <div>
                <dt>{t('panel.recibidaPorManguare')}</dt>
                <dd>{formatDateTime(alert.serverReceivedAt, t)}</dd>
              </div>
              <div>
                <dt>{t('panel.confirmadaPorLaRed')}</dt>
                <dd>
                  {alert.acknowledgedAt
                    ? `${formatDateTime(alert.acknowledgedAt, t)}${
                        alert.acknowledgedBy ? ` · ${alert.acknowledgedBy}` : ''
                      }`
                    : t('panel.todaviaNoConfirmada')}
                </dd>
              </div>
              <div>
                <dt>{t('panel.plazoDeAcuse')}</dt>
                <dd>
                  {alert.ackDeadlineAt ? (
                    <span className={overdue ? 'panel-late' : ''}>
                      {formatDateTime(alert.ackDeadlineAt, t)}
                      {overdue ? t('panel.vencido') : ''}
                    </span>
                  ) : (
                    t('panel.sinPlazoDefinido')
                  )}
                </dd>
              </div>
              <div>
                <dt>{t('panel.escalamiento')}</dt>
                <dd>
                  {alert.escalatedAt
                    ? `${formatDateTime(alert.escalatedAt, t)}${
                        alert.escalationCount ? t('panel.veces', { escalationCount: alert.escalationCount }) : ''
                      }`
                    : t('panel.noEscalada')}
                </dd>
              </div>
              <div>
                <dt>{t('panel.enviadaDesdeElTelefono')}</dt>
                <dd>{formatDateTime(alert.clientCreatedAt, t)}</dd>
              </div>
              <div>
                <dt>{t('panel.consentimientoDeUbicacion')}</dt>
                <dd>{alert.consentLocation ? t('panel.siAutorizado') : t('panel.noAutorizado')}</dd>
              </div>
              <div className="panel-detail-id">
                <dt>{t('panel.referenciaCompleta')}</dt>
                <dd className="mono">{alert.id}</dd>
              </div>
            </dl>

            <div className="panel-responses">
              <h3>{t('panel.respuestaALaComunidad')}</h3>
              {alert.responses?.length ? (
                <ul className="panel-response-list">
                  {alert.responses.map((response) => (
                    <li key={`${response.at}-${response.code}`}>
                      <MessageSquareText size={14} aria-hidden="true" />
                      <span>
                        <strong>{translatedResponse(t, response)}</strong>
                        <small>
                          {formatDateTime(response.at, t)}
                          {response.by ? ` · ${response.by}` : ''}
                        </small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-response-empty">
                  {t('panel.todaviaNoSeEnvioUnaIndicacion')}
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
                    {t(responseLabel(option.code))}
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
                  placeholder={t('panel.otraIndicacionParaLaComunidad')}
                  onChange={(event) => setCustom(event.target.value)}
                />
                <button type="submit" disabled={responding !== null || !custom.trim()}>
                  {t('panel.enviar')}
                </button>
              </form>
            </div>
          </div>
          {alert.photo ? (
            <div className="panel-modal-photo">
              <span>{t('panel.fotoAdjunta')}</span>
              <a href={alert.photo} target="_blank" rel="noreferrer">
                <img src={alert.photo} alt={t('panel.fotoAdjuntaALaEmergencia')} />
              </a>
            </div>
          ) : null}
        </div>

        <footer className="panel-modal-foot">
          <p>
            <ShieldCheck size={15} aria-hidden="true" />{' '}{t('panel.laUbicacionEsUnDatoPersonal')}
          </p>
          {overdue ? (
            <div className="panel-escalate">
              <strong>
                <TriangleAlert size={15} aria-hidden="true" />{' '}{t('panel.plazoVencidoSinConfirmacion')}
              </strong>
              <a
                href={smsUrl}
                onClick={() => onEscalate(alert.id, cleanPhone ? 'sms' : 'llamada')}
              >
                <MessageSquareText size={15} aria-hidden="true" />
                {cleanPhone ? t('panel.abrirSmsDeEscalamiento') : t('panel.llamarAl106')}
              </a>
              <span>
                {alert.escalatedAt
                  ? t('panel.escalada', { relativeTime: formatRelative(alert.escalatedAt, t) })
                  : t('panel.elEscalamientoQuedaraRegistrado')}
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
                {t('panel.marcarComoRecibida')}
              </button>
            ) : null}
            <button type="button" className="panel-detail panel-detail--large" onClick={onClose}>
              {t('common.close')}
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
  error: MessageKey | null;
  onLogin: (user: string, password: string) => void;
}) {
  const { t } = useTranslation();
  const [user, setUser] = useState('salud');
  const [password, setPassword] = useState('');

  return (
    <div className="panel-page panel-login-page">
      <main className="panel-login">
        <div className="panel-login-brand">
          <BrandMark size={52} />
          <div>
            <span className="panel-brand-name">Manguaré</span>
            <span className="panel-brand-sub">{t('panel.panelDeLaRedDeSalud')}</span>
          </div>
        </div>

        <LanguageSelect />

        <div className="panel-login-card">
          <span className="panel-login-icon">
            <KeyRound size={24} aria-hidden="true" />
          </span>
          <h1>{t('panel.accesoRestringido')}</h1>
          <p>
            {t('panel.estePanelMuestraUbicacionesYDatos')}
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;
              onLogin(user, password);
            }}
          >
            <label>
              <span>{t('panel.usuario')}</span>
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
              <span>{t('panel.contrasena')}</span>
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
                <TriangleAlert size={16} aria-hidden="true" /> {t(error)}
              </p>
            ) : null}

            <button type="submit" className="panel-login-submit" data-testid="login-submit" disabled={busy}>
              {busy ? (
                <LoaderCircle size={18} className="spin" aria-hidden="true" />
              ) : (
                <LogIn size={18} aria-hidden="true" />
              )}
              {busy ? t('panel.ingresando') : t('panel.ingresarAlPanel')}
            </button>
          </form>

          <p className="panel-login-foot">
            <ShieldCheck size={15} aria-hidden="true" />{' '}{t('panel.laSesionDura12HorasSi')}
          </p>
        </div>
      </main>
    </div>
  );
}

export function PanelApp() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<ServerAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filter, setFilter] = useState<PanelFilter>('all');
  const [panelView, setPanelView] = useState<PanelView>('alerts');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [acking, setAcking] = useState<string | null>(null);
  const [responding, setResponding] = useState<string | null>(null);
  const [toast, setToast] = useState<PanelToastState | null>(null);
  const [session, setSession] = useState<PanelSessionState | null>(null);
  const [sessionError, setSessionError] = useState<MessageKey | null>(null);
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
          setError('panel.noSePuedeConectarConEl');
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
      const alertResponse = await fetch('/api/alerts', { cache: 'no-store' });
      if (alertResponse.status === 401) {
        setSession((current) => ({
          authRequired: true,
          authenticated: false,
          ...(current?.user ? { user: current.user } : {}),
        }));
        setAlerts([]);
        return;
      }
      if (!alertResponse.ok) throw new Error(`HTTP ${alertResponse.status}`);
      const data = (await alertResponse.json()) as { alerts?: ServerAlert[] };
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
      setError('panel.noSePuedeConectarConEl');
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
    document.title = pending.length > 0 ? t('panel.titlePending', { count: pending.length }) : t('panel.title');
  }, [pending.length, t]);

  useEffect(() => {
    return () => {
      document.title = t('panel.title');
    };
  }, [t]);

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
      setToast({ message: 'panel.alertaMarcadaComoRecibida', tone: 'ok' });
    } catch {
      setToast({
        message: 'panel.noSePudoMarcarLaAlerta',
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
      setToast({ message: 'panel.respuestaEnviadaYAlertaConfirmada', tone: 'ok' });
    } catch {
      setToast({ message: 'panel.noSePudoEnviarLaRespuesta', tone: 'error' });
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
      setToast({ message: 'panel.escalamientoRegistrado', tone: 'ok' });
    } catch {
      setToast({ message: 'panel.noSePudoRegistrarElEscalamiento', tone: 'error' });
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
            ? 'panel.demasiadosIntentosEsperaUnosMinutosAntes'
            : 'panel.usuarioOContrasenaIncorrectos',
        );
        return;
      }
      setSession({ authRequired: true, authenticated: true, user: data.user ?? user });
      setLoading(true);
      setError(null);
    } catch {
      setSessionError('panel.noSePudoConectarConEl');
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
      message: next ? 'panel.sonidoActivadoParaAlertasNuevas' : 'panel.sonidoDesactivado',
      tone: 'ok',
    });
  };

  const today = new Date().toDateString();
  const todayCount = alerts.filter(
    (alert) => new Date(alert.serverReceivedAt).toDateString() === today,
  ).length;

  const filters: Array<{ id: PanelFilter; label: string; count: number }> = [
    { id: 'all', label: t('panel.todas'), count: alerts.length },
    { id: 'pending', label: t('panel.enPlazo'), count: awaiting.length },
    { id: 'overdue', label: t('panel.vencidas'), count: overdue.length },
    { id: 'received', label: t('panel.recibidas'), count: received.length },
  ];

  if (!session) {
    return (
      <div className="panel-page panel-login-page">
        <main className="panel-login">
          <div className="panel-login-loading">
            <LoaderCircle size={22} className="spin" aria-hidden="true" />{' '}{t('panel.comprobandoSesion')}
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
            <span className="panel-brand-sub">{t('panel.panelDeLaRedDeSalud')}</span>
          </div>
        </div>
        <div className="panel-top-actions">
          <LanguageSelect />
          <span className={`panel-live ${error ? 'is-offline' : ''}`}>
            <span className="panel-live-dot" aria-hidden="true" />
            {error ? t('panel.sinServidor') : t('panel.enVivoCada5S')}
          </span>
          <button
            type="button"
            className="panel-top-btn"
            onClick={toggleSound}
            aria-pressed={soundOn}
            title={soundOn ? t('panel.desactivarSonido') : t('panel.activarSonido')}
          >
            {soundOn ? <Bell size={17} aria-hidden="true" /> : <BellOff size={17} aria-hidden="true" />}
            <span>{soundOn ? t('panel.sonido') : t('panel.silencio')}</span>
          </button>
          <button
            type="button"
            className="panel-top-btn"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            <RefreshCw size={17} className={refreshing ? 'spin' : ''} aria-hidden="true" />
            <span>{t('panel.actualizar')}</span>
          </button>
          {session.authRequired ? (
            <button
              type="button"
              className="panel-top-btn"
              onClick={() => void handleLogout()}
              title={session.user ? t('panel.cerrarSesionDe', { user: session.user }) : t('panel.logoutNetwork')}
            >
              <LogOut size={17} aria-hidden="true" />
              <span>{t('panel.salir')}</span>
            </button>
          ) : null}
        </div>
      </header>

      <main className="panel-main">
        <section className="panel-hero">
          <div>
            <p className="panel-kicker">{t('panel.redDeSaludAmazonia')}</p>
            <h1>{t('panel.alertasDeEmergencia')}</h1>
            <p className="panel-lead">
              {t('panel.lasAlertasLleganCuandoElTelefono')}
            </p>
          </div>
          <div className="panel-updated">
            <span>{t('panel.ultimaActualizacion')}</span>
            <strong>{lastUpdated ? formatTime(lastUpdated.toISOString(), t) : '—'}</strong>
            <span>{lastUpdated ? formatRelative(lastUpdated.toISOString(), t) : t('panel.conectando')}</span>
          </div>
        </section>

        <section className="panel-stats" aria-label={t('panel.resumenDeAlertas')}>
          <div className="panel-stat panel-stat--amber">
            <span className="panel-stat-label">{t('panel.enPlazo')}</span>
            <strong>{awaiting.length}</strong>
            <span className="panel-stat-hint">{t('panel.esperandoConfirmacion')}</span>
          </div>
          <div className="panel-stat panel-stat--red">
            <span className="panel-stat-label">{t('panel.vencidas')}</span>
            <strong>{overdue.length}</strong>
            <span className="panel-stat-hint">{t('panel.sinConfirmarEnElPlazo')}</span>
          </div>
          <div className="panel-stat panel-stat--green">
            <span className="panel-stat-label">{t('panel.recibidas')}</span>
            <strong>{received.length}</strong>
            <span className="panel-stat-hint">{t('panel.confirmadasDesdeElPanel')}</span>
          </div>
          <div className="panel-stat panel-stat--teal">
            <span className="panel-stat-label">{t('panel.alertasHoy')}</span>
            <strong>{todayCount}</strong>
            <span className="panel-stat-hint">{t('panel.recibidasPorElServidor')}</span>
          </div>
        </section>

        <nav className="panel-view-switch" role="tablist" aria-label={t('panel.alertasDeEmergencia')}>
          <button
            type="button"
            role="tab"
            aria-selected={panelView === 'alerts'}
            className={panelView === 'alerts' ? 'is-active' : ''}
            onClick={() => setPanelView('alerts')}
          >
            <Inbox size={16} aria-hidden="true" /> {t('panel.alertas')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panelView === 'map'}
            className={panelView === 'map' ? 'is-active' : ''}
            onClick={() => setPanelView('map')}
          >
            <MapPinned size={16} aria-hidden="true" /> {t('panel.mapaEmergencias')}
          </button>
        </nav>

        {error ? (
          <div className="panel-error" role="alert">
            <TriangleAlert size={20} aria-hidden="true" />
            <div>
              <strong>{t('panel.noSePuedeConectarConEl2')}</strong>
              <p>{t('panel.seMuestranLosUltimosDatosRecibidos')}</p>
            </div>
            <button type="button" onClick={() => void load(true)}>
              {t('common.retry')}
            </button>
          </div>
        ) : null}

        {panelView === 'alerts' ? (
        <section className="panel-list-section" aria-label={t('panel.listaDeAlertas')}>
          <div className="panel-list-head">
            <div className="panel-filters" role="tablist" aria-label={t('panel.filtrarAlertas')}>
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
            <div className="panel-skeleton-list" aria-label={t('panel.cargandoAlertas')}>
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
                  ? t('panel.noHayAlertasEnPlazo')
                  : filter === 'overdue'
                    ? t('panel.noHayAlertasVencidas')
                    : filter === 'received'
                      ? t('panel.todaviaNoSeConfirmoNingunaAlerta')
                      : t('panel.noHayAlertasRecibidas')}
              </h2>
              <p>
                {t('panel.cuandoUnaComunidadEnvieUnaEmergencia')}
              </p>
            </div>
          )}
        </section>
        ) : (
          <section className="panel-map-section" aria-label={t('panel.mapaEmergencias')}>
            <header className="panel-map-heading">
              <div>
                <h2>{t('panel.mapaEmergencias')}</h2>
                <p>{t('panel.mapaSoloUbicacionesConsentidas')}</p>
              </div>
              <span>{session.authRequired && session.authenticated ? emergencyMapPlaces(alerts, t).length : 0}</span>
            </header>
            {session.authRequired && session.authenticated ? (
              loading ? (
                <div className="panel-map-loading">{t('panel.cargandoAlertas')}</div>
              ) : (
                <PanelEmergencyMap alerts={alerts} />
              )
            ) : (
              <p className="panel-map-locked" role="note">{t('panel.mapaRequiereContrasena')}</p>
            )}
          </section>
        )}

        {session.authRequired ? (
          <StatisticsSection revision={alerts.map((alert) => `${alert.id}:${alert.acknowledgedAt ?? ''}`).join('|')} />
        ) : null}

        <footer className="panel-foot">
          {!session.authRequired ? (
            <p className="panel-demo-warning">
              <TriangleAlert size={15} aria-hidden="true" />{' '}{t('panel.panelSinContrasenaModoDemostracionDefine')}
            </p>
          ) : null}
          <p>
            <ShieldCheck size={15} aria-hidden="true" />{' '}{t('panel.prototipoManguareMvpDatosDeDemostracion')}
          </p>
          <p>
            <MapPin size={15} aria-hidden="true" />{' '}{t('panel.laUbicacionExactaSoloDebeCompartirse')}
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
          <span>{t(toast.message)}</span>
          <button type="button" onClick={() => setToast(null)} aria-label={t('common.closeNotice')}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
