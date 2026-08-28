import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppProvider } from './context/AppContext.tsx';
import './index.css';

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.warn = (...args: any[]) => {
  if (args.some(arg => {
    const str = typeof arg === 'string' ? arg : (arg?.message || JSON.stringify(arg) || '');
    return str.includes('Database is closing') ||
           str.includes('closing/hidden') ||
           str.includes('error 0') ||
           str.includes('Database is closing/hidden');
  })) {
    return;
  }
  originalConsoleWarn(...args);
};

console.error = (...args: any[]) => {
  if (args.some(arg => {
    const str = typeof arg === 'string' ? arg : (arg?.message || JSON.stringify(arg) || '');
    return str.includes('Realtime got disconnected') || 
           str.includes('Reconnect will be attempted') || 
           str.includes('Script error') || 
           str.includes('Database is closing') ||
           str.includes('closing/hidden') ||
           str.includes('error 0') ||
           str.includes('Database is closing/hidden');
  })) {
    return;
  }
  originalConsoleError(...args);
};

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  if (msg === 'Script error.' || 
      msg.includes('Database is closing') || 
      msg.includes('closing/hidden') ||
      msg.includes('error 0') ||
      msg.includes('Database is closing/hidden') ||
      !event.filename) {
    event.preventDefault();
    return true;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = typeof reason === 'string' ? reason : (reason?.message || JSON.stringify(reason) || '');
  if (msg.includes('Database is closing') || 
      msg.includes('closing/hidden') || 
      msg.includes('error 0') ||
      msg.includes('Database is closing/hidden') ||
      reason?.code === 0) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
