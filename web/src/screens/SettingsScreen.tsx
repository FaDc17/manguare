// Presenta las preferencias, el idioma seleccionado y la guía de audio.

import { LocalizedText, useTranslation } from '../i18n/LanguageContext';
import { useEffect, useState } from 'react';
import {
  ChevronRight,
  Database,
  Globe2,
  Info,
  Languages,
  LogOut,
  MapPin,
  MessageSquareText,
  Phone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  TriangleAlert,
  UserRound,
  Volume2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../app/AppContext';
import { useSession } from '../app/SessionContext';
import { AudioButton } from '../components/AudioButton';
import { MIXED_AUDIO_NOTE } from '../lib/audio';
import { ConnectionPill } from '../components/ConnectionPill';
import { Sheet } from '../components/Sheet';
import { formatRelative } from '../lib/format';
import { formatPhone } from '../lib/session';
import { isLanguageComplete, LANGUAGES, type Translate } from '../i18n/catalog';

const SETTINGS_AUDIO =
  'Ajustes de Manguaré. Aquí puedes elegir el idioma, escribir el número de respaldo para mensajes, ' +
  'cambiar el nombre de tu comunidad y simular que no hay conexión para la demostración.';

// Compone «1 alerta» o «2 reportes» con las claves del idioma activo.
function countText(t: Translate, kind: 'alert' | 'report', count: number): string {
  return t(count === 1 ? `settings.${kind}CountOne` : `settings.${kind}CountOther`, { count });
}

export function SettingsScreen({ onOpenLanguage }: { onOpenLanguage: () => void }) {
  const { t, language: activeLanguage, visualSimulation } = useTranslation();
  const {
    alerts,
    biodiversityReports,
    settings,
    updateSettings,
    online,
    realOnline,
    syncing,
    syncNow,
    clearLocal,
    showToast,
  } = useApp();
  const { session, logout, updateName } = useSession();
  const [profileName, setProfileName] = useState(session.name);
  useEffect(() => setProfileName(session.name), [session.name]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const pending = alerts.filter((alert) => alert.state === 'pending').length;
  const awaiting = alerts.filter(
    (alert) => alert.state === 'sent' && !alert.acknowledgedAt,
  ).length;
  const language = LANGUAGES.find((item) => item.id === activeLanguage);

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
          <p className="eyebrow">{t('settings.preferenciasDelTelefono')}</p>
          <h1>{t('navigation.settings')}</h1>
          <p className="screen-lead">{t('settings.cuentaIdiomaYRespaldoSinConexion')}</p>
        </div>
      </header>

      <section className="settings-group" aria-labelledby="settings-account">
        <h2 id="settings-account">{t('settings.miCuenta')}</h2>
        <div className="settings-card">
          <label className="setting-row">
            <span className="setting-icon"><UserRound size={20} aria-hidden="true" /></span>
            <span className="setting-main"><span className="setting-label">{t('settings.nombreDePerfil')}</span></span>
            <input
              type="text"
              className="setting-input"
              data-testid="settings-profile-name"
              value={profileName}
              maxLength={80}
              onChange={(event) => setProfileName(event.target.value)}
              onBlur={() => {
                if (profileName.trim()) {
                  try { updateName(profileName); } catch { setProfileName(session.name); showToast(t('settings.noSePudoGuardarNombre'), 'error'); }
                } else setProfileName(session.name);
              }}
            />
          </label>
          <div className="setting-row">
            <span className="setting-icon">
              <UserRound size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">{session.name}</span>
              <span className="setting-sub">{t(`role.${session.role}`)}</span>
            </span>
            <span className={`account-role account-role--${session.role}`}>
              {session.role === 'admin' ? t('settings.admin') : t('settings.usuario')}
            </span>
          </div>

          <div className="setting-row">
            <span className="setting-icon">
              <Smartphone size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">{t('settings.numeroDeAcceso')}</span>
              <span className="setting-sub">{t('settings.accesoDeDemostracion')}</span>
            </span>
            <span className="account-phone">{formatPhone(session.phone)}</span>
          </div>

          {session.role === 'admin' ? (
            <a
              className="setting-row setting-row--button setting-row--link"
              data-testid="settings-admin-panel"
              href="/panel"
              target="_blank"
              rel="noreferrer"
            >
              <span className="setting-icon">
                <ShieldCheck size={20} aria-hidden="true" />
              </span>
              <span className="setting-main">
                <span className="setting-label">{t('settings.panelDeLaRedDeSalud')}</span>
                <span className="setting-sub">{t('settings.alertasRecibidasYConfirmaciones')}</span>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </a>
          ) : null}

          <button
            type="button"
            className="setting-row setting-row--button"
            data-testid="logout-button"
            onClick={logout}
          >
            <span className="setting-icon setting-icon--danger">
              <LogOut size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">{t('settings.cerrarSesion')}</span>
              <span className="setting-sub">{t('settings.volverALaPantallaDeAcceso')}</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="settings-note">
          <Info size={15} aria-hidden="true" />{' '}{t('settings.esteAccesoEsDeDemostracionEl')}
        </p>
      </section>

      <section className="settings-group" aria-labelledby="settings-prefs">
        <h2 id="settings-prefs">{t('settings.preferencias')}</h2>
        <div className="settings-card">
          <button type="button" className="setting-row setting-row--button" data-testid="settings-language" onClick={onOpenLanguage}>
            <span className="setting-icon">
              <Languages size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label"><LocalizedText id="settings.language" /></span>
              <span className="setting-sub">
                {language?.label} · {t(isLanguageComplete(activeLanguage) ? 'language.complete' : 'language.partial')}
              </span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>

          <label className="setting-row">
            <span className="setting-icon">
              <Globe2 size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label"><LocalizedText id="location.community" /></span>
              <span className="setting-sub">{t('settings.seProponeAlCrearUnaAlerta')}</span>
            </span>
            <input
              type="text"
              className="setting-input"
              data-testid="settings-community"
              value={settings.community}
              placeholder={t('settings.ejNuevaEsperanza')}
              maxLength={80}
              onChange={(event) => updateSettings({ community: event.target.value })}
            />
          </label>

          <label className="setting-row">
            <span className="setting-icon">
              <Smartphone size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">{t('settings.nombreDelEquipo')}</span>
              <span className="setting-sub">{t('settings.ayudaAIdentificarQuienEnvioLa')}</span>
            </span>
            <input
              type="text"
              className="setting-input"
              data-testid="settings-deviceName"
              value={settings.deviceName}
              maxLength={80}
              onChange={(event) => updateSettings({ deviceName: event.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="settings-group" aria-labelledby="settings-sms">
        <h2 id="settings-sms">{t('settings.contactoYRespaldo')}</h2>
        <div className="settings-card">
          <label className="setting-row setting-row--stack">
            <span className="setting-stack-head">
              <span className="setting-icon">
                <MapPin size={20} aria-hidden="true" />
              </span>
              <span className="setting-main">
                <span className="setting-label">{t('settings.puestoDeSalud')}</span>
                <span className="setting-sub">{t('settings.seMuestraEnNumerosDeAyuda')}</span>
              </span>
            </span>
            <input
              type="text"
              className="setting-input setting-input--block"
              data-testid="settings-healthPost"
              value={settings.healthPost}
              placeholder={t('settings.ejPuestoDeSaludNuevaEsperanza')}
              maxLength={80}
              onChange={(event) => updateSettings({ healthPost: event.target.value })}
            />
          </label>

          <label className="setting-row">
            <span className="setting-icon">
              <Phone size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">{t('settings.telefonoDelPuesto')}</span>
              <span className="setting-sub">{t('settings.opcionalSePuedeLlamarSiHay')}</span>
            </span>
            <input
              type="tel"
              className="setting-input setting-input--tel"
              data-testid="settings-healthPhone"
              value={settings.healthPhone}
              placeholder="+51 999 999 999"
              onChange={(event) => updateSettings({ healthPhone: event.target.value })}
            />
          </label>

          <label className="setting-row">
            <span className="setting-icon">
              <MessageSquareText size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">{t('settings.numeroDelPromotorOPosta')}</span>
              <span className="setting-sub">{t('settings.numeroDePruebaParaLaDemostracion')}</span>
            </span>
            <input
              type="tel"
              className="setting-input setting-input--tel"
              data-testid="settings-smsNumber"
              value={settings.smsNumber}
              placeholder="+51 999 999 999"
              onChange={(event) => updateSettings({ smsNumber: event.target.value })}
            />
          </label>
        </div>
        <p className="settings-note">
          <Info size={15} aria-hidden="true" />{' '}{t('settings.enProduccionEsteNumeroDebeAcordarse')}
        </p>
      </section>

      <section className="settings-group" aria-labelledby="settings-demo">
        <h2 id="settings-demo">{t('settings.conexionYDemostracion')}</h2>
        <div className="settings-card">
          <div className="setting-row">
            <span className="setting-icon">
              {realOnline ? <Wifi size={20} aria-hidden="true" /> : <WifiOff size={20} aria-hidden="true" />}
            </span>
            <span className="setting-main">
              <span className="setting-label">{t('settings.senalDelDispositivo')}</span>
              <span className="setting-sub">
                {realOnline ? t('settings.elNavegadorReportaConexion') : t('settings.elNavegadorReportaSinConexion')}
              </span>
            </span>
            <ConnectionPill online={realOnline} />
          </div>

          <div className="setting-row">
            <span className="setting-icon">
              <TriangleAlert size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">{t('settings.simularSinConexion')}</span>
              <span className="setting-sub">
                {t('settings.paraLaDemoLaAppSe')}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.simulateOffline}
              aria-label={t('settings.simularSinConexion')}
              className={`switch ${settings.simulateOffline ? 'is-on' : ''}`}
              onClick={() => {
                updateSettings({ simulateOffline: !settings.simulateOffline });
                showToast(
                  settings.simulateOffline
                    ? t('settings.conexionSimuladaDesactivadaSeIntentaraSincronizar')
                    : t('settings.modoDemoLaAppAhoraSe'),
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
              <span className="setting-label">{t('settings.estadoDeEnvio')}</span>
              <span className="setting-sub">
                {online
                  ? pending > 0
                    ? t(pending === 1 ? 'settings.queuedOne' : 'settings.queuedOther', { count: pending })
                    : awaiting > 0
                      ? t(awaiting === 1 ? 'settings.awaitingOne' : 'settings.awaitingOther', { count: awaiting })
                      : t('settings.todoAlDia')
                  : t('settings.sinConexionLasAlertasEsperanEn')}
              </span>
            </span>
            <button
              type="button"
              className="text-btn"
              onClick={() => void syncNow(true)}
              disabled={syncing}
            >
              <RefreshCw size={14} className={syncing ? 'spin' : ''} aria-hidden="true" />
              {syncing ? t('settings.enviando') : t('settings.sincronizar')}
            </button>
          </div>
        </div>
      </section>

      <section className="settings-group" aria-labelledby="settings-audio">
        <h2 id="settings-audio">{t('settings.audioYLengua')}</h2>
        <div className="settings-card">
          <div className="setting-row setting-row--stack">
            <div className="setting-stack-head">
              <span className="setting-icon">
                <Volume2 size={20} aria-hidden="true" />
              </span>
              <span className="setting-main">
                <span className="setting-label">{t('settings.guiaDeAudio')}</span>
                <span className="setting-sub">{visualSimulation ? MIXED_AUDIO_NOTE : t('settings.audioDeDemostracionEnCastellano')}</span>
              </span>
            </div>
            <AudioButton text={SETTINGS_AUDIO} label={t('settings.escucharGuia')} />
          </div>
          <div className="setting-row setting-row--stack">
            <div className="setting-stack-head">
              <span className="setting-icon">
                <Languages size={20} aria-hidden="true" />
              </span>
              <span className="setting-main">
                <span className="setting-label">{t('settings.indigenousLanguages')}</span>
                <span className="setting-sub">
                  {t('settings.indigenousAudioNote')}
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-group" aria-labelledby="settings-data">
        <h2 id="settings-data">{t('settings.datosEnEsteTelefono')}</h2>
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
              <span className="setting-label">{t('settings.borrarDatosLocales')}</span>
              <span className="setting-sub">
                {alerts.length + biodiversityReports.length === 0
                  ? t('settings.noHayAlertasNiReportesGuardados')
                  : t('settings.localSummary', { alerts: countText(t, 'alert', alerts.length), reports: countText(t, 'report', biodiversityReports.length) })}
              </span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <div className="setting-row">
            <span className="setting-icon">
              <Database size={20} aria-hidden="true" />
            </span>
            <span className="setting-main">
              <span className="setting-label">{t('settings.comoSeGuardan')}</span>
              <span className="setting-sub">
                {t('settings.lasAlertasSeGuardanEnEl')}
              </span>
            </span>
          </div>
        </div>
      </section>

      <section className="settings-group" aria-labelledby="settings-about">
        <h2 id="settings-about">{t('settings.acercaDeManguare')}</h2>
        <div className="about-card">
          <div className="about-logo">
            <ShieldCheck size={24} aria-hidden="true" />
          </div>
          <div>
            <strong>{t('settings.manguareMvpVersion010')}</strong>
            <p>
              {t('settings.prototipoParaElDesafioIsc2027')}
            </p>
            <p className="about-meta">
              {t('settings.alertaGuardada')}{' '}{alerts[0] ? formatRelative(alerts[0].createdAt, t) : t('settings.sinRegistros')}{' '}{t('settings.datosDeDemostracion')}
            </p>
          </div>
        </div>
        <p className="settings-note settings-note--danger">
          <TriangleAlert size={15} aria-hidden="true" />{' '}{t('settings.noUsarEstePrototipoParaEmergencias')}
        </p>
      </section>

      <Sheet
        open={confirmClear}
        title={t('settings.borrarDatosLocales')}
        onClose={() => setConfirmClear(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(false)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void handleClear()}
              disabled={clearing}
            >
              {clearing ? t('settings.borrando') : t('settings.borrarDatos')}
            </button>
          </>
        }
      >
        <p className="sheet-intro">
          {t('settings.clearSummary', { alerts: countText(t, 'alert', alerts.length), reports: countText(t, 'report', biodiversityReports.length) })}
        </p>
        <div className="notice-box notice-box--danger">
          <strong>{t('settings.estaAccionNoSePuedeDeshacer')}</strong>
          <p>{t('settings.usalaSoloParaLimpiarLaDemostracion')}</p>
        </div>
      </Sheet>
    </div>
  );
}
