import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

try {
  const isLocalhost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isLocalhost) {
    const orig = console.error;
    console.error = (...args) => {
      const msg = args && args[0] ? String(args[0]) : '';
      if (msg.includes('Firestore/Listen/channel') || msg.includes('net::ERR_ABORTED')) return;
      orig(...args);
    };
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
