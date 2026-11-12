import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ===== BEZPIECZENSTWO: token dostepu (trzymany w localStorage przegladarki) =====
const omniToken = typeof window !== 'undefined' ? localStorage.getItem('omnistar_token') || '' : '';

// Bezpieczne wstrzykniecie naglowka do fetch bez nadpisywania wlasciwosci 'window.fetch' bezposrednio
if (typeof window !== 'undefined') {
  try {
    const origFetch = window.fetch;
    const customFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const token = localStorage.getItem('omnistar_token') || omniToken;
      if (token && (url.startsWith('/api') || url.startsWith(window.location.origin + '/api'))) {
        const headers = new Headers(init.headers || {});
        headers.set('x-omnistar-token', token);
        init = { ...init, headers };
      }
      return origFetch(input, init);
    };

    // Definiujemy deskryptor, obslugujac srodowiska z read-only getterem
    try {
      Object.defineProperty(window, 'fetch', {
        value: customFetch,
        writable: true,
        configurable: true
      });
    } catch {
      // Fallback jesli deskryptor jest zablokowany
      try {
        (window as any).fetch = customFetch;
      } catch {
        // Ignoruj jesli srodowisko zabrania redefinicji fetch
      }
    }

    // Bezpieczne wstrzykniecie tokenu do WebSocket
    const OrigWS = window.WebSocket;
    if (OrigWS) {
      class TokenWS extends OrigWS {
        constructor(url: string | URL, protocols?: string | string[]) {
          const u = new URL(String(url), window.location.href);
          const token = localStorage.getItem('omnistar_token') || omniToken;
          if (token && u.host === window.location.host) {
            u.searchParams.set('token', token);
          }
          super(u.toString(), protocols);
        }
      }
      try {
        Object.defineProperty(window, 'WebSocket', {
          value: TokenWS,
          writable: true,
          configurable: true
        });
      } catch {
        try {
          (window as any).WebSocket = TokenWS;
        } catch {
          // Ignoruj jesli zablokowane
        }
      }
    }
  } catch (e) {
    console.warn('Nie udalo sie zainicjalizowac nakladki tokenu:', e);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
