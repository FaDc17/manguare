// Comparte el idioma entre las pantallas y conserva la selección al volver a abrir la app.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadSettings, saveSettings } from '../lib/settings';
import { isLanguageComplete, messageLanguage, translate, type Language, type MessageKey, type Translate, type VisualCatalog } from './catalog';

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (next: Language) => void;
  visualSimulation: boolean;
  visualMessages?: VisualCatalog;
  t: Translate;
} | null>(null);

export function LanguageProvider({ children, titleKey, visualMessages }: {
  children: ReactNode;
  titleKey: MessageKey;
  visualMessages?: VisualCatalog;
}) {
  const [language, setLanguage] = useState(() => loadSettings().language);
  // Actualiza solo el idioma y conserva las demás preferencias guardadas.
  const changeLanguage = useCallback((next: Language) => {
    saveSettings({ ...loadSettings(), language: next });
    setLanguage(next);
  }, []);
  const value = useMemo(() => ({
    language,
    setLanguage: changeLanguage,
    visualSimulation: Boolean(visualMessages && language !== 'es'),
    visualMessages,
    t: (key: MessageKey, values?: Parameters<typeof translate>[2]) => translate(language, key, values, visualMessages),
  }), [language, changeLanguage, visualMessages]);

  useEffect(() => {
    document.documentElement.lang = isLanguageComplete(language) ? language : 'es';
    document.title = translate(language, titleKey);
  }, [language, titleKey]);


  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('LanguageProvider is required');
  return context;
}

// Identifica el idioma de la etiqueta para los lectores de pantalla.
export function LocalizedText({ id, values }: {
  id: MessageKey;
  values?: Parameters<Translate>[1];
}) {
  const { language, visualMessages, t } = useTranslation();
  const source = messageLanguage(language, id);
  const simulated = language !== 'es' && source === 'es' && visualMessages?.[language][id];
  return <span lang={simulated ? 'und' : source}>{t(id, values)}</span>;
}
