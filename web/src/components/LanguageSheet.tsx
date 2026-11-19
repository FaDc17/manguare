// Muestra los idiomas disponibles, el idioma activo y la disponibilidad de textos y audio.

import { Check, Languages } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { isLanguageComplete, LANGUAGES, message } from '../i18n/catalog';
import { useTranslation } from '../i18n/LanguageContext';
import { MIXED_AUDIO_NOTE } from '../lib/audio';
import { Sheet } from './Sheet';

export function LanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showToast } = useApp();
  const { language, setLanguage, t, visualMessages } = useTranslation();

  return (
    <Sheet open={open} title={t('settings.language')} onClose={onClose}>
      <p className="sheet-intro">
        {t(LANGUAGES.every(({ id }) => isLanguageComplete(id)) ? 'language.completeIntro' : 'language.intro')}
        {visualMessages ? <span lang="es">{' La beta mezcla español, términos del idioma elegido y rótulos simulados.'}</span> : null}
      </p>
      <div className="lang-list">
        {LANGUAGES.map((option) => {
          const active = language === option.id;
          const complete = isLanguageComplete(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className={`lang-option ${active ? 'is-active' : ''}`}
              aria-pressed={active}
              data-testid={`language-${option.id}`}
              onClick={() => {
                setLanguage(option.id);
                showToast(
                  message(complete ? 'language.selected' : 'language.selectedPartial', { language: option.label }),
                  complete ? 'ok' : 'warn',
                );
                onClose();
              }}
            >
              <span className="lang-icon">
                <Languages size={20} aria-hidden="true" />
              </span>
              <span className="lang-copy">
                <span className="lang-name">
                  {option.label}
                  <span className={`lang-badge ${complete ? 'is-ready' : ''}`}>
                    {t(complete ? 'language.complete' : 'language.partial')}
                  </span>
                </span>
                {complete ? null : <span className="lang-note">{t('language.partialNote')}</span>}
              </span>
              {active ? <Check size={20} className="lang-check" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      <div className="notice-box">
        <strong>{t('language.audioTitle')}</strong>
        <p>{visualMessages ? MIXED_AUDIO_NOTE : t('language.audioNote')}</p>
      </div>
    </Sheet>
  );
}
