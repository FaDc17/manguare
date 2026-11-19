import { History, House, Map, Settings2, Store, Users } from 'lucide-react';
import { useApp } from '../app/AppContext';

export type Tab = 'home' | 'community' | 'network' | 'map' | 'history' | 'settings';

export function BottomNav({
  active,
  onChange,
}: {
  active: Tab | null;
  onChange: (tab: Tab) => void;
}) {
  const { alerts } = useApp();
  const pending = alerts.filter((alert) => alert.state === 'pending').length;

  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      <button
        type="button"
        className={`nav-item ${active === 'home' ? 'is-active' : ''}`}
        data-testid="nav-home"
        onClick={() => onChange('home')}
        aria-current={active === 'home' ? 'page' : undefined}
      >
        <House size={22} aria-hidden="true" />
        <span>Inicio</span>
      </button>
      <button
        type="button"
        className={`nav-item ${active === 'community' ? 'is-active' : ''}`}
        data-testid="nav-community"
        onClick={() => onChange('community')}
        aria-current={active === 'community' ? 'page' : undefined}
      >
        <Store size={22} aria-hidden="true" />
        <span>Comunidad</span>
      </button>
      <button
        type="button"
        className={`nav-item ${active === 'network' ? 'is-active' : ''}`}
        data-testid="nav-network"
        onClick={() => onChange('network')}
        aria-current={active === 'network' ? 'page' : undefined}
      >
        <Users size={22} aria-hidden="true" />
        <span>Red</span>
      </button>
      <button
        type="button"
        className={`nav-item ${active === 'map' ? 'is-active' : ''}`}
        data-testid="nav-map"
        onClick={() => onChange('map')}
        aria-current={active === 'map' ? 'page' : undefined}
      >
        <Map size={22} aria-hidden="true" />
        <span>Mapa</span>
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
        <span>Mis alertas</span>
      </button>
      <button
        type="button"
        className={`nav-item ${active === 'settings' ? 'is-active' : ''}`}
        data-testid="nav-settings"
        onClick={() => onChange('settings')}
        aria-current={active === 'settings' ? 'page' : undefined}
      >
        <Settings2 size={22} aria-hidden="true" />
        <span>Ajustes</span>
      </button>
    </nav>
  );
}
