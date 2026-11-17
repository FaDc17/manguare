import { useState } from 'react';
import {
  ChevronRight,
  Database,
  Globe2,
  Info,
  Languages,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  TriangleAlert,
  Volume2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../app/AppContext';
import { AudioButton } from '../components/AudioButton';
import { ConnectionPill } from '../components/ConnectionPill';
import { Sheet } from '../components/Sheet';
import { formatRelative } from '../lib/format';
import { LANGUAGES } from '../lib/settings';

const SETTINGS_AUDIO =
  'Ajustes de Manguaré. Aquí puedes elegir el idioma, escribir el número de respaldo para mensajes, ' +
  'cambiar el nombre de tu comunidad y simular que no hay conexión para la demostración.';

export function SettingsScreen({ onOpenLanguage }: { onOpenLanguage: () => void }) {
  const {
    alerts,
    settings,
    updateSettings,
    online,
    realOnline,
    syncing,
    syncNow,
    clearLocal,
    showToast,
  } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const pending = alerts.filter((alert) => alert.state === 'pending').length;
  const language = LANGUAGES.find((item) => item.id === settings.language);

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearLocal();
      setConfirmClear(false);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="screen settings">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Preferencias del teléfono</p>
          <h1>Ajustes</h1>
          <p className="screen-lead">Idioma, respaldo por SMS y modo de demostración.</p>
        </div>
      </header>

      <section className="settings-group" aria-labelledby="settings-prefs">
        <h2 id="settings-prefs">Preferencias</h2>
        <div className="settings-card">
          <button type="button" className="setting-row setting-row--button" onClick={onOpenLanguage}>
            <span className="setting-icon">
              <Languages size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">Idioma</span>
              <span className="setting-sub">
                {language?.label ?? 'Español'}
                {language?.status === 'pendiente' ? ' · traducción pendiente' : ' · disponible'}
              </span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>

          <label className="setting-row">
            <span className="setting-icon">
              <Globe2 size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">Comunidad</span>
              <span className="setting-sub">Se propone al crear una alerta</span>
            </span>
            <input
              type="text"
              className="setting-input"
              value={settings.community}
              placeholder="Ej. Nueva Esperanza"
              maxLength={80}
              onChange={(event) => updateSettings({ community: event.target.value })}
            />
          </label>

          <label className="setting-row">
            <span className="setting-icon">
              <Smartphone size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">Nombre del equipo</span>
              <span className="setting-sub">Ayuda a identificar quién envió la alerta</span>
            </span>
            <input
              type="text"
              className="setting-input"
              value={settings.deviceName}
              maxLength={80}
              onChange={(event) => updateSettings({ deviceName: event.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="settings-group" aria-labelledby="settings-sms">
        <h2 id="settings-sms">Respaldo por SMS</h2>
        <div className="settings-card">
          <label className="setting-row">
            <span className="setting-icon">
              <MessageSquareText size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">Número del promotor o posta</span>
              <span className="setting-sub">Número de prueba para la demostración</span>
            </span>
            <input
              type="tel"
              className="setting-input setting-input--tel"
              value={settings.smsNumber}
              placeholder="+51 999 999 999"
              onChange={(event) => updateSettings({ smsNumber: event.target.value })}
            />
          </label>
        </div>
        <p className="settings-note">
          <Info size={15} aria-hidden="true" /> En producción, este número debe acordarse con la red
          de salud. El SMS no confirma la entrega.
        </p>
      </section>

      <section className="settings-group" aria-labelledby="settings-demo">
        <h2 id="settings-demo">Conexión y demostración</h2>
        <div className="settings-card">
          <div className="setting-row">
            <span className="setting-icon">
              {realOnline ? <Wifi size={20} aria-hidden="true" /> : <WifiOff size={20} aria-hidden="true" />}
            </span>
            <span className="setting-main">
              <span className="setting-label">Señal del dispositivo</span>
              <span className="setting-sub">
                {realOnline ? 'El navegador reporta conexión' : 'El navegador reporta sin conexión'}
              </span>
            </span>
            <ConnectionPill online={realOnline} />
          </div>

          <div className="setting-row">
            <span className="setting-icon">
              <TriangleAlert size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">Simular sin conexión</span>
              <span className="setting-sub">
                Para la demo: la app se comporta como si no hubiera señal. No borra alertas.
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.simulateOffline}
              aria-label="Simular sin conexión"
              className={`switch ${settings.simulateOffline ? 'is-on' : ''}`}
              onClick={() => {
                updateSettings({ simulateOffline: !settings.simulateOffline });
                showToast(
                  settings.simulateOffline
                    ? 'Conexión simulada desactivada. Se intentará sincronizar.'
                    : 'Modo demo: la app ahora se comporta sin conexión.',
                  settings.simulateOffline ? 'ok' : 'warn',
                );
              }}
            >
              <span className="switch-thumb" />
            </button>
          </div>

          <div className="setting-row">
            <span className="setting-icon">
              <RefreshCw size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">Estado de envío</span>
              <span className="setting-sub">
                {online
                  ? pending > 0
                    ? `${pending} alerta${pending === 1 ? '' : 's'} en cola. Se reintenta cada 20 s.`
                    : 'Todo al día.'
                  : 'Sin conexión: las alertas esperan en el teléfono.'}
              </span>
            </span>
            <button
              type="button"
              className="text-btn"
              onClick={() => void syncNow(true)}
              disabled={syncing}
            >
              <RefreshCw size={14} className={syncing ? 'spin' : ''} aria-hidden="true" />
              {syncing ? 'Enviando' : 'Sincronizar'}
            </button>
          </div>
        </div>
      </section>

      <section className="settings-group" aria-labelledby="settings-audio">
        <h2 id="settings-audio">Audio y lengua</h2>
        <div className="settings-card">
          <div className="setting-row setting-row--stack">
            <div className="setting-stack-head">
              <span className="setting-icon">
                <Volume2 size={20} aria-hidden="true" />
              </span>
              <span className="setting-main">
                <span className="setting-label">Guía de audio</span>
                <span className="setting-sub">Audio de demostración en castellano</span>
              </span>
            </div>
            <AudioButton text={SETTINGS_AUDIO} label="Escuchar guía" />
          </div>
          <div className="setting-row setting-row--stack">
            <div className="setting-stack-head">
              <span className="setting-icon">
                <Languages size={20} aria-hidden="true" />
              </span>
              <span className="setting-main">
                <span className="setting-label">Awajún y shawi</span>
                <span className="setting-sub">
                  Traducción y grabación pendientes con hablantes de la comunidad. No usamos voces
                  sintéticas para estas lenguas.
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-group" aria-labelledby="settings-data">
        <h2 id="settings-data">Datos en este teléfono</h2>
        <div className="settings-card">
          <button
            type="button"
            className="setting-row setting-row--button"
            onClick={() => setConfirmClear(true)}
          >
            <span className="setting-icon setting-icon--danger">
              <Trash2 size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">Borrar alertas locales</span>
              <span className="setting-sub">
                {alerts.length === 0
                  ? 'No hay alertas guardadas'
                  : `${alerts.length} alerta${alerts.length === 1 ? '' : 's'} en este teléfono`}
              </span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <div className="setting-row">
            <span className="setting-icon">
              <Database size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">Cómo se guardan</span>
              <span className="setting-sub">
                Las alertas se guardan en el almacenamiento local del navegador (IndexedDB). No se
                borran al cerrar la app.
              </span>
            </span>
          </div>
        </div>
      </section>

      <section className="settings-group" aria-labelledby="settings-about">
        <h2 id="settings-about">Acerca de Manguaré</h2>
        <div className="about-card">
          <div className="about-logo">
            <ShieldCheck size={24} aria-hidden="true" />
          </div>
          <div>
            <strong>Manguaré MVP · versión 0.1.0</strong>
            <p>
              Prototipo para el Desafío ISC 2027, Amazonía Viva. Diseñado para conectividad
              intermitente, no para reemplazar a los servicios de emergencia.
            </p>
            <p className="about-meta">
              Alerta guardada {alerts[0] ? formatRelative(alerts[0].createdAt) : 'sin registros'} ·
              Datos de demostración
            </p>
          </div>
        </div>
        <p className="settings-note settings-note--danger">
          <TriangleAlert size={15} aria-hidden="true" /> No usar este prototipo para emergencias
          reales. La recepción depende de un receptor definido y de un protocolo de respuesta.
        </p>
      </section>

      <Sheet
        open={confirmClear}
        title="Borrar alertas locales"
        onClose={() => setConfirmClear(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void handleClear()}
              disabled={clearing}
            >
              {clearing ? 'Borrando…' : 'Borrar alertas'}
            </button>
          </>
        }
      >
        <p className="sheet-intro">
          Se borrarán {alerts.length} alerta{alerts.length === 1 ? '' : 's'} de este teléfono. Las
          alertas que ya llegaron al servidor y a la red de salud no se eliminan allí.
        </p>
        <div className="notice-box notice-box--danger">
          <strong>Esta acción no se puede deshacer en el teléfono</strong>
          <p>Úsala solo para limpiar la demostración o un equipo compartido.</p>
        </div>
      </Sheet>
    </div>
  );
}
