import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PanelApp } from './panel/PanelApp';
import './styles/base.css';
import './styles/panel.css';

const rootElement = document.getElementById('panel-root');
if (!rootElement) throw new Error('No se encontró el contenedor del panel.');

createRoot(rootElement).render(
  <StrictMode>
    <PanelApp />
  </StrictMode>,
);
