/** Client HTTP de l'API Django : JWT stocké localement, rafraîchi automatiquement. */
// Vide = même domaine que le site (déploiement Docker derrière Nginx)
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

const ACCESS = 'ka_access';
const REFRESH = 'ka_refresh';

export const tokens = {
  get access() { return localStorage.getItem(ACCESS); },
  get refresh() { return localStorage.getItem(REFRESH); },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown) {
    super(extractMessage(data) || `Erreur ${status}`);
    this.status = status;
    this.data = data;
  }
}

/** Transforme les erreurs DRF ({champ: [msg]}, {detail}, {error}) en une phrase lisible. */
function extractMessage(data: unknown): string {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return data.map(extractMessage).filter(Boolean).join(' ');
  if (typeof data === 'object') {
    const d = data as Record<string, unknown>;
    for (const key of ['error', 'detail', 'non_field_errors']) {
      if (d[key]) return extractMessage(d[key]);
    }
    return Object.values(d).map(extractMessage).filter(Boolean).join(' ');
  }
  return '';
}

let refreshing: Promise<boolean> | null = null;

async function refreshAccess(): Promise<boolean> {
  const refresh = tokens.refresh;
  if (!refresh) return false;
  refreshing ??= fetch(`${API_URL}/api/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
    .then(async (r) => {
      if (!r.ok) { tokens.clear(); return false; }
      const data = await r.json();
      tokens.set(data.access, data.refresh);
      return true;
    })
    .catch(() => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

type Options = { method?: string; body?: unknown; raw?: boolean };

export async function api<T = unknown>(path: string, opts: Options = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`;

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && retry && tokens.refresh) {
    if (await refreshAccess()) return api<T>(path, opts, false);
  }
  if (opts.raw) {
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return res as unknown as T;
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

/** Télécharge un fichier protégé (ex. certificat PDF) et déclenche l'enregistrement. */
export async function downloadFile(path: string, filename: string) {
  const res = await api<Response>(path, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
