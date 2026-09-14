export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api';

/** Async supplier of the Clerk session JWT. Registered once Clerk is mounted
 *  (see ClerkTokenBridge) so plain service modules can stay hook-free. */
type TokenProvider = () => Promise<string | null>;
let tokenProvider: TokenProvider | null = null;

export function setAuthTokenProvider(provider: TokenProvider | null): void {
  tokenProvider = provider;
}

async function authHeaders(): Promise<Headers> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const token = await tokenProvider?.();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

/** Resolve a media URL: absolute URLs pass through, relative ones (WS events)
 *  are resolved against the API origin (same host that serves /media/). */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const origin = API_BASE.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}

interface ErrorPayload {
  detail?: unknown;
}

export function extractErrorDetail(payload: unknown, fallback: string): string {
  if (typeof payload === 'object' && payload !== null) {
    const detail = (payload as ErrorPayload).detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function throwIfBad(response: Response, payload: unknown): void {
  if (!response.ok) {
    throw new Error(extractErrorDetail(payload, `Request failed (${response.status})`));
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const response = await fetch(`${API_BASE}${path}`, { headers, credentials: 'include' });
  if (response.status === 204) {
    return undefined as T;
  }
  const payload = await parseJson(response);
  throwIfBad(response, payload);
  return payload as T;
}

async function apiSend<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body: unknown): Promise<T> {
  const headers = await authHeaders();

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const payload = await parseJson(response);
  throwIfBad(response, payload);
  return payload as T;
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiSend<T>('POST', path, body);
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiSend<T>('PATCH', path, body);
}

export function apiDelete<T>(path: string): Promise<T> {
  return apiSend<T>('DELETE', path, undefined);
}

export async function postForm<T>(path: string, form: FormData): Promise<T> {
  const headers = new Headers();
  const token = await tokenProvider?.();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: form,
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  if (!response.ok) {
    throw new Error(extractErrorDetail(payload, `Request failed (${response.status})`));
  }
  return payload as T;
}
