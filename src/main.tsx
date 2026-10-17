import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { syncThemeColor } from './lib/palette';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('index.html is missing <div id="root">.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

syncThemeColor();
registerServiceWorker();
