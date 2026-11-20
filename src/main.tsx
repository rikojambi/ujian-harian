import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerPwa } from './pwa/register';

const container = document.getElementById('root');
if (!container) throw new Error('Elemen #root tidak ditemukan.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerPwa();
}
