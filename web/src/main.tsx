import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/base.css';
import './styles/app.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No se encontró el contenedor de la app.');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker la app sigue funcionando en primer plano.
    });
  });
}
