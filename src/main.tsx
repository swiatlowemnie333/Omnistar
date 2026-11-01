import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ===== BEZPIECZENSTWO: token dostepu (pytany raz, trzymany w tej przegladarce) =====
let omniToken = localStorage.getItem('omnistar_token') || '';
if (!omniToken) {
  omniToken = (window.prompt('Podaj OMNISTAR_TOKEN (z pliku .env na serwerze):') || '').trim();
  if (omniToken) localStorage.setItem('omnistar_token', omniToken);
}
const origFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('/api') || url.startsWith(window.location.origin + '/api')) {
    const headers = new Headers(init.headers || {});
    headers.set('x-omnistar-token', omniToken);
    init = { ...init, headers };
  }
  return origFetch(input, init);
};
const OrigWS = window.WebSocket;
class TokenWS extends OrigWS {
  constructor(url: string | URL, protocols?: string | string[]) {
    const u = new URL(String(url), window.location.href);
    if (u.host === window.location.host) u.searchParams.set('token', omniToken);
    super(u.toString(), protocols);
  }
}
(window as any).WebSocket = TokenWS;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
