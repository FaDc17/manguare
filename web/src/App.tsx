import { useState } from 'react';
import { AppProvider } from './app/AppContext';
import { BottomNav, type Tab } from './components/BottomNav';
import { HelpSheet } from './components/HelpSheet';
import { LanguageSheet } from './components/LanguageSheet';
import { Toast } from './components/Toast';
import { TopBar } from './components/TopBar';
import { AlertDetailScreen } from './screens/AlertDetailScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NewAlertScreen } from './screens/NewAlertScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type Screen =
  | { name: 'home' }
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
    else if (tab === 'history') setScreen({ name: 'history' });
    else setScreen({ name: 'settings' });
  };

  const activeTab: Tab | null =
    screen.name === 'home'
      ? 'home'
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
              onOpenLanguage={() => setLanguageOpen(true)}
              onOpenHelp={() => setHelpOpen(true)}
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
        <Toast />
      </div>
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
