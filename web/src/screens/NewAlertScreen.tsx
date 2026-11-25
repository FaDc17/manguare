// Traduce las instrucciones y opciones del formulario de alertas.

import { LocalizedText, useTranslation } from '../i18n/LanguageContext';
import { InterfaceError } from '../i18n/catalog';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  ImagePlus,
  LoaderCircle,
  LocateFixed,
  MapPin,
  RotateCcw,
  Send,
  TriangleAlert,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../app/AppContext';
import { useSession } from '../app/SessionContext';
import { AudioButton } from '../components/AudioButton';
import { EMERGENCY_META } from '../lib/emergency';
import { compressImage } from '../lib/photo';
import {
  EMERGENCY_TYPES,
  type AlertLocation,
  type EmergencyType,
} from '../lib/types';

type Step = 1 | 2 | 3;

interface GeoState {
  status: 'idle' | 'locating' | 'ok' | 'error' | 'unsupported';
  location?: AlertLocation;
  message?: string;
}

const TYPE_AUDIO =
  'Elige qué está pasando: enfermedad, accidente, mordedura, parto u otro. Toca una opción para continuar.';

export function NewAlertScreen({
  onCancel,
  onCreated,
  sos = false,
}: {
  onCancel: () => void;
  onCreated: (id: string) => void;
  sos?: boolean;
}) {
  const { t } = useTranslation();
  const { alerts, settings, online, createAlert, showToast } = useApp();
  const { session } = useSession();
  const [step, setStep] = useState<Step>(sos ? 2 : 1);
  const [type, setType] = useState<EmergencyType | null>(sos ? 'otro' : null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(false);
  const [community, setCommunity] = useState(settings.community);
  const [photo, setPhoto] = useState<string | undefined>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [consent, setConsent] = useState(true);
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeo({ status: 'unsupported', message: t('newAlert.esteDispositivoNoTieneGpsDisponible') });
      return;
    }
    setGeo({ status: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeo({
          status: 'ok',
          location: {
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
            accuracy: Math.round(position.coords.accuracy),
            capturedAt: new Date(position.timestamp).toISOString(),
          },
        });
      },
      (error) => {
        const message =
          error.code === 1
            ? t('newAlert.noDistePermisoDeUbicacionPuedes')
            : error.code === 2
              ? t('newAlert.noSePudoObtenerLaUbicacion')
              : t('newAlert.laUbicacionTardoDemasiadoIntentaloOtra');
        setGeo({ status: 'error', message });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
    );
  }, [t]);

  useEffect(() => {
    if (step === 2 && geo.status === 'idle') requestLocation();
  }, [step, geo.status, requestLocation]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [step]);

  const meta = type ? EMERGENCY_META[type] : null;

  const goBack = () => {
    if (step === 1) onCancel();
    else setStep((current) => (current - 1) as Step);
  };

  const pickType = (value: EmergencyType) => {
    setType(value);
    setStep(2);
  };

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
    } catch (error) {
      showToast(
        t(error instanceof InterfaceError ? error.key : 'newAlert.noSePudoProcesarLaFoto'),
        'error',
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async () => {
    if (!type || submitting || photoBusy) return;
    if (sos && !note.trim()) {
      setNoteError(true);
      return;
    }
    if (sos) {
      const recentSos = alerts.find((item) =>
        item.isSos && item.state !== 'canceled' &&
        Date.now() - Date.parse(item.createdAt) < 2 * 60_000,
      );
      if (recentSos) {
        showToast(t('sos.yaHayUnaAlertaSosReciente'), 'warn');
        onCreated(recentSos.id);
        return;
      }
    }
    setSubmitting(true);
    try {
      const location = consent && geo.status === 'ok' ? geo.location : undefined;
      const locationUnavailable = consent && !location;
      const alert = await createAlert({
        type,
        ...(sos ? { isSos: true } : {}),
        note: sos ? note.trim() : note,
        community,
        deviceName: settings.deviceName,
        reportedBy: session.name,
        reporterPhone: session.phone,
        location,
        photo,
        consentLocation: consent,
      });
      const savedMessage = online
        ? t('alertDetail.guardadaEnElTelefono')
        : t('newAlert.alertaGuardadaSeEnviaraAlRecuperar');
      const confirmation = locationUnavailable
        ? `${savedMessage}. ${t('newAlert.sinUbicacionGps')}.`
        : savedMessage;
      showToast(confirmation, online && !locationUnavailable ? 'ok' : 'warn');
      onCreated(alert.id);
    } catch (error) {
      console.error('[manguare] No se pudo guardar la alerta localmente:', error);
      showToast(t('newAlert.noSePudoGuardarLaAlerta'), 'error');
      setSubmitting(false);
    }
  };

  return (
    <div className="screen wizard">
      <header className="wizard-head">
        <button type="button" className="icon-btn" onClick={goBack} aria-label={t('common.back')}>
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <div className="wizard-head-copy">
          <span className="wizard-step">{sos ? t('sos.pasoDe2', { step: step === 1 ? 1 : 2 }) : t('newAlert.pasoDe3', { step })}</span>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={sos ? 2 : 3}
            aria-valuenow={sos && step === 2 ? 2 : step}
            aria-label={sos ? t('sos.pasoDe2', { step: step === 1 ? 1 : 2 }) : t('newAlert.pasoDe3', { step })}
          >
            <span style={{ width: `${(sos ? (step === 1 ? 1 : 2) / 2 : step / 3) * 100}%` }} />
          </div>
        </div>
        <span className="wizard-tag">{sos ? t('sos.title') : t('newAlert.nuevaAlerta')}</span>
      </header>

      {step === 1 ? (
        <section className="wizard-body">
          <h1>{t('newAlert.queEstaPasando')}</h1>
          <p className="lead">
            {t('newAlert.eligeLaOpcionMasParecidaNo')}
          </p>
          <AudioButton text={TYPE_AUDIO} label={t('newAlert.escucharLasOpciones')} />

          <div className="type-grid">
            {EMERGENCY_TYPES.map((item) => {
              const itemMeta = EMERGENCY_META[item];
              const Icon = itemMeta.icon;
              return (
                <button
                  key={item}
                  type="button"
                  data-testid={`type-${item}`}
                  className={`type-card ${type === item ? 'is-selected' : ''} ${
                    item === 'otro' ? 'type-card--wide' : ''
                  }`}
                  onClick={() => pickType(item)}
                >
                  <span className={`type-tile type-tile--${itemMeta.tone}`}>
                    <Icon size={26} aria-hidden="true" />
                  </span>
                  <span className="type-card-copy">
                    <span className="type-card-title"><LocalizedText id={`emergency.${item}`} /></span>
                    <span className="type-card-hint">{t(`emergency.hint.${item}`)}</span>
                  </span>
                  <ChevronRight size={18} className="type-card-arrow" aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <p className="wizard-note">
            <TriangleAlert size={16} aria-hidden="true" />{' '}{t('newAlert.siHayPeligroInmediatoYTienes')}
          </p>
        </section>
      ) : null}

      {step === 2 && meta ? (
        <form
          className="wizard-body"
          onSubmit={(event) => {
            event.preventDefault();
            if (sos) void submit();
            else setStep(3);
          }}
        >
          <div className="step-type">
            <span className={`type-tile type-tile--${meta.tone}`}>
              <meta.icon size={24} aria-hidden="true" />
            </span>
            <div>
              <span className="step-type-label">{t('newAlert.emergencia')}</span>
              <strong><LocalizedText id={`emergency.${type!}`} /></strong>
            </div>
            <button type="button" className="text-btn" onClick={() => setStep(1)}>
              {t('newAlert.cambiar')}
            </button>
          </div>

          <h1>{t('newAlert.cuentanosUnPocoMas')}</h1>
          <p className="lead">{sos ? t('sos.completaElDetalle') : t('newAlert.todoEsOpcionalLaAlertaSe')}</p>

          <label className="field">
            <span className="field-label">{t('newAlert.queObservas')}</span>
            <textarea
              data-testid="alert-note"
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                if (event.target.value.trim()) setNoteError(false);
              }}
              placeholder={t('newAlert.ejFiebreAltaDesdeAyerNo')}
              rows={3}
              maxLength={1000}
              aria-required={sos}
              aria-invalid={noteError}
            />
            <span className="field-help" role={noteError ? 'alert' : undefined}>
              {noteError ? t('sos.detalleObligatorio') : t('newAlert.noEscribasNombresSiNoEs')}
            </span>
          </label>

          <div className="field">
            <span className="field-label">{t('newAlert.fotoOpcional')}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="visually-hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void handlePhoto(file);
              }}
            />
            {photo ? (
              <div className="photo-preview">
                <img src={photo} alt={t('newAlert.fotoAdjuntaALaAlerta')} />
                <button
                  type="button"
                  className="photo-remove"
                  onClick={() => setPhoto(undefined)}
                  aria-label={t('newAlert.quitarFoto')}
                >
                  <X size={16} aria-hidden="true" />
                </button>
                <span className="photo-ready">
                  <Check size={14} aria-hidden="true" />{' '}{t('newAlert.comprimidaYLista')}
                </span>
              </div>
            ) : (
              <button
                type="button"
                className="photo-add"
                onClick={() => fileRef.current?.click()}
                disabled={photoBusy}
              >
                {photoBusy ? (
                  <LoaderCircle size={22} className="spin" aria-hidden="true" />
                ) : (
                  <ImagePlus size={22} aria-hidden="true" />
                )}
                <span>
                  {photoBusy ? t('newAlert.preparandoFoto') : t('newAlert.tomarOElegirUnaFoto')}
                  <small>{t('newAlert.seGuardaEnElTelefonoY')}</small>
                </span>
              </button>
            )}
          </div>

          <div className="field">
            <span className="field-label">{t('common.location')}</span>
            <div className={`geo-card geo-${geo.status}`}>
              <span className="geo-icon">
                {geo.status === 'locating' ? (
                  <LoaderCircle size={20} className="spin" aria-hidden="true" />
                ) : geo.status === 'ok' ? (
                  <LocateFixed size={20} aria-hidden="true" />
                ) : (
                  <MapPin size={20} aria-hidden="true" />
                )}
              </span>
              <div className="geo-copy">
                <strong>
                  {geo.status === 'idle' || geo.status === 'locating'
                    ? t('newAlert.buscandoUbicacion')
                    : geo.status === 'ok'
                      ? t('newAlert.ubicacionLista')
                      : t('newAlert.sinUbicacionGps')}
                </strong>
                <span>
                  {geo.status === 'ok' && geo.location
                    ? t('newAlert.precisionAproximadaDeMElGps', { accuracy: geo.location.accuracy })
                    : geo.status === 'error' || geo.status === 'unsupported'
                      ? geo.message
                      : t('newAlert.elGpsFuncionaSinDatosMoviles')}
                </span>
              </div>
              {geo.status === 'ok' ? (
                <span className="geo-ok">
                  <Check size={18} aria-hidden="true" />
                </span>
              ) : geo.status === 'idle' || geo.status === 'locating' ? null : (
                <button type="button" className="geo-retry" onClick={requestLocation}>
                  <RotateCcw size={15} aria-hidden="true" />{' '}{t('common.retry')}
                </button>
              )}
            </div>
            {geo.status === 'ok' && geo.location ? (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>
                  <strong>{t('newAlert.compartirMiUbicacionConLaRed')}</strong>
                  <small>{t('newAlert.noSeMuestraPublicamentePuedesDesactivarlo')}</small>
                </span>
              </label>
            ) : (
              <p className="field-help">
                {t('newAlert.siNoHayGpsEscribeUna')}
              </p>
            )}
          </div>

          <label className="field">
            <span className="field-label">{t('newAlert.comunidadOReferencia')}</span>
            <input
              type="text"
              data-testid="alert-community"
              value={community}
              onChange={(event) => setCommunity(event.target.value)}
              placeholder={t('newAlert.ejNuevaEsperanzaRioParanapura')}
              maxLength={80}
            />
          </label>

          <button
            type="submit"
            className={`btn btn-lg btn-block ${sos && online ? 'btn-danger' : 'btn-primary'}`}
            data-testid={sos ? 'submit-alert' : 'continue-button'}
            disabled={submitting || photoBusy}
          >
            {sos
              ? submitting ? t('newAlert.guardando') : online ? t('newAlert.enviarAlerta') : t('newAlert.guardarAlerta')
              : t('newAlert.continuar')}{' '}
            {sos ? <Send size={19} aria-hidden="true" /> : <ChevronRight size={19} aria-hidden="true" />}
          </button>
          <p className="wizard-note">
            <Camera size={16} aria-hidden="true" />{' '}{t('newAlert.laFotoYLaUbicacionSolo')}
          </p>
        </form>
      ) : null}

      {step === 3 && meta ? (
        <section className="wizard-body">
          <h1>{t('newAlert.revisaYEnvia')}</h1>
          <p className="lead">
            {t('newAlert.estaEsLaInformacionQueSaldra')}
          </p>

          <div className="review-card">
            <div className="review-type">
              <span className={`type-tile type-tile--${meta.tone}`}>
                <meta.icon size={24} aria-hidden="true" />
              </span>
              <div>
                <span className="review-kicker">{t('newAlert.tipoDeEmergencia')}</span>
                <strong><LocalizedText id={`emergency.${type!}`} /></strong>
              </div>
            </div>
            <dl className="review-list">
              <div>
                <dt>{t('newAlert.detalle')}</dt>
                <dd>{note.trim() || t('newAlert.sinDetalle')}</dd>
              </div>
              <div>
                <dt>{t('common.community')}</dt>
                <dd>{community.trim() || t('newAlert.noIndicada')}</dd>
              </div>
              <div>
                <dt>{t('common.location')}</dt>
                <dd>
                  {!consent
                    ? t('newAlert.noSeComparte')
                    : geo.status === 'ok' && geo.location
                      ? t('newAlert.gpsListoM', { accuracy: geo.location.accuracy })
                      : t('newAlert.sinGpsSeUsaraLaReferencia')}
                </dd>
              </div>
              <div>
                <dt>{t('common.photo')}</dt>
                <dd>{photo ? t('newAlert.adjuntaYComprimida') : t('newAlert.sinFoto')}</dd>
              </div>
            </dl>
          </div>

          <div className={`banner ${online ? 'banner-ok' : 'banner-warn'}`}>
            {online ? <Wifi size={19} aria-hidden="true" /> : <WifiOff size={19} aria-hidden="true" />}
            <div>
              <strong>{online ? t('newAlert.seEnviaraAhora') : t('newAlert.seGuardaraEnElTelefono')}</strong>
              <p>
                {online
                  ? t('newAlert.laAlertaSaldraHaciaLaRed')
                  : t('newAlert.noHayConexionLaAlertaSe')}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="submit-alert"
            className={`btn btn-lg btn-block ${online ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <LoaderCircle size={20} className="spin" aria-hidden="true" />{' '}{t('newAlert.guardando')}
              </>
            ) : online ? (
              <>
                <Send size={20} aria-hidden="true" />{' '}{t('newAlert.enviarAlerta')}
              </>
            ) : (
              <>
                <WifiOff size={20} aria-hidden="true" />{' '}{t('newAlert.guardarAlerta')}
              </>
            )}
          </button>

          <p className="wizard-note">
            <TriangleAlert size={16} aria-hidden="true" />{' '}{t('newAlert.manguareNoEsUnServicioDe')}{' '}<a href="tel:106">106</a>{' '}{t('newAlert.oALaRadioDelPuesto')}
          </p>
        </section>
      ) : null}
    </div>
  );
}
