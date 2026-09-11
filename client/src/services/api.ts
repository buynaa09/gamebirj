export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/api';

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

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (response.status === 204) {
    return undefined as T;
  }
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
