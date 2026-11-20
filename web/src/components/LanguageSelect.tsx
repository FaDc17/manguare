// Selector compacto de idioma para el ingreso, el registro y el panel de salud.

import { Globe } from 'lucide-react';
import { LANGUAGES, normalizeLanguage } from '../i18n/catalog';
import { useTranslation } from '../i18n/LanguageContext';

export function LanguageSelect() {
  const { language, setLanguage, t, visualMessages } = useTranslation();
  return (
    <label className="language-select">
      <Globe size={17} aria-hidden="true" />
      <select
        aria-label={t('topBar.cambiarIdioma')}
        title={visualMessages ? 'Beta con español, términos del idioma elegido y rótulos simulados' : undefined}
        data-testid="language-select"
        value={language}
        onChange={(event) => setLanguage(normalizeLanguage(event.target.value))}
      >
        {LANGUAGES.map(({ id, label }) => <option key={id} value={id} lang={id}>{label}</option>)}
      </select>
    </label>
  );
}
