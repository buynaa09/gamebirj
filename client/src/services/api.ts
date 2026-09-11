export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api';

export function getCsrfToken(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : undefined;
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
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (response.status === 204) {
    return undefined as T;
  }
  const payload = await parseJson(response);
  throwIfBad(response, payload);
  return payload as T;
}

async function apiSend<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body: unknown): Promise<T> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const csrf = getCsrfToken();
  if (csrf) headers.set('X-CSRFToken', csrf);

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
  const csrf = getCsrfToken();
  if (csrf) headers.set('X-CSRFToken', csrf);

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
