// Inicia la aplicación y activa los textos simulados en la compilación beta visual.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Splash } from './components/Splash';
import { LanguageProvider } from './i18n/LanguageContext';
import visualMessages from './locales/simulacion-visual.json';
import './styles/base.css';
import './styles/app.css';
import './styles/features.css';
import './styles/network.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No se encontró el contenedor de la app.');

createRoot(rootElement).render(
  <StrictMode>
    <LanguageProvider
      titleKey="document.appTitle"
      visualMessages={import.meta.env.MODE === 'beta-visual' ? visualMessages : undefined}
    >
      <App />
      <Splash />
    </LanguageProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker la app sigue funcionando en primer plano.
    });
  });
}
