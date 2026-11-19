// Organiza las pantallas y vincula el selector de idioma con los avisos y diálogos de la app.

import { useTranslation } from './i18n/LanguageContext';
import { useState } from 'react';
import { AppProvider, useApp } from './app/AppContext';
import { SessionProvider, useSession } from './app/SessionContext';
import { BottomNav, type Tab } from './components/BottomNav';
import { HelpSheet } from './components/HelpSheet';
import { LanguageSheet } from './components/LanguageSheet';
import { Sheet } from './components/Sheet';
import { Toast } from './components/Toast';
import { TopBar } from './components/TopBar';
import { clearSession, loadSession, saveSession, type Session } from './lib/session';
import { SOS_DEFAULT_NOTE } from './lib/emergency';
import type { AlertLocation, BiodiversityCategory } from './lib/types';
import { MapScreen } from './screens/MapScreen';
import { AlertDetailScreen } from './screens/AlertDetailScreen';
import { BiodiversityReportScreen } from './screens/BiodiversityReportScreen';
import { CommunityScreen } from './screens/CommunityScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { NewAlertScreen } from './screens/NewAlertScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { isEffectivelyOnline } from './lib/sync';

type Screen =
  | { name: 'home' }
  | { name: 'community' }
  | { name: 'map' }
  | { name: 'biodiversity'; category?: BiodiversityCategory }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'new' }
  | { name: 'alert'; id: string };

function AppShell() {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [languageOpen, setLanguageOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sosConfirmOpen, setSosConfirmOpen] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const { createAlert, settings, showToast } = useApp();
  const { session } = useSession();

  const goHome = () => setScreen({ name: 'home' });
  const goCommunity = () => setScreen({ name: 'community' });
  const goHistory = () => setScreen({ name: 'history' });
  const goTab = (tab: Tab) => {
    if (tab === 'home') setScreen({ name: 'home' });
    else if (tab === 'community') setScreen({ name: 'community' });
    else if (tab === 'map') setScreen({ name: 'map' });
    else if (tab === 'history') setScreen({ name: 'history' });
    else setScreen({ name: 'settings' });
  };

  const activeTab: Tab | null =
    screen.name === 'home'
      ? 'home'
      : screen.name === 'community'
        ? 'community'
        : screen.name === 'map'
          ? 'map'
            : screen.name === 'history'
              ? 'history'
              : screen.name === 'settings'
                ? 'settings'
                : screen.name === 'alert'
                  ? 'history'
                  : null;

  return (
    <div className="app-backdrop">
      <div className={`app-shell ${screen.name === 'new' ? 'is-wizard' : ''}`}>
        {screen.name === 'home' ? <TopBar onLanguage={() => setLanguageOpen(true)} /> : null}

        <main className="app-main">
          {screen.name === 'home' ? (
            <HomeScreen
              onOpenAlert={(id) => setScreen({ name: 'alert', id })}
              onHistory={goHistory}
              onCommunity={() => setScreen({ name: 'community' })}
              onSOS={() => setSosConfirmOpen(true)}
              onOpenLanguage={() => setLanguageOpen(true)}
              onOpenHelp={() => setHelpOpen(true)}
            />
          ) : null}

          {screen.name === 'community' ? (
            <CommunityScreen
              onReportBiodiversity={(category) =>
                setScreen({ name: 'biodiversity', category })
              }
            />
          ) : null}

          {screen.name === 'map' ? (
            <MapScreen onSOS={() => setSosConfirmOpen(true)} />
          ) : null}

          {screen.name === 'biodiversity' ? (
            <BiodiversityReportScreen
              category={screen.category}
              onCancel={goCommunity}
            />
          ) : null}

          {screen.name === 'history' ? (
            <HistoryScreen
              onOpenAlert={(id) => setScreen({ name: 'alert', id })}
              onNew={() => setScreen({ name: 'new' })}
            />
          ) : null}

          {screen.name === 'settings' ? (
            <SettingsScreen onOpenLanguage={() => setLanguageOpen(true)} />
          ) : null}

          {screen.name === 'new' ? (
            <NewAlertScreen
              onCancel={goHome}
              onCreated={(id) => setScreen({ name: 'alert', id })}
            />
          ) : null}

          {screen.name === 'alert' ? (
            <AlertDetailScreen
              id={screen.id}
              onBack={goHistory}
              onHistory={goHistory}
            />
          ) : null}
        </main>

        {screen.name !== 'new' ? (
          <BottomNav
            active={activeTab}
            onChange={goTab}
          />
        ) : null}

        <LanguageSheet open={languageOpen} onClose={() => setLanguageOpen(false)} />
        <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />
        <Toast behindSheet={languageOpen || helpOpen || sosConfirmOpen} />

        <Sheet
          open={sosConfirmOpen}
          title={t('sos.deseaEnviarUnaAlertaDeEmergencia')}
          onClose={() => {
            if (!sosSending) setSosConfirmOpen(false);
          }}
          footer={
            <div className="sos-confirm-actions">
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                data-testid="sos-confirm-cancel"
                disabled={sosSending}
                onClick={() => setSosConfirmOpen(false)}
              >
                {t('common.no')}
              </button>
              <button
                type="button"
                className="btn btn-danger btn-lg"
                data-testid="sos-confirm-send"
                disabled={sosSending}
                onClick={() => void sendSosAlert()}
              >
                {sosSending ? t('sos.enviando') : t('sos.siEnviar')}
              </button>
            </div>
          }
        >
          <p className="sheet-intro">
            {t('sos.enviaremosTuNombreLaHoraY')}
          </p>
        </Sheet>
      </div>
    </div>
  );

  async function sendSosAlert() {
    if (sosSending) return;
    setSosSending(true);
    try {
      const location = await captureSosLocation();
      const alert = await createAlert({
        type: 'otro',
        isSos: true,
        note: SOS_DEFAULT_NOTE,
        community: settings.community,
        deviceName: settings.deviceName,
        reportedBy: session.name,
        reporterPhone: session.phone,
        location,
        consentLocation: Boolean(location),
      });
      setSosConfirmOpen(false);
      setScreen({ name: 'alert', id: alert.id });
      if (!location) {
        showToast(t('sos.noSeObtuvoElGpsLa'), 'warn');
      } else if (!isEffectivelyOnline()) {
        showToast(t('sos.alertaPendienteSeEnviaraAlRecuperar'), 'warn');
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t('sos.noSePudoGuardarLaAlerta'),
        'error',
      );
    } finally {
      setSosSending(false);
    }
  }
}

export function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');

  if (!session) {
    if (authScreen === 'register') {
      return (
        <RegisterScreen
          onCancel={() => setAuthScreen('login')}
          onRegistered={(next) => {
            saveSession(next);
            setSession(next);
            setAuthScreen('login');
          }}
        />
      );
    }
    return (
      <LoginScreen
        onLogin={(next) => {
          saveSession(next);
          setSession(next);
        }}
        onRegister={() => setAuthScreen('register')}
      />
    );
  }

  return (
    <SessionProvider
      session={session}
      logout={() => {
        clearSession();
        setSession(null);
        setAuthScreen('login');
      }}
    >
      <AppProvider>
        <AppShell />
      </AppProvider>
    </SessionProvider>
  );
}

function captureSosLocation(): Promise<AlertLocation | undefined> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy),
          capturedAt: new Date(position.timestamp).toISOString(),
        });
      },
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 },
    );
  });
}
