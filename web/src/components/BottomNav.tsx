// Muestra las etiquetas de navegación y el contador de alertas pendientes.

import { LocalizedText, useTranslation } from '../i18n/LanguageContext';
import { History, House, Map, Settings2, Store } from 'lucide-react';
import { useApp } from '../app/AppContext';

export type Tab = 'home' | 'community' | 'map' | 'history' | 'settings';

export function BottomNav({
  active,
  onChange,
}: {
  active: Tab | null;
  onChange: (tab: Tab) => void;
}) {
  const { t } = useTranslation();
  const { alerts } = useApp();
  const pending = alerts.filter((alert) => alert.state === 'pending').length;

  return (
    <nav className="bottom-nav" aria-label={t('navigation.navegacionPrincipal')}>
      <button
        type="button"
        className={`nav-item ${active === 'home' ? 'is-active' : ''}`}
        data-testid="nav-home"
        onClick={() => onChange('home')}
        aria-current={active === 'home' ? 'page' : undefined}
      >
        <House size={22} aria-hidden="true" />
        <LocalizedText id="navigation.home" />
      </button>
      <button
        type="button"
        className={`nav-item ${active === 'community' ? 'is-active' : ''}`}
        data-testid="nav-community"
        onClick={() => onChange('community')}
        aria-current={active === 'community' ? 'page' : undefined}
      >
        <Store size={22} aria-hidden="true" />
        <LocalizedText id="common.community" />
      </button>
      <button
        type="button"
        className={`nav-item ${active === 'map' ? 'is-active' : ''}`}
        data-testid="nav-map"
        onClick={() => onChange('map')}
        aria-current={active === 'map' ? 'page' : undefined}
      >
        <Map size={22} aria-hidden="true" />
        <LocalizedText id="navigation.map" />
      </button>
      <button
        type="button"
        className={`nav-item ${active === 'history' ? 'is-active' : ''}`}
        data-testid="nav-history"
        onClick={() => onChange('history')}
        aria-current={active === 'history' ? 'page' : undefined}
      >
        <span className="nav-icon">
          <History size={22} aria-hidden="true" />
          {pending > 0 ? <span className="nav-badge">{pending}</span> : null}
        </span>
        <LocalizedText id="navigation.history" />
      </button>
      <button
        type="button"
        className={`nav-item ${active === 'settings' ? 'is-active' : ''}`}
        data-testid="nav-settings"
        onClick={() => onChange('settings')}
        aria-current={active === 'settings' ? 'page' : undefined}
      >
        <Settings2 size={22} aria-hidden="true" />
        <span>{t('navigation.settings')}</span>
      </button>
    </nav>
  );
}
