import { useMemo, useRef, useState } from 'react';
import {
  Camera,
  Ban,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  ImagePlus,
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
import { LocationPicker } from '../components/LocationPicker';
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
import { compressImage } from '../lib/photo';
import type { AlertLocation, AlertState } from '../lib/types';

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
    updateAlertDetails,
    markSms,
    cancelAlert,
    showToast,
  } = useApp();
  const [showCoords, setShowCoords] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsNote, setDetailsNote] = useState('');
  const [detailsCommunity, setDetailsCommunity] = useState('');
  const [detailsLocation, setDetailsLocation] = useState<AlertLocation>();
  const [detailsPhoto, setDetailsPhoto] = useState<string>();
  const [detailsError, setDetailsError] = useState('');
  const detailsFileRef = useRef<HTMLInputElement>(null);
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
  const stateLabel = alert.isSos && isReceived ? 'Leída' : STATE_LABEL[alert.state];
  const stateDescription =
    alert.isSos && isReceived
      ? 'La red de salud ya leyó la alerta.'
      : STATE_DESCRIPTION[alert.state];

  const saveDetails = async () => {
    if (detailsSaving) return;
    setDetailsSaving(true);
    setDetailsError('');
    try {
      await updateAlertDetails(alert.id, {
        note: detailsNote.trim() || 'Alerta SOS',
        community: detailsCommunity.trim(),
        location: detailsLocation,
        photo: detailsPhoto,
      });
      setDetailsOpen(false);
      showToast(
        online
          ? 'Detalle agregado a la misma alerta.'
          : 'Detalle guardado; se enviará al recuperar conexión.',
        online ? 'ok' : 'warn',
      );
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : 'No se pudo guardar el detalle.');
    } finally {
      setDetailsSaving(false);
    }
  };

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
      label: alert.isSos ? 'Leída por la red de salud' : 'Recibida por la red de salud',
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
        right={
          <StatusChip
            state={alert.state}
            compact
            label={alert.isSos && isReceived ? 'Leída' : undefined}
          />
        }
      />

      <div className={`status-hero status-hero--${alert.state}`}>
        <span className="status-hero-icon">
          <StateIcon size={30} aria-hidden="true" />
        </span>
        <div className="status-hero-copy">
          <span className="status-kicker">Estado actual</span>
          <h1 data-testid="alert-state">{stateLabel}</h1>
          <p>{stateDescription}</p>
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

      {alert.isSos ? (
        <section className="card sos-detail-card">
          <div>
            <span className="review-kicker">Alerta SOS</span>
            <h2>{alert.note === 'Alerta SOS' ? 'Alerta mínima enviada' : 'Detalle de tu alerta'}</h2>
            <p>
              {alert.serverReceivedAt
                ? `Enviada ${formatDateTime(alert.serverReceivedAt)}.`
                : 'La alerta se conserva en este teléfono hasta recuperar conexión.'}
            </p>
          </div>
          {alert.state !== 'canceled' ? (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              data-testid="sos-detail-open"
              onClick={() => {
                setDetailsNote(alert.note === 'Alerta SOS' ? '' : alert.note);
                setDetailsCommunity(alert.community);
                setDetailsLocation(alert.location);
                setDetailsPhoto(alert.photo);
                setDetailsError('');
                setDetailsOpen(true);
              }}
            >
              <ImagePlus size={18} aria-hidden="true" />
              {alert.note === 'Alerta SOS' && !alert.photo && !alert.location
                ? 'Enviar detalle'
                : 'Agregar o editar detalle'}
            </button>
          ) : null}
        </section>
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

      <Sheet
        open={detailsOpen}
        title="Completar alerta SOS"
        onClose={() => {
          if (!detailsSaving) setDetailsOpen(false);
        }}
        footer={
          <button
            type="button"
            className="btn btn-primary btn-block"
            data-testid="sos-detail-save"
            disabled={detailsSaving}
            onClick={() => void saveDetails()}
          >
            {detailsSaving ? 'Guardando…' : 'Guardar detalle'}
          </button>
        }
      >
        <p className="sheet-intro">
          La alerta ya existe. Estos datos se agregarán a la misma alerta, no crearán otra.
        </p>
        <label className="field">
          <span className="field-label">Referencia de ubicación</span>
          <input
            value={detailsCommunity}
            data-testid="sos-detail-reference"
            onChange={(event) => setDetailsCommunity(event.target.value)}
            placeholder="Comunidad, río o punto conocido"
            maxLength={80}
          />
        </label>
        <div className="field">
          <span className="field-label">Confirma o ajusta la ubicación</span>
          <LocationPicker value={detailsLocation} onChange={setDetailsLocation} />
          {detailsLocation ? (
            <button type="button" className="text-btn" onClick={() => setDetailsLocation(undefined)}>
              Quitar ubicación
            </button>
          ) : null}
          <small className="field-help">La ubicación solo se envía al servidor de alertas.</small>
        </div>
        <label className="field">
          <span className="field-label">Descripción (opcional)</span>
          <textarea
            value={detailsNote}
            data-testid="sos-detail-description"
            onChange={(event) => setDetailsNote(event.target.value)}
            placeholder="Agrega información útil para quienes te ayudarán."
            rows={3}
            maxLength={1000}
          />
        </label>
        <div className="field">
          <span className="field-label">Imagen (opcional)</span>
          <input
            ref={detailsFileRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              void compressImage(file)
                .then((image) => {
                  setDetailsPhoto(image);
                  setDetailsError('');
                })
                .catch((error: unknown) =>
                  setDetailsError(error instanceof Error ? error.message : 'No se pudo procesar la imagen.'),
                );
            }}
          />
          {detailsPhoto ? (
            <div className="photo-preview">
              <img src={detailsPhoto} alt="Imagen adjunta al SOS" />
              <button
                type="button"
                className="photo-remove"
                onClick={() => setDetailsPhoto(undefined)}
                aria-label="Quitar imagen"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="photo-add"
              onClick={() => detailsFileRef.current?.click()}
            >
              <Camera size={20} aria-hidden="true" /> Adjuntar imagen
            </button>
          )}
        </div>
        {detailsError ? <p className="field-error" role="alert">{detailsError}</p> : null}
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
