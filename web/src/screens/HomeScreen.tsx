import {
  ChevronRight,
  Clock3,
  Globe2,
  History,
  Info,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  TriangleAlert,
  Volume2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../app/AppContext';
import { useSession } from '../app/SessionContext';
import { AlertCard } from '../components/AlertCard';
import { EmptyState } from '../components/EmptyState';
import { canSpeak, speakSpanish } from '../lib/audio';
import { LANGUAGES } from '../lib/settings';
import { formatPhone, roleLabel } from '../lib/session';

const HOME_AUDIO =
  'Manguaré guarda tu alerta en el teléfono. Si no hay señal, la envía automáticamente cuando vuelve la conexión. ' +
  'Puedes ver si está pendiente, enviada o recibida. Si tienes señal, también puedes avisar por mensaje de texto.';

export function HomeScreen({
  onNew,
  onOpenAlert,
  onHistory,
  onCommunity,
  onOpenLanguage,
  onOpenHelp,
}: {
  onNew: () => void;
  onOpenAlert: (id: string) => void;
  onHistory: () => void;
  onCommunity: () => void;
  onOpenLanguage: () => void;
  onOpenHelp: () => void;
}) {
  const { alerts, online, syncing, settings, syncNow, showToast } = useApp();
  const { session } = useSession();
  const pending = alerts.filter((alert) => alert.state === 'pending');
  const recent = alerts.slice(0, 2);
  const language = LANGUAGES.find((item) => item.id === settings.language);

  const playGuide = () => {
    if (!speakSpanish(HOME_AUDIO)) {
      showToast('Este dispositivo no tiene audio disponible.', 'warn');
    } else if (settings.language !== 'es') {
      showToast('Por ahora la guía de audio está en castellano.', 'warn');
    }
  };

  return (
    <div className="screen home">
      <section className="hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" /> Red de salud comunitaria
        </p>
        <p className="home-hello" data-testid="home-hello">
          Hola, {session.name}
          <span>
            {' '}
            · {roleLabel(session.role)} · {formatPhone(session.phone)}
          </span>
        </p>
        <h1>Pide ayuda sin esperar señal.</h1>
        <p className="hero-copy">
          Tu alerta se guarda en el teléfono y se envía en cuanto vuelve la conexión. Verás siempre
          si sigue pendiente.
        </p>

        <button type="button" className="sos-button" data-testid="sos-button" onClick={onNew}>
          <span className="sos-ring sos-ring-1" aria-hidden="true" />
          <span className="sos-ring sos-ring-2" aria-hidden="true" />
          <span className="sos-inner">
            <TriangleAlert size={46} strokeWidth={2.1} aria-hidden="true" />
            <span className="sos-label">Emergencia</span>
            <span className="sos-hint">Toca para pedir ayuda</span>
          </span>
        </button>

        <p className={`connection-line ${online ? 'is-online' : 'is-offline'}`}>
          {online ? (
            <>
              <Wifi size={16} aria-hidden="true" /> Con conexión: la alerta se envía ahora.
            </>
          ) : (
            <>
              <WifiOff size={16} aria-hidden="true" /> Sin conexión: la alerta se guarda en tu
              teléfono.
            </>
          )}
        </p>
      </section>

      {language && language.id !== 'es' ? (
        <div className="banner banner-warn">
          <Info size={19} aria-hidden="true" />
          <div>
            <strong>Interfaz en español como respaldo</strong>
            <p>
              La traducción al {language.label.toLowerCase()} se validará y grabará con hablantes de
              la comunidad. Aún no está activa.
            </p>
            <button type="button" className="text-btn" onClick={onOpenLanguage}>
              Revisar idioma <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="pending-card">
          <span className="pending-icon">
            <Clock3 size={22} aria-hidden="true" />
            {syncing ? <span className="pulse-dot" aria-hidden="true" /> : null}
          </span>
          <div className="pending-copy">
            <strong>
              {pending.length === 1
                ? '1 alerta esperando envío'
                : `${pending.length} alertas esperando envío`}
            </strong>
            <span>
              {online
                ? 'Hay conexión. Se están enviando automáticamente.'
                : 'Se enviarán solas cuando vuelva la señal.'}
            </span>
          </div>
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              if (online) void syncNow(true);
              else onHistory();
            }}
          >
            {online ? (
              <>
                <RefreshCw size={14} className={syncing ? 'spin' : ''} aria-hidden="true" />
                {syncing ? 'Enviando' : 'Reintentar'}
              </>
            ) : (
              <>
                Ver <ChevronRight size={14} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      ) : null}

      <section className="quick-grid" aria-label="Accesos rápidos">
        <button type="button" className="quick-card" onClick={onHistory}>
          <span className="quick-icon quick-icon--green">
            <History size={21} aria-hidden="true" />
          </span>
          <span className="quick-title">Mis alertas</span>
          <span className="quick-sub">
            {alerts.length > 0
              ? `${alerts.length} en este teléfono`
              : 'Historial y estado de envío'}
          </span>
        </button>
        <button type="button" className="quick-card" onClick={onOpenHelp}>
          <span className="quick-icon quick-icon--clay">
            <Phone size={21} aria-hidden="true" />
          </span>
          <span className="quick-title">Números de ayuda</span>
          <span className="quick-sub">SAMU · Bomberos · Policía</span>
        </button>
        <button type="button" className="quick-card" onClick={onCommunity}>
          <span className="quick-icon quick-icon--green">
            <Store size={21} aria-hidden="true" />
          </span>
          <span className="quick-title">Conecta Amazonía</span>
          <span className="quick-sub">Servicios y centros de apoyo</span>
        </button>
        <button
          type="button"
          className="quick-card"
          onClick={() => showToast('El asistente estará disponible en el piloto.', 'warn')}
        >
          <span className="quick-icon quick-icon--sand">
            <Sparkles size={21} aria-hidden="true" />
          </span>
          <span className="quick-title">Asistente IA</span>
          <span className="quick-sub">Próximamente</span>
        </button>
        {session.role === 'admin' ? (
          <a className="quick-card" href="/panel" target="_blank" rel="noreferrer">
            <span className="quick-icon quick-icon--clay">
              <ShieldCheck size={21} aria-hidden="true" />
            </span>
            <span className="quick-title">Panel de la red</span>
            <span className="quick-sub">Alertas y confirmaciones</span>
          </a>
        ) : null}
        {canSpeak() ? (
          <button type="button" className="quick-card quick-card--audio" onClick={playGuide}>
            <span className="quick-icon quick-icon--sand">
              <Volume2 size={21} aria-hidden="true" />
            </span>
            <span className="quick-title">¿Cómo funciona?</span>
            <span className="quick-sub">Escuchar guía en castellano</span>
            <span className="quick-play" aria-hidden="true">
              <Volume2 size={14} />
            </span>
          </button>
        ) : (
          <button type="button" className="quick-card quick-card--audio" onClick={onOpenHelp}>
            <span className="quick-icon quick-icon--sand">
              <Globe2 size={21} aria-hidden="true" />
            </span>
            <span className="quick-title">¿Cómo funciona?</span>
            <span className="quick-sub">Guía y canales de ayuda</span>
          </button>
        )}
      </section>

      <section className="recent">
        <div className="section-head">
          <h2>Últimas alertas</h2>
          {alerts.length > 0 ? (
            <button type="button" className="text-btn" onClick={onHistory}>
              Ver todas <ChevronRight size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {recent.length > 0 ? (
          <div className="alert-list">
            {recent.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onOpen={onOpenAlert} />
            ))}
          </div>
        ) : (
          <EmptyState icon={TriangleAlert} title="Todavía no enviaste alertas">
            Cuando envíes una emergencia verás aquí su estado: pendiente, enviada o recibida.
          </EmptyState>
        )}
      </section>

      <p className="disclaimer">
        Manguaré complementa a los servicios de emergencia y a la radio del puesto de salud. No los
        reemplaza.
      </p>
    </div>
  );
}
