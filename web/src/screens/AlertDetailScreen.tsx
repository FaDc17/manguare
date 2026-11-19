// Muestra las instrucciones y el seguimiento de la alerta en el idioma elegido.

import { LocalizedText, useTranslation } from '../i18n/LanguageContext';
import { InterfaceError } from '../i18n/catalog';
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
import { EMERGENCY_META, SOS_DEFAULT_NOTE } from '../lib/emergency';
import {
  formatCoords,
  formatDateTime,
  formatRelative,
  shortId,
} from '../lib/format';
import { copyText, buildSmsBody, smsHref } from '../lib/sms';
import { translatedResponse } from '../i18n/labels';
import { deadlineText, isOverdue } from '../lib/sla';
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
  const { t } = useTranslation();
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
        <SubHeader title={t('alertDetail.alerta')} onBack={onBack} />
        <div className="screen-pad">
          {loading ? (
            <div className="inline-loading">
              <LoaderCircle size={20} className="spin" aria-hidden="true" />{' '}{t('alertDetail.cargandoAlerta')}
            </div>
          ) : (
            <div className="empty-state">
              <h3>{t('alertDetail.noEncontramosEstaAlerta')}</h3>
              <p>{t('alertDetail.puedeQueSeHayaBorradoDe')}</p>
              <button type="button" className="btn btn-secondary" onClick={onHistory}>
                {t('alertDetail.verMisAlertas')}
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
  const stateLabel = alert.isSos && isReceived ? t('status.read') : t(`status.${alert.state}`);
  const stateDescription =
    alert.isSos && isReceived
      ? t('alertDetail.laRedDeSaludYaLeyo')
      : t(`status.description.${alert.state}`);

  const saveDetails = async () => {
    if (detailsSaving) return;
    setDetailsSaving(true);
    setDetailsError('');
    try {
      await updateAlertDetails(alert.id, {
        note: detailsNote.trim() || SOS_DEFAULT_NOTE,
        community: detailsCommunity.trim(),
        location: detailsLocation,
        photo: detailsPhoto,
      });
      setDetailsOpen(false);
      showToast(
        online
          ? t('alertDetail.detalleAgregadoALaMismaAlerta')
          : t('alertDetail.detalleGuardadoSeEnviaraAlRecuperar'),
        online ? 'ok' : 'warn',
      );
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : t('alertDetail.noSePudoGuardarElDetalle'));
    } finally {
      setDetailsSaving(false);
    }
  };

  const steps = [
    {
      label: t('alertDetail.guardadaEnElTelefono'),
      detail: t('alertDetail.quedaEnEsteTelefonoAunqueCierres'),
      time: alert.createdAt,
      done: true,
    },
    {
      label: t('alertDetail.enviadaAManguare'),
      detail: t('alertDetail.llegoAlServidorQueRecibeLas'),
      time: alert.serverReceivedAt,
      done: Boolean(alert.serverReceivedAt),
    },
    {
      label: alert.isSos ? t('alertDetail.leidaPorLaRedDeSalud') : t('alertDetail.recibidaPorLaRedDeSalud'),
      detail: t('alertDetail.alguienDeLaRedConfirmoQue'),
      time: alert.acknowledgedAt,
      done: Boolean(alert.acknowledgedAt),
    },
  ];
  const currentStep = steps.findIndex((item) => !item.done);

  return (
    <div className="screen detail">
      <SubHeader
        title={t('alertDetail.estadoDeLaAlerta')}
        subtitle={t('alertDetail.ref', { reference: shortId(alert.id) })}
        onBack={onBack}
        right={
          <StatusChip
            state={alert.state}
            compact
            label={alert.isSos && isReceived ? t('status.read') : undefined}
          />
        }
      />

      <div className={`status-hero status-hero--${alert.state}`}>
        <span className="status-hero-icon">
          <StateIcon size={30} aria-hidden="true" />
        </span>
        <div className="status-hero-copy">
          <span className="status-kicker">{t('alertDetail.estadoActual')}</span>
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
              {online ? t('alertDetail.hayConexionPuedesReintentarElEnvio') : t('alertDetail.aunNoSaleDeTuTelefono')}
            </strong>
            <p>
              {online
                ? t('alertDetail.laAppReintentaAutomaticamenteTambienPuedes')
                : t('alertDetail.noHayConexionLaAlertaSe')}
            </p>
          </div>
        </div>
      ) : null}

      {alert.isSos ? (
        <section className="card sos-detail-card">
          <div>
            <span className="review-kicker">{t('sos.title')}</span>
            <h2>{alert.note === SOS_DEFAULT_NOTE ? t('alertDetail.alertaMinimaEnviada') : t('alertDetail.detalleDeTuAlerta')}</h2>
            <p>
              {alert.serverReceivedAt
                ? t('alertDetail.enviada', { dateTime: formatDateTime(alert.serverReceivedAt, t) })
                : t('alertDetail.laAlertaSeConservaEnEste')}
            </p>
          </div>
          {alert.state !== 'canceled' ? (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              data-testid="sos-detail-open"
              onClick={() => {
                setDetailsNote(alert.note === SOS_DEFAULT_NOTE ? '' : alert.note);
                setDetailsCommunity(alert.community);
                setDetailsLocation(alert.location);
                setDetailsPhoto(alert.photo);
                setDetailsError('');
                setDetailsOpen(true);
              }}
            >
              <ImagePlus size={18} aria-hidden="true" />
              {alert.note === SOS_DEFAULT_NOTE && !alert.photo && !alert.location
                ? t('alertDetail.enviarDetalle')
                : t('alertDetail.agregarOEditarDetalle')}
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
                ? t('alertDetail.plazoDeConfirmacionVencido')
                : (deadline ? t('alertDetail.deadline', { deadline }) : t('alertDetail.deadlineUnspecified'))}
            </strong>
            <p>
              {overdue
                ? t(alert.escalatedAt ? 'alertDetail.escalated' : 'alertDetail.overdueAdvice')
                : t('alertDetail.siNoConfirmaATiempoLa')}
            </p>
          </div>
        </div>
      ) : null}

      {alert.lastError ? (
        <details className="tech-details">
          <summary>{t('alertDetail.detallesTecnicosDelUltimoIntento')}</summary>
          <p>{t('alertDetail.intentosDeEnvio')}{' '}{alert.attempts}</p>
          <p>{t('alertDetail.error')}{' '}{alert.lastError}</p>
        </details>
      ) : null}

      <section className="card timeline-card">
        <h2 className="card-title">{t('alertDetail.recorridoDeLaAlerta')}</h2>
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
                      {formatDateTime(item.time, t)} · {formatRelative(item.time, t)}
                    </time>
                  ) : (
                    <span className="timeline-pending">
                      {isCurrent && isPending && !online ? t('alertDetail.esperandoSenal') : t('status.pending')}
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
              <strong>{t('alertDetail.alertaAnuladaEnEsteTelefono')}</strong>
              <p>{t('alertDetail.noSeEnvioALaRed')}</p>
            </div>
          </div>
        ) : (
        <section className="card sms-card">
          <div className="sms-head">
            <span className="sms-icon">
              <MessageSquareText size={21} aria-hidden="true" />
            </span>
            <div>
              <h2 className="card-title">{t('alertDetail.tienesSenalParaSms')}</h2>
              <p>
                {t('alertDetail.puedesAvisarTambienPorMensajeDe')}
              </p>
            </div>
          </div>
          {alert.smsOpenedAt ? (
            <p className="sms-opened">
              {t('alertDetail.abristeLaAppDeMensajes')}{' '}{formatRelative(alert.smsOpenedAt, t)}{t('alertDetail.noPodemosConfirmarSiElSms')}
            </p>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={() => setSmsOpen(true)}>
            <MessageSquareText size={18} aria-hidden="true" />{' '}{t('alertDetail.avisarPorSms')}
          </button>
        </section>
        )
      ) : (
        <div className="banner banner-ok">
          <ShieldCheck size={19} aria-hidden="true" />
          <div>
            <strong>{t('alertDetail.confirmacionRecibida')}</strong>
            <p>
              {alert.acknowledgedAt
                ? t('alertDetail.laRedDeSaludConfirmoEsta', { dateTime: formatDateTime(alert.acknowledgedAt, t) })
                : t('alertDetail.laRedDeSaludConfirmoEsta2')}
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
              <span className="response-kicker">{t('alertDetail.respuestaDeLaRedDeSalud')}</span>
              <strong>{translatedResponse(t, latestResponse)}</strong>
              <span className="response-meta">
                {formatDateTime(latestResponse.at, t)}
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
                    <span>{translatedResponse(t, response)}</span>
                    <time dateTime={response.at}>{formatRelative(response.at, t)}</time>
                  </li>
                ))}
            </ol>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <h2 className="card-title">{t('alertDetail.datosDeLaAlerta')}</h2>
        <div className="detail-type">
          <span className={`type-tile type-tile--${meta.tone}`}>
            <Icon size={23} aria-hidden="true" />
          </span>
          <div>
            <strong><LocalizedText id={`emergency.${alert.type}`} /></strong>
            <span>{formatDateTime(alert.createdAt, t)}</span>
          </div>
        </div>

        <dl className="detail-list">
          <div>
            <dt>{t('alertDetail.detalle')}</dt>
            <dd>{alert.isSos && alert.note === SOS_DEFAULT_NOTE ? t('sos.title') : alert.note || t('alertDetail.sinDetalle')}</dd>
          </div>
          <div>
            <dt>{t('common.community')}</dt>
            <dd>{alert.community || t('alertDetail.noIndicada')}</dd>
          </div>
          <div>
            <dt>{t('alertDetail.equipo')}</dt>
            <dd>{alert.deviceName || t('alertDetail.noIndicado')}</dd>
          </div>
          <div>
            <dt>{t('common.location')}</dt>
            <dd>
              {alert.location && alert.consentLocation ? (
                <>
                  <span className="location-line">
                    <MapPin size={15} aria-hidden="true" />{' '}{t('alertDetail.gpsAdjunto')}
                    {alert.location.accuracy} m)
                  </span>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => setShowCoords((value) => !value)}
                  >
                    {showCoords ? t('alertDetail.ocultarCoordenadas') : t('alertDetail.verCoordenadas')}
                  </button>
                  {showCoords ? (
                    <span className="coords">
                      {formatCoords(alert.location.lat, alert.location.lng)}
                      <a
                        href={osmLinks(alert.location.lat, alert.location.lng)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('alertDetail.verMapa')}{' '}<ExternalLink size={12} aria-hidden="true" />
                      </a>
                    </span>
                  ) : null}
                </>
              ) : (
                t('alertDetail.sinUbicacionGps')
              )}
            </dd>
          </div>
          <div>
            <dt>{t('common.photo')}</dt>
            <dd>
              {alert.photo ? (
                <>
                  <span className="location-line">
                    <ImageIcon size={15} aria-hidden="true" />{' '}{t('alertDetail.adjuntaYComprimida')}
                  </span>
                  <a className="photo-link" href={alert.photo} target="_blank" rel="noreferrer">
                    <img src={alert.photo} alt={t('alertDetail.fotoAdjuntaALaEmergencia')} />
                  </a>
                </>
              ) : (
                t('alertDetail.sinFoto')
              )}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          className="reference-row"
          onClick={() => {
            void copyText(alert.id).then((ok) =>
              showToast(ok ? t('alertDetail.referenciaCopiada') : t('alertDetail.noSePudoCopiar'), ok ? 'ok' : 'error'),
            );
          }}
        >
          <span>
            {t('alertDetail.referencia')}{' '}<strong>{shortId(alert.id)}</strong>
          </span>
          <Copy size={16} aria-hidden="true" />
        </button>
      </section>

      <p className="privacy-note">
        <ShieldCheck size={16} aria-hidden="true" />{' '}{t('alertDetail.laUbicacionYLaFotoSe')}
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
          {syncing ? t('alertDetail.actualizando') : t('alertDetail.actualizarEstado')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onHistory}>
          {t('alertDetail.verTodasLasAlertas')}
        </button>
        {isPending && !alert.serverReceivedAt ? (
          <button type="button" className="btn btn-danger-ghost" onClick={() => setCancelOpen(true)}>
            <Ban size={17} aria-hidden="true" />{' '}{t('alertDetail.anularAlerta')}
          </button>
        ) : null}
      </div>

      <Sheet open={cancelOpen} title={t('alertDetail.anularAlerta')} onClose={() => setCancelOpen(false)}>
        <p className="sheet-intro">
          {t('alertDetail.estaAlertaTodaviaNoSalioDel')}
        </p>
        <div className="notice-box">
          <strong>{t('alertDetail.noSePuedeDeshacer')}</strong>
          <p>{t('alertDetail.siLaEmergenciaSigueCreaUna')}</p>
        </div>
        <div className="sheet-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCancelOpen(false)}
          >
            {t('alertDetail.conservarAlerta')}
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
            <Ban size={18} aria-hidden="true" />{' '}{t('alertDetail.siAnular')}
          </button>
        </div>
      </Sheet>

      <Sheet
        open={detailsOpen}
        title={t('alertDetail.completarAlertaSos')}
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
            {detailsSaving ? t('alertDetail.guardando') : t('alertDetail.guardarDetalle')}
          </button>
        }
      >
        <p className="sheet-intro">
          {t('alertDetail.laAlertaYaExisteEstosDatos')}
        </p>
        <label className="field">
          <span className="field-label">{t('alertDetail.referenciaDeUbicacion')}</span>
          <input
            value={detailsCommunity}
            data-testid="sos-detail-reference"
            onChange={(event) => setDetailsCommunity(event.target.value)}
            placeholder={t('alertDetail.comunidadRioOPuntoConocido')}
            maxLength={80}
          />
        </label>
        <div className="field">
          <span className="field-label">{t('alertDetail.confirmaOAjustaLaUbicacion')}</span>
          <LocationPicker value={detailsLocation} onChange={setDetailsLocation} />
          {detailsLocation ? (
            <button type="button" className="text-btn" onClick={() => setDetailsLocation(undefined)}>
              {t('alertDetail.quitarUbicacion')}
            </button>
          ) : null}
          <small className="field-help">{t('alertDetail.laUbicacionSoloSeEnviaAl')}</small>
        </div>
        <label className="field">
          <span className="field-label">{t('alertDetail.descripcionOpcional')}</span>
          <textarea
            value={detailsNote}
            data-testid="sos-detail-description"
            onChange={(event) => setDetailsNote(event.target.value)}
            placeholder={t('alertDetail.agregaInformacionUtilParaQuienesTe')}
            rows={3}
            maxLength={1000}
          />
        </label>
        <div className="field">
          <span className="field-label">{t('alertDetail.imagenOpcional')}</span>
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
                  setDetailsError(t(error instanceof InterfaceError ? error.key : 'alertDetail.noSePudoProcesarLaImagen')),
                );
            }}
          />
          {detailsPhoto ? (
            <div className="photo-preview">
              <img src={detailsPhoto} alt={t('alertDetail.imagenAdjuntaAlSos')} />
              <button
                type="button"
                className="photo-remove"
                onClick={() => setDetailsPhoto(undefined)}
                aria-label={t('alertDetail.quitarImagen')}
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
              <Camera size={20} aria-hidden="true" />{' '}{t('alertDetail.adjuntarImagen')}
            </button>
          )}
        </div>
        {detailsError ? <p className="field-error" role="alert">{detailsError}</p> : null}
      </Sheet>

      <Sheet open={smsOpen} title={t('alertDetail.avisarPorSms')} onClose={() => setSmsOpen(false)}>
        <p className="sheet-intro">
          {t('alertDetail.seAbriraLaAppDeMensajes')}
        </p>
        <div className="sms-preview">
          <span>{smsBody}</span>
          <button
            type="button"
            onClick={() => {
              void copyText(smsBody).then((ok) =>
                showToast(ok ? t('alertDetail.mensajeCopiado') : t('alertDetail.noSePudoCopiar'), ok ? 'ok' : 'error'),
              );
            }}
          >
            <Copy size={15} aria-hidden="true" />{' '}{t('alertDetail.copiar')}
          </button>
        </div>
        <div className="sms-number">
          <span>{t('alertDetail.numeroDeRespaldo')}</span>
          <strong>{settings.smsNumber || t('alertDetail.noConfigurado')}</strong>
        </div>
        {settings.smsNumber ? (
          <a
            className="btn btn-primary btn-block"
            href={smsHref(settings.smsNumber, smsBody)}
            onClick={() => void markSms(alert.id)}
          >
            <MessageSquareText size={18} aria-hidden="true" />{' '}{t('alertDetail.abrirAppDeMensajes')}
          </a>
        ) : (
          <div className="notice-box">
            <strong>{t('alertDetail.configuraUnNumeroDePrueba')}</strong>
            <p>{t('alertDetail.veAAjustesYEscribeEl')}</p>
          </div>
        )}
        <p className="sheet-footnote">
          {t('alertDetail.elSmsNoNosConfirmaLa')}
        </p>
      </Sheet>
    </div>
  );
}
