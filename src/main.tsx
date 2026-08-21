import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (args.some(arg => typeof arg === 'string' && (arg.includes('Realtime got disconnected') || arg.includes('Reconnect will be attempted') || arg.includes('Script error') || arg.includes('Database is closing')))) {
    return;
  }
  originalConsoleError(...args);
};

window.addEventListener('error', (event) => {
  if (event.message === 'Script error.' || event.message?.includes('Database is closing') || !event.filename) {
    event.preventDefault();
    return true;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
