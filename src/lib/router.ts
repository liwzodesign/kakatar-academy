/**
 * Mini-routeur basé sur l'History API (sans dépendance).
 * Les URL réelles permettent les retours de paiement, les liens d'emails et le rafraîchissement.
 */
import { useEffect, useState } from 'react';

const EVENT = 'kakatar:navigate';

export function navigate(path: string, options: { replace?: boolean } = {}) {
  if (path === window.location.pathname + window.location.search) return;
  if (options.replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
  window.dispatchEvent(new Event(EVENT));
  window.scrollTo({ top: 0 });
}

export function useLocation() {
  const [location, setLocation] = useState(() => ({
    path: window.location.pathname,
    query: new URLSearchParams(window.location.search),
  }));
  useEffect(() => {
    const update = () =>
      setLocation({ path: window.location.pathname, query: new URLSearchParams(window.location.search) });
    window.addEventListener('popstate', update);
    window.addEventListener(EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(EVENT, update);
    };
  }, []);
  return location;
}

/** Compare un chemin à un motif « /courses/:slug » et renvoie les paramètres. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}
