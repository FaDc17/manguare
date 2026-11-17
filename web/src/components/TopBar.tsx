import { Globe } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { BrandMark } from './BrandMark';
import { ConnectionPill } from './ConnectionPill';

export function TopBar({ onLanguage }: { onLanguage: () => void }) {
  const { online, settings } = useApp();

  return (
    <header className="topbar">
      <div className="brand">
        <BrandMark size={38} />
        <div className="brand-copy">
          <span className="brand-name">Manguaré</span>
          <span className="brand-sub">Emergencias</span>
        </div>
      </div>
      <div className="topbar-actions">
        {settings.simulateOffline ? <span className="demo-chip">Demo</span> : null}
        <ConnectionPill online={online} />
        <button
          type="button"
          className="icon-btn lang-btn"
          onClick={onLanguage}
          aria-label="Cambiar idioma"
        >
          <Globe size={20} aria-hidden="true" />
          <span className="lang-code">{settings.language.toUpperCase()}</span>
        </button>
      </div>
    </header>
  );
}
