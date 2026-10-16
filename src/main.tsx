import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { FloatingHUD } from './components/FloatingHUD';

const isHudWindow = typeof window !== 'undefined' && window.location.search.includes('window=hud');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isHudWindow ? <FloatingHUD isNativeWindow={true} /> : <App />}
  </React.StrictMode>
);
