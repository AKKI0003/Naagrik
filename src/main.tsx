import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Belt-and-suspenders alongside skipWaiting/clientsClaim in
// vite.config.ts: proactively ask the browser to check for a new
// service-worker build on load and whenever the tab regains focus,
// instead of only relying on the browser's own (much less frequent)
// background check interval. This is what makes "I just deployed an
// update" actually show up promptly instead of requiring the user to
// fully quit and reopen the installed app.
if ('serviceWorker' in navigator) {
  const checkForUpdate = () => {
    navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
  };
  window.addEventListener('load', checkForUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
}
