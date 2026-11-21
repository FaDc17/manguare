// Inicia el panel de salud con el mismo catálogo y la misma preferencia de idioma.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PanelApp } from './panel/PanelApp';
import { LanguageProvider } from './i18n/LanguageContext';
import visualMessages from './locales/simulacion-visual.json';
import './styles/base.css';
import './styles/panel.css';

const rootElement = document.getElementById('panel-root');
if (!rootElement) throw new Error('No se encontró el contenedor del panel.');

createRoot(rootElement).render(
  <StrictMode>
    <LanguageProvider
      titleKey="document.panelTitle"
      visualMessages={import.meta.env.MODE === 'beta-visual' ? visualMessages : undefined}
    >
      <PanelApp />
    </LanguageProvider>
  </StrictMode>,
);
