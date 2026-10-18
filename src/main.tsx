import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { FloatingHUD } from './components/FloatingHUD';
import { RootErrorBoundary } from './components/ui';

// Guard against unhandled asynchronous rejections or global script errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('[FocusSpace Global Unhandled Error]', event.error || event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[FocusSpace Unhandled Promise Rejection]', event.reason);
  });
}

const isHudWindow = typeof window !== 'undefined' && window.location.search.includes('window=hud');
if (isHudWindow && typeof document !== 'undefined') {
  document.documentElement.classList.add('hud-window');
  document.body.classList.add('hud-window');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      {isHudWindow ? <FloatingHUD isNativeWindow={true} /> : <App />}
    </RootErrorBoundary>
  </React.StrictMode>
);
