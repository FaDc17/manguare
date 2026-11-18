import { useState } from 'react';
import { AppProvider } from './app/AppContext';
import { SessionProvider } from './app/SessionContext';
import { BottomNav, type Tab } from './components/BottomNav';
import { HelpSheet } from './components/HelpSheet';
import { LanguageSheet } from './components/LanguageSheet';
import { Toast } from './components/Toast';
import { TopBar } from './components/TopBar';
import { clearSession, loadSession, saveSession, type Session } from './lib/session';
import { AlertDetailScreen } from './screens/AlertDetailScreen';
import { CommunityScreen } from './screens/CommunityScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { NewAlertScreen } from './screens/NewAlertScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type Screen =
  | { name: 'home' }
  | { name: 'community' }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'new' }
  | { name: 'alert'; id: string };

function AppShell() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [languageOpen, setLanguageOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const goHome = () => setScreen({ name: 'home' });
  const goHistory = () => setScreen({ name: 'history' });
  const goTab = (tab: Tab) => {
    if (tab === 'home') setScreen({ name: 'home' });
    else if (tab === 'community') setScreen({ name: 'community' });
    else if (tab === 'history') setScreen({ name: 'history' });
    else setScreen({ name: 'settings' });
  };

  const activeTab: Tab | null =
    screen.name === 'home'
      ? 'home'
      : screen.name === 'community'
        ? 'community'
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
              onNew={() => setScreen({ name: 'new' })}
              onOpenAlert={(id) => setScreen({ name: 'alert', id })}
              onHistory={goHistory}
              onCommunity={() => setScreen({ name: 'community' })}
              onOpenLanguage={() => setLanguageOpen(true)}
              onOpenHelp={() => setHelpOpen(true)}
            />
          ) : null}

          {screen.name === 'community' ? <CommunityScreen /> : null}

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
        <Toast />
      </div>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  if (!session) {
    return (
      <LoginScreen
        onLogin={(next) => {
          saveSession(next);
          setSession(next);
        }}
      />
    );
  }

  return (
    <SessionProvider
      session={session}
      logout={() => {
        clearSession();
        setSession(null);
      }}
    >
      <AppProvider>
        <AppShell />
      </AppProvider>
    </SessionProvider>
  );
}
