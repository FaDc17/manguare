// Muestra el saludo, los accesos y el estado reciente de las alertas.

import { LocalizedText, useTranslation } from '../i18n/LanguageContext';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import {
  ChevronRight,
  Clock3,
  History,
  Info,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  TriangleAlert,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApp } from '../app/AppContext';
import { useSession } from '../app/SessionContext';
import { AlertCard } from '../components/AlertCard';
import { EmptyState } from '../components/EmptyState';
import { isOverdue } from '../lib/sla';
import { isLanguageComplete, LANGUAGES } from '../i18n/catalog';
import { formatPhone } from '../lib/session';
import { getNativeApiBase } from '../lib/api-url';

export function HomeScreen({
  onSOS,
  onOpenAlert,
  onHistory,
  onCommunity,
  onOpenAssistant,
  onOpenLanguage,
  onOpenHelp,
}: {
  onSOS: () => void;
  onOpenAlert: (id: string) => void;
  onHistory: () => void;
  onCommunity: () => void;
  onOpenAssistant: () => void;
  onOpenLanguage: () => void;
  onOpenHelp: () => void;
}) {
  const { t, language: activeLanguage, visualSimulation } = useTranslation();
  const { alerts, online, syncing, syncNow, showToast } = useApp();
  const { session } = useSession();
  const pending = alerts.filter((alert) => alert.state === 'pending');
  const awaiting = alerts.filter((alert) => alert.state === 'sent' && !alert.acknowledgedAt);
  const overdue = awaiting.some((alert) => isOverdue(alert));
  const recent = alerts.slice(0, 2);
  const language = LANGUAGES.find((item) => item.id === activeLanguage);

  return (
    <div className="screen home">
      <section className="hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />{' '}{t('home.redDeSaludComunitaria')}
        </p>
        <p className="home-hello" data-testid="home-hello">
          <LocalizedText id="home.greeting" values={{ name: session.name }} />
          <span>
            {' '}
            · {t(`role.${session.role}`)} · {formatPhone(session.phone)}
          </span>
        </p>
        <h1>{t('home.pideAyudaSinEsperarSenal')}</h1>
        <p className="hero-copy">
          {t('home.tuAlertaSeGuardaEnEl')}
        </p>

        <button type="button" className="sos-button" data-testid="sos-button" onClick={onSOS}>
          <span className="sos-ring sos-ring-1" aria-hidden="true" />
          <span className="sos-ring sos-ring-2" aria-hidden="true" />
          <span className="sos-inner">
            <TriangleAlert size={46} strokeWidth={2.1} aria-hidden="true" />
            <span className="sos-label"><LocalizedText id="home.emergencia" /></span>
            <span className="sos-hint">{t('home.tocaParaPedirAyuda')}</span>
          </span>
        </button>

        <p className={`connection-line ${online ? 'is-online' : 'is-offline'}`}>
          {online ? (
            <>
              <Wifi size={16} aria-hidden="true" />{' '}{t('home.conConexionLaAlertaSeEnvia')}
            </>
          ) : (
            <>
              <WifiOff size={16} aria-hidden="true" />{' '}{t('home.sinConexionLaAlertaSeGuarda')}
            </>
          )}
        </p>
      </section>

      {language && !visualSimulation && !isLanguageComplete(language.id) ? (
        <div className="banner banner-warn">
          <Info size={19} aria-hidden="true" />
          <div>
            <strong>{t('home.interfazEnEspanolComoRespaldo')}</strong>
            <p>
              {t('home.partialLanguage', { language: language.label })}
            </p>
            <button type="button" className="text-btn" onClick={onOpenLanguage}>
              {t('home.revisarIdioma')}{' '}<ChevronRight size={14} aria-hidden="true" />
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
                ? t('home.1AlertaEsperandoEnvio')
                : t('home.alertasEsperandoEnvio', { count: pending.length })}
            </strong>
            <span>
              {online
                ? t('home.hayConexionSeEstanEnviandoAutomaticamente')
                : t('home.seEnviaranSolasCuandoVuelvaLa')}
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
                {syncing ? t('home.enviando') : t('common.retry')}
              </>
            ) : (
              <>
                {t('common.view')}{' '}<ChevronRight size={14} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      ) : null}

      {awaiting.length > 0 ? (
        <div className={`confirmation-card ${overdue ? 'is-overdue' : ''}`}>
          <span className="confirmation-icon">
            {overdue ? (
              <TriangleAlert size={21} aria-hidden="true" />
            ) : (
              <Clock3 size={21} aria-hidden="true" />
            )}
          </span>
          <div className="confirmation-copy">
            <strong>
              {overdue
                ? t('home.laRedNoConfirmoEnEl')
                : awaiting.length === 1
                  ? t('home.1AlertaEsperandoConfirmacion')
                  : t('home.alertasEsperandoConfirmacion', { count: awaiting.length })}
            </strong>
            <span>
              {overdue
                ? t('home.puedesAvisarPorSmsOLlamar')
                : t('home.laRedDeSaludTodaviaNo')}
            </span>
          </div>
          <button type="button" className="text-btn" onClick={onHistory}>
            {t('common.view')}{' '}<ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <section className="quick-grid" aria-label={t('home.accesosRapidos')}>
        <button type="button" className="quick-card" onClick={onHistory}>
          <span className="quick-icon quick-icon--green">
            <History size={21} aria-hidden="true" />
          </span>
          <span className="quick-title">{t('navigation.history')}</span>
          <span className="quick-sub">
            {alerts.length > 0
              ? t('home.enEsteTelefono', { count: alerts.length })
              : t('home.historialYEstadoDeEnvio')}
          </span>
        </button>
        <button type="button" className="quick-card" onClick={onOpenHelp}>
          <span className="quick-icon quick-icon--clay">
            <Phone size={21} aria-hidden="true" />
          </span>
          <span className="quick-title"><LocalizedText id="common.help" /></span>
          <span className="quick-sub">{t('home.samuBomberosPolicia')}</span>
        </button>
        <button type="button" className="quick-card" onClick={onCommunity} aria-disabled="true">
          <span className="quick-icon quick-icon--green">
            <Store size={21} aria-hidden="true" />
          </span>
          <span className="quick-title">{t('home.conectaAmazonia')}</span>
          <span className="quick-sub">{t('home.serviciosYCentrosDeApoyo')}</span>
        </button>
        <button
          type="button"
          className="quick-card"
          onClick={onOpenAssistant}
          aria-disabled="true"
        >
          <span className="quick-icon quick-icon--sand">
            <Sparkles size={21} aria-hidden="true" />
          </span>
          <span className="quick-title">{t('home.asistenteIa')}</span>
          <span className="quick-sub">{t('home.proximamente')}</span>
        </button>
        {session.role === 'admin' ? (
          <a
            className="quick-card"
            data-testid="home-admin-panel"
            href={Capacitor.isNativePlatform() && getNativeApiBase() ? `${getNativeApiBase()}/panel` : '/panel'}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              if (!Capacitor.isNativePlatform()) return;
              event.preventDefault();
              const server = getNativeApiBase();
              if (!server) {
                showToast(t('settings.nativeServerRequired'), 'error');
                return;
              }
              void Browser.open({ url: `${server}/panel` }).catch(() => {
                showToast(t('settings.nativePanelFailed'), 'error');
              });
            }}
          >
            <span className="quick-icon quick-icon--clay">
              <ShieldCheck size={21} aria-hidden="true" />
            </span>
            <span className="quick-title">{t('home.panelDeLaRed')}</span>
            <span className="quick-sub">{t('home.alertasYConfirmaciones')}</span>
          </a>
        ) : null}
      </section>

      <section className="recent">
        <div className="section-head">
          <h2>{t('home.ultimasAlertas')}</h2>
          {alerts.length > 0 ? (
            <button type="button" className="text-btn" onClick={onHistory}>
              {t('home.verTodas')}{' '}<ChevronRight size={14} aria-hidden="true" />
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
          <EmptyState icon={TriangleAlert} title={t('home.todaviaNoEnviasteAlertas')}>
            {t('home.cuandoEnviesUnaEmergenciaVerasAqui')}
          </EmptyState>
        )}
      </section>

      <p className="disclaimer">
        {t('home.manguareComplementaALosServiciosDe')}
      </p>
    </div>
  );
}
