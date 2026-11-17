import { Check, Languages } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { LANGUAGES } from '../lib/settings';
import { Sheet } from './Sheet';

export function LanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings, showToast } = useApp();

  return (
    <Sheet open={open} title="Idioma" onClose={onClose}>
      <p className="sheet-intro">
        Elige el idioma de la interfaz. Los textos y audios en lenguas locales deben validarse con
        hablantes de la comunidad antes de usarse.
      </p>
      <div className="lang-list">
        {LANGUAGES.map((language) => {
          const active = settings.language === language.id;
          return (
            <button
              key={language.id}
              type="button"
              className={`lang-option ${active ? 'is-active' : ''}`}
              onClick={() => {
                updateSettings({ language: language.id });
                showToast(
                  language.id === 'es'
                    ? 'Idioma: español.'
                    : `${language.label}: traducción pendiente. Se muestra español como respaldo.`,
                  language.id === 'es' ? 'ok' : 'warn',
                );
                onClose();
              }}
            >
              <span className="lang-icon">
                <Languages size={20} aria-hidden="true" />
              </span>
              <span className="lang-copy">
                <span className="lang-name">
                  {language.label}
                  <span className={`lang-badge ${language.status === 'listo' ? 'is-ready' : ''}`}>
                    {language.status === 'listo' ? 'Disponible' : 'Pendiente'}
                  </span>
                </span>
                <span className="lang-note">{language.note}</span>
              </span>
              {active ? <Check size={20} className="lang-check" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      <div className="notice-box">
        <strong>Sin voces sintéticas</strong>
        <p>
          Los audios en awajún y shawi se grabarán con hablantes de la comunidad. Mientras tanto, la
          app muestra español y un audio de demostración en castellano.
        </p>
      </div>
    </Sheet>
  );
}
