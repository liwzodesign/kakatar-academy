/**
 * Client HTTP de l'API Kakatar Academy.
 * - Ajoute le jeton JWT (Authorization: Bearer …)
 * - Rafraîchit automatiquement le jeton d'accès expiré (une seule fois par requête)
 * - Normalise les erreurs DRF en messages lisibles
 */
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api/v1';

const ACCESS_KEY = 'kakatar_access';
const REFRESH_KEY = 'kakatar_refresh';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, data: any) {
    super(friendlyMessage(status, data));
    this.status = status;
    this.data = data;
  }
}

/** Message lisible : jamais de HTML brut ni de détail technique affiché à l'utilisateur. */
function friendlyMessage(status: number, data: any): string {
  const isHtml = typeof data === 'string' && /<\s*(html|!doctype|head|body)/i.test(data);
  if (status === 0 && data === 'offline') return 'Pas de connexion internet. Vérifiez votre réseau puis réessayez.';
  if (status >= 500 || isHtml || status === 0) {
    return 'Le service est momentanément indisponible. Réessayez dans quelques instants.';
  }
  if (status === 429) return 'Trop de tentatives. Patientez un instant avant de réessayer.';
  if (status === 404 && !extractMessage(data)) return 'Élément introuvable.';
  if (status === 403 && !extractMessage(data)) return "Vous n'avez pas accès à cette page.";
  return extractMessage(data) || `Une erreur est survenue (${status}).`;
}

function extractMessage(data: any): string {
  if (!data) return '';
  if (typeof data === 'string') return data.slice(0, 300);
  if (data.error) return String(data.error);
  if (data.detail) return String(data.detail);
  if (Array.isArray(data)) return data.map(extractMessage).filter(Boolean).join(' ');
  if (typeof data === 'object') {
    const first = Object.entries(data).find(([key]) => key !== 'otp_required');
    if (first) {
      const [field, value] = first;
      const msg = Array.isArray(value) ? value.join(' ') : extractMessage(value);
      return field === 'non_field_errors' ? msg : `${field} : ${msg}`;
    }
  }
  return '';
}

let refreshing: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokens.refresh;
  if (!refresh) return false;
  if (!refreshing) {
    refreshing = fetch(`${API_URL.replace(/\/v1$/, '')}/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        tokens.set(data.access, data.refresh);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshing = null), 0);
      });
  }
  return refreshing;
}

type Options = {
  method?: string;
  body?: any;
  params?: Record<string, string | number | boolean | undefined | null>;
  raw?: boolean; // renvoie la Response brute (téléchargements)
};

export async function request<T = any>(path: string, options: Options = {}, retry = true): Promise<T> {
  const url = new URL(`${API_URL}${path}`, window.location.origin);
  Object.entries(options.params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  const headers: Record<string, string> = {};
  const isForm = options.body instanceof FormData;
  if (options.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`;

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: options.method || (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body === undefined ? undefined : isForm ? options.body : JSON.stringify(options.body),
    });
  } catch {
    // Pas de réseau (mobile hors couverture, serveur injoignable…)
    throw new ApiError(0, navigator.onLine ? null : 'offline');
  }

  if (res.status === 401 && retry && tokens.refresh) {
    if (await refreshAccessToken()) return request<T>(path, options, false);
    tokens.clear();
    window.dispatchEvent(new Event('kakatar:logout'));
  }

  if (options.raw) {
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return res as unknown as T;
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T = any>(path: string, params?: Options['params']) => request<T>(path, { params }),
  post: <T = any>(path: string, body: any = {}) => request<T>(path, { method: 'POST', body }),
  patch: <T = any>(path: string, body: any) => request<T>(path, { method: 'PATCH', body }),
  put: <T = any>(path: string, body: any) => request<T>(path, { method: 'PUT', body }),
  delete: <T = any>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Les listes DRF paginées renvoient {results}, les autres un tableau. */
export function unwrap<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data?.results || [];
}

/** Télécharge un fichier protégé (export CSV, ressource achetée). */
export async function downloadFile(path: string, fallbackName: string) {
  const res = await request<Response>(path, { raw: true });
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = match ? match[1] : fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
