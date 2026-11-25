// Muestra la marca, la conectividad y el acceso para cambiar de idioma.

import { useTranslation } from '../i18n/LanguageContext';
import { Globe } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { BrandMark } from './BrandMark';
import { ConnectionPill } from './ConnectionPill';

export function TopBar({ onLanguage }: { onLanguage: () => void }) {
  const { t, language } = useTranslation();
  const { online } = useApp();

  return (
    <header className="topbar">
      <div className="brand">
        <BrandMark size={38} />
        <div className="brand-copy">
          <span className="brand-name">Manguaré</span>
          <span className="brand-sub">{t('topBar.emergencias')}</span>
        </div>
      </div>
      <div className="topbar-actions">
        <ConnectionPill online={online} />
        <button
          type="button"
          className="icon-btn lang-btn"
          onClick={onLanguage}
          aria-label={t('topBar.cambiarIdioma')}
        >
          <Globe size={20} aria-hidden="true" />
          <span className="lang-code">{language.toUpperCase()}</span>
        </button>
      </div>
    </header>
  );
}
