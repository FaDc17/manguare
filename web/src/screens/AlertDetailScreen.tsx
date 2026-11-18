import { useMemo, useState } from 'react';
import {
  Ban,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldCheck,
  TriangleAlert,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../app/AppContext';
import { Sheet } from '../components/Sheet';
import { StatusChip } from '../components/StatusChip';
import { SubHeader } from '../components/SubHeader';
import { EMERGENCY_META } from '../lib/emergency';
import {
  formatCoords,
  formatDateTime,
  formatRelative,
  shortId,
  STATE_DESCRIPTION,
  STATE_LABEL,
} from '../lib/format';
import { copyText, buildSmsBody, smsHref } from '../lib/sms';
import { deadlineText, isOverdue, responseText } from '../lib/sla';
import type { AlertState } from '../lib/types';

const STATE_ICON = {
  pending: Clock3,
  sent: Send,
  received: CheckCircle2,
  canceled: X,
} as const;

function osmLinks(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
}

export function AlertDetailScreen({
  id,
  onBack,
  onHistory,
}: {
  id: string;
  onBack: () => void;
  onHistory: () => void;
}) {
  const {
    alerts,
    loading,
    online,
    syncing,
    syncNow,
    settings,
    markSms,
    cancelAlert,
    showToast,
  } = useApp();
  const [showCoords, setShowCoords] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const alert = alerts.find((item) => item.id === id);

  const smsBody = useMemo(() => (alert ? buildSmsBody(alert) : ''), [alert]);

  if (!alert) {
    return (
      <div className="screen">
        <SubHeader title="Alerta" onBack={onBack} />
        <div className="screen-pad">
          {loading ? (
            <div className="inline-loading">
              <LoaderCircle size={20} className="spin" aria-hidden="true" /> Cargando alerta…
            </div>
          ) : (
            <div className="empty-state">
              <h3>No encontramos esta alerta</h3>
              <p>Puede que se haya borrado de este teléfono.</p>
              <button type="button" className="btn btn-secondary" onClick={onHistory}>
                Ver mis alertas
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const meta = EMERGENCY_META[alert.type];
  const Icon = meta.icon;
  const StateIcon = STATE_ICON[alert.state as AlertState];
  const isPending = alert.state === 'pending';
  const isReceived = alert.state === 'received';
  const overdue = isOverdue(alert);
  const deadline = deadlineText(alert);
  const latestResponse = alert.responses?.at(-1);
  const awaitingConfirmation = alert.state === 'sent' && !alert.acknowledgedAt;

  const steps = [
    {
      label: 'Guardada en el teléfono',
      detail: 'Queda en este teléfono aunque cierres la app.',
      time: alert.createdAt,
      done: true,
    },
    {
      label: 'Enviada a Manguaré',
      detail: 'Llegó al servidor que recibe las alertas.',
      time: alert.serverReceivedAt,
      done: Boolean(alert.serverReceivedAt),
    },
    {
      label: 'Recibida por la red de salud',
      detail: 'Alguien de la red confirmó que la recibió.',
      time: alert.acknowledgedAt,
      done: Boolean(alert.acknowledgedAt),
    },
  ];
  const currentStep = steps.findIndex((item) => !item.done);

  return (
    <div className="screen detail">
      <SubHeader
        title="Estado de la alerta"
        subtitle={`Ref. ${shortId(alert.id)}`}
        onBack={onBack}
        right={<StatusChip state={alert.state} compact />}
      />

      <div className={`status-hero status-hero--${alert.state}`}>
        <span className="status-hero-icon">
          <StateIcon size={30} aria-hidden="true" />
        </span>
        <div className="status-hero-copy">
          <span className="status-kicker">Estado actual</span>
          <h1 data-testid="alert-state">{STATE_LABEL[alert.state]}</h1>
          <p>{STATE_DESCRIPTION[alert.state]}</p>
        </div>
        <span className={`status-orb status-orb--${alert.state}`} aria-hidden="true">
          {isPending && online ? <span className="pulse-dot" /> : null}
        </span>
      </div>

      {isPending ? (
        <div className={`banner ${online ? 'banner-info' : 'banner-warn'}`}>
          {online ? <RefreshCw size={19} aria-hidden="true" /> : <WifiOff size={19} aria-hidden="true" />}
          <div>
            <strong>
              {online ? 'Hay conexión: puedes reintentar el envío' : 'Aún no sale de tu teléfono'}
            </strong>
            <p>
              {online
                ? 'La app reintenta automáticamente. También puedes forzar un intento ahora.'
                : 'No hay conexión. La alerta se enviará sola cuando vuelva la señal.'}
            </p>
          </div>
        </div>
      ) : null}

      {awaitingConfirmation ? (
        <div className={`banner ${overdue ? 'banner-warn' : 'banner-info'}`}>
          {overdue ? (
            <TriangleAlert size={19} aria-hidden="true" />
          ) : (
            <Clock3 size={19} aria-hidden="true" />
          )}
          <div>
            <strong>
              {overdue
                ? 'Plazo de confirmación vencido'
                : `La red tiene hasta ${deadline ?? 'su plazo'} para confirmar`}
            </strong>
            <p>
              {overdue
                ? `La red no confirmó en el plazo. ${
                    alert.escalatedAt ? 'La alerta fue escalada. ' : ''
                  }Puedes avisar por SMS o llamar al 106 mientras sigues esperando.`
                : 'Si no confirma a tiempo, la alerta se marca como vencida y el panel puede escalarla.'}
            </p>
          </div>
        </div>
      ) : null}

      {alert.lastError ? (
        <details className="tech-details">
          <summary>Detalles técnicos del último intento</summary>
          <p>Intentos de envío: {alert.attempts}</p>
          <p>Error: {alert.lastError}</p>
        </details>
      ) : null}

      <section className="card timeline-card">
        <h2 className="card-title">Recorrido de la alerta</h2>
        <ol className="timeline">
          {steps.map((item, index) => {
            const isCurrent = index === currentStep;
            return (
              <li
                key={item.label}
                className={`timeline-step ${item.done ? 'is-done' : ''} ${
                  isCurrent ? 'is-current' : ''
                }`}
              >
                <span className="timeline-dot">
                  {item.done ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </span>
                <div className="timeline-copy">
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                  {item.time ? (
                    <time dateTime={item.time}>
                      {formatDateTime(item.time)} · {formatRelative(item.time)}
                    </time>
                  ) : (
                    <span className="timeline-pending">
                      {isCurrent && isPending && !online ? 'Esperando señal' : 'Pendiente'}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {!isReceived ? (
        alert.state === 'canceled' ? (
          <div className="banner banner-warn">
            <X size={19} aria-hidden="true" />
            <div>
              <strong>Alerta anulada en este teléfono</strong>
              <p>No se envió a la red de salud. Puedes crear una alerta nueva si la necesitas.</p>
            </div>
          </div>
        ) : (
        <section className="card sms-card">
          <div className="sms-head">
            <span className="sms-icon">
              <MessageSquareText size={21} aria-hidden="true" />
            </span>
            <div>
              <h2 className="card-title">¿Tienes señal para SMS?</h2>
              <p>
                Puedes avisar también por mensaje de texto al número de respaldo. El SMS no confirma
                la entrega; Manguaré seguirá intentando enviar la alerta por internet.
              </p>
            </div>
          </div>
          {alert.smsOpenedAt ? (
            <p className="sms-opened">
              Abriste la app de mensajes {formatRelative(alert.smsOpenedAt)}. No podemos confirmar si
              el SMS se envió.
            </p>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={() => setSmsOpen(true)}>
            <MessageSquareText size={18} aria-hidden="true" /> Avisar por SMS
          </button>
        </section>
        )
      ) : (
        <div className="banner banner-ok">
          <ShieldCheck size={19} aria-hidden="true" />
          <div>
            <strong>Confirmación recibida</strong>
            <p>
              {alert.acknowledgedAt
                ? `La red de salud confirmó esta alerta el ${formatDateTime(alert.acknowledgedAt)}.`
                : 'La red de salud confirmó esta alerta.'}
            </p>
          </div>
        </div>
      )}

      {latestResponse ? (
        <section className="card response-card">
          <div className="response-head">
            <span className="response-icon">
              <MessageSquareText size={20} aria-hidden="true" />
            </span>
            <div>
              <span className="response-kicker">Respuesta de la red de salud</span>
              <strong>{responseText(latestResponse)}</strong>
              <span className="response-meta">
                {formatDateTime(latestResponse.at)}
                {latestResponse.by ? ` · ${latestResponse.by}` : ''}
              </span>
            </div>
          </div>
          {alert.responses && alert.responses.length > 1 ? (
            <ol className="response-history">
              {alert.responses
                .slice(0, -1)
                .reverse()
                .map((response) => (
                  <li key={`${response.at}-${response.code}`}>
                    <span>{responseText(response)}</span>
                    <time dateTime={response.at}>{formatRelative(response.at)}</time>
                  </li>
                ))}
            </ol>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <h2 className="card-title">Datos de la alerta</h2>
        <div className="detail-type">
          <span className={`type-tile type-tile--${meta.tone}`}>
            <Icon size={23} aria-hidden="true" />
          </span>
          <div>
            <strong>{meta.label}</strong>
            <span>{formatDateTime(alert.createdAt)}</span>
          </div>
        </div>

        <dl className="detail-list">
          <div>
            <dt>Detalle</dt>
            <dd>{alert.note || 'Sin detalle'}</dd>
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
            <dt>Ubicación</dt>
            <dd>
              {alert.location && alert.consentLocation ? (
                <>
                  <span className="location-line">
                    <MapPin size={15} aria-hidden="true" /> GPS adjunto (±
                    {alert.location.accuracy} m)
                  </span>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => setShowCoords((value) => !value)}
                  >
                    {showCoords ? 'Ocultar coordenadas' : 'Ver coordenadas'}
                  </button>
                  {showCoords ? (
                    <span className="coords">
                      {formatCoords(alert.location.lat, alert.location.lng)}
                      <a
                        href={osmLinks(alert.location.lat, alert.location.lng)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver mapa <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    </span>
                  ) : null}
                </>
              ) : (
                'Sin ubicación GPS'
              )}
            </dd>
          </div>
          <div>
            <dt>Foto</dt>
            <dd>
              {alert.photo ? (
                <>
                  <span className="location-line">
                    <ImageIcon size={15} aria-hidden="true" /> Adjunta y comprimida
                  </span>
                  <a className="photo-link" href={alert.photo} target="_blank" rel="noreferrer">
                    <img src={alert.photo} alt="Foto adjunta a la emergencia" />
                  </a>
                </>
              ) : (
                'Sin foto'
              )}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          className="reference-row"
          onClick={() => {
            void copyText(alert.id).then((ok) =>
              showToast(ok ? 'Referencia copiada.' : 'No se pudo copiar.', ok ? 'ok' : 'error'),
            );
          }}
        >
          <span>
            Referencia <strong>{shortId(alert.id)}</strong>
          </span>
          <Copy size={16} aria-hidden="true" />
        </button>
      </section>

      <p className="privacy-note">
        <ShieldCheck size={16} aria-hidden="true" /> La ubicación y la foto se comparten solo con la
        red de salud. No se muestran públicamente.
      </p>

      <div className="detail-actions">
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="refresh-status"
          onClick={() => void syncNow(true)}
          disabled={syncing}
        >
          <RefreshCw size={18} className={syncing ? 'spin' : ''} aria-hidden="true" />
          {syncing ? 'Actualizando…' : 'Actualizar estado'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onHistory}>
          Ver todas las alertas
        </button>
        {isPending && !alert.serverReceivedAt ? (
          <button type="button" className="btn btn-danger-ghost" onClick={() => setCancelOpen(true)}>
            <Ban size={17} aria-hidden="true" /> Anular alerta
          </button>
        ) : null}
      </div>

      <Sheet open={cancelOpen} title="Anular alerta" onClose={() => setCancelOpen(false)}>
        <p className="sheet-intro">
          Esta alerta todavía no salió del teléfono. Si la anulas, se quedará en el historial como
          anulada y no se enviará a la red de salud.
        </p>
        <div className="notice-box">
          <strong>No se puede deshacer</strong>
          <p>Si la emergencia sigue, crea una alerta nueva en lugar de esperar.</p>
        </div>
        <div className="sheet-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCancelOpen(false)}
          >
            Conservar alerta
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              void cancelAlert(alert.id).then((ok) => {
                setCancelOpen(false);
                if (ok) onHistory();
              });
            }}
          >
            <Ban size={18} aria-hidden="true" /> Sí, anular
          </button>
        </div>
      </Sheet>

      <Sheet open={smsOpen} title="Avisar por SMS" onClose={() => setSmsOpen(false)}>
        <p className="sheet-intro">
          Se abrirá la app de mensajes de tu teléfono con este texto. Envíalo al número de respaldo
          del promotor o puesto de salud.
        </p>
        <div className="sms-preview">
          <span>{smsBody}</span>
          <button
            type="button"
            onClick={() => {
              void copyText(smsBody).then((ok) =>
                showToast(ok ? 'Mensaje copiado.' : 'No se pudo copiar.', ok ? 'ok' : 'error'),
              );
            }}
          >
            <Copy size={15} aria-hidden="true" /> Copiar
          </button>
        </div>
        <div className="sms-number">
          <span>Número de respaldo</span>
          <strong>{settings.smsNumber || 'No configurado'}</strong>
        </div>
        {settings.smsNumber ? (
          <a
            className="btn btn-primary btn-block"
            href={smsHref(settings.smsNumber, smsBody)}
            onClick={() => void markSms(alert.id)}
          >
            <MessageSquareText size={18} aria-hidden="true" /> Abrir app de mensajes
          </a>
        ) : (
          <div className="notice-box">
            <strong>Configura un número de prueba</strong>
            <p>Ve a Ajustes y escribe el número del promotor o puesto de salud para la demo.</p>
          </div>
        )}
        <p className="sheet-footnote">
          El SMS no nos confirma la entrega. La alerta por internet seguirá en cola hasta que la red
          de salud la reciba.
        </p>
      </Sheet>
    </div>
  );
}
