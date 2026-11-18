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
}: {
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const { settings, online, createAlert, showToast } = useApp();
  const [step, setStep] = useState<Step>(1);
  const [type, setType] = useState<EmergencyType | null>(null);
  const [note, setNote] = useState('');
  const [community, setCommunity] = useState(settings.community);
  const [photo, setPhoto] = useState<string | undefined>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [consent, setConsent] = useState(true);
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeo({ status: 'unsupported', message: 'Este dispositivo no tiene GPS disponible.' });
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
            ? 'No diste permiso de ubicación. Puedes continuar sin GPS y escribir una referencia.'
            : error.code === 2
              ? 'No se pudo obtener la ubicación. Intenta al aire libre o continúa sin GPS.'
              : 'La ubicación tardó demasiado. Inténtalo otra vez.';
        setGeo({ status: 'error', message });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 },
    );
  }, []);

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
        error instanceof Error ? error.message : 'No se pudo procesar la foto.',
        'error',
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async () => {
    if (!type || submitting) return;
    setSubmitting(true);
    try {
      const alert = await createAlert({
        type,
        note,
        community,
        deviceName: settings.deviceName,
        location: consent && geo.status === 'ok' ? geo.location : undefined,
        photo,
        consentLocation: consent,
      });
      if (!online) {
        showToast('Alerta guardada. Se enviará al recuperar señal.', 'warn');
      }
      onCreated(alert.id);
    } catch {
      showToast('No se pudo guardar la alerta en este teléfono. Inténtalo de nuevo.', 'error');
      setSubmitting(false);
    }
  };

  return (
    <div className="screen wizard">
      <header className="wizard-head">
        <button type="button" className="icon-btn" onClick={goBack} aria-label="Volver">
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <div className="wizard-head-copy">
          <span className="wizard-step">Paso {step} de 3</span>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={step}
            aria-label={`Paso ${step} de 3`}
          >
            <span style={{ width: `${(step / 3) * 100}%` }} />
          </div>
        </div>
        <span className="wizard-tag">Nueva alerta</span>
      </header>

      {step === 1 ? (
        <section className="wizard-body">
          <h1>¿Qué está pasando?</h1>
          <p className="lead">
            Elige la opción más parecida. No necesitas escribir nada para continuar.
          </p>
          <AudioButton text={TYPE_AUDIO} label="Escuchar las opciones" />

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
                    <span className="type-card-title">{itemMeta.label}</span>
                    <span className="type-card-hint">{itemMeta.hint}</span>
                  </span>
                  <ChevronRight size={18} className="type-card-arrow" aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <p className="wizard-note">
            <TriangleAlert size={16} aria-hidden="true" /> Si hay peligro inmediato y tienes señal,
            llama también al 106.
          </p>
        </section>
      ) : null}

      {step === 2 && meta ? (
        <form
          className="wizard-body"
          onSubmit={(event) => {
            event.preventDefault();
            setStep(3);
          }}
        >
          <div className="step-type">
            <span className={`type-tile type-tile--${meta.tone}`}>
              <meta.icon size={24} aria-hidden="true" />
            </span>
            <div>
              <span className="step-type-label">Emergencia</span>
              <strong>{meta.label}</strong>
            </div>
            <button type="button" className="text-btn" onClick={() => setStep(1)}>
              Cambiar
            </button>
          </div>

          <h1>Cuéntanos un poco más</h1>
          <p className="lead">Todo es opcional. La alerta se puede enviar solo con el tipo.</p>

          <label className="field">
            <span className="field-label">¿Qué observas?</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. Fiebre alta desde ayer, no puede caminar."
              rows={3}
              maxLength={1000}
            />
            <span className="field-help">No escribas nombres si no es necesario.</span>
          </label>

          <div className="field">
            <span className="field-label">Foto (opcional)</span>
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
                <img src={photo} alt="Foto adjunta a la alerta" />
                <button
                  type="button"
                  className="photo-remove"
                  onClick={() => setPhoto(undefined)}
                  aria-label="Quitar foto"
                >
                  <X size={16} aria-hidden="true" />
                </button>
                <span className="photo-ready">
                  <Check size={14} aria-hidden="true" /> Comprimida y lista
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
                  {photoBusy ? 'Preparando foto…' : 'Tomar o elegir una foto'}
                  <small>Se guarda en el teléfono y se envía con la alerta.</small>
                </span>
              </button>
            )}
          </div>

          <div className="field">
            <span className="field-label">Ubicación</span>
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
                    ? 'Buscando ubicación…'
                    : geo.status === 'ok'
                      ? 'Ubicación lista'
                      : 'Sin ubicación GPS'}
                </strong>
                <span>
                  {geo.status === 'ok' && geo.location
                    ? `Precisión aproximada de ${geo.location.accuracy} m. El GPS no usa datos móviles.`
                    : geo.status === 'error' || geo.status === 'unsupported'
                      ? geo.message
                      : 'El GPS funciona sin datos móviles. Puede tardar unos segundos.'}
                </span>
              </div>
              {geo.status === 'ok' ? (
                <span className="geo-ok">
                  <Check size={18} aria-hidden="true" />
                </span>
              ) : geo.status === 'idle' || geo.status === 'locating' ? null : (
                <button type="button" className="geo-retry" onClick={requestLocation}>
                  <RotateCcw size={15} aria-hidden="true" /> Reintentar
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
                  <strong>Compartir mi ubicación con la red de salud</strong>
                  <small>No se muestra públicamente. Puedes desactivarlo.</small>
                </span>
              </label>
            ) : (
              <p className="field-help">
                Si no hay GPS, escribe una referencia de tu comunidad para que puedan ubicarte.
              </p>
            )}
          </div>

          <label className="field">
            <span className="field-label">Comunidad o referencia</span>
            <input
              type="text"
              value={community}
              onChange={(event) => setCommunity(event.target.value)}
              placeholder="Ej. Nueva Esperanza, río Paranapura"
              maxLength={80}
            />
          </label>

          <button type="submit" className="btn btn-primary btn-lg btn-block" data-testid="continue-button">
            Continuar <ChevronRight size={19} aria-hidden="true" />
          </button>
          <p className="wizard-note">
            <Camera size={16} aria-hidden="true" /> La foto y la ubicación solo se comparten con la
            red de salud.
          </p>
        </form>
      ) : null}

      {step === 3 && meta ? (
        <section className="wizard-body">
          <h1>Revisa y envía</h1>
          <p className="lead">
            Esta es la información que saldrá del teléfono hacia la red de salud.
          </p>

          <div className="review-card">
            <div className="review-type">
              <span className={`type-tile type-tile--${meta.tone}`}>
                <meta.icon size={24} aria-hidden="true" />
              </span>
              <div>
                <span className="review-kicker">Tipo de emergencia</span>
                <strong>{meta.label}</strong>
              </div>
            </div>
            <dl className="review-list">
              <div>
                <dt>Detalle</dt>
                <dd>{note.trim() || 'Sin detalle'}</dd>
              </div>
              <div>
                <dt>Comunidad</dt>
                <dd>{community.trim() || 'No indicada'}</dd>
              </div>
              <div>
                <dt>Ubicación</dt>
                <dd>
                  {!consent
                    ? 'No se comparte'
                    : geo.status === 'ok' && geo.location
                      ? `GPS listo (±${geo.location.accuracy} m)`
                      : 'Sin GPS: se usará la referencia'}
                </dd>
              </div>
              <div>
                <dt>Foto</dt>
                <dd>{photo ? 'Adjunta y comprimida' : 'Sin foto'}</dd>
              </div>
            </dl>
          </div>

          <div className={`banner ${online ? 'banner-ok' : 'banner-warn'}`}>
            {online ? <Wifi size={19} aria-hidden="true" /> : <WifiOff size={19} aria-hidden="true" />}
            <div>
              <strong>{online ? 'Se enviará ahora' : 'Se guardará en el teléfono'}</strong>
              <p>
                {online
                  ? 'La alerta saldrá hacia la red de salud en cuanto toques el botón.'
                  : 'No hay conexión. La alerta se enviará automáticamente cuando vuelva la señal.'}
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
                <LoaderCircle size={20} className="spin" aria-hidden="true" /> Guardando…
              </>
            ) : online ? (
              <>
                <Send size={20} aria-hidden="true" /> Enviar alerta
              </>
            ) : (
              <>
                <WifiOff size={20} aria-hidden="true" /> Guardar alerta
              </>
            )}
          </button>

          <p className="wizard-note">
            <TriangleAlert size={16} aria-hidden="true" /> Manguaré no es un servicio de rescate. Si
            tienes señal, llama también al <a href="tel:106">106</a> o a la radio del puesto de
            salud.
          </p>
        </section>
      ) : null}
    </div>
  );
}
