import type { SignupInput, User } from '../types';
import { API_BASE, getCsrfToken } from './api';

export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface ErrorPayload {
  detail?: unknown;
}

function extractDetail(payload: unknown): string | undefined {
  if (typeof payload === 'object' && payload !== null) {
    const detail = (payload as ErrorPayload).detail;
    if (typeof detail === 'string') return detail;
  }
  return undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  const csrf = getCsrfToken();
  if (csrf && init?.method && init.method !== 'GET') {
    headers.set('X-CSRFToken', csrf);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await parseBody(response);

  if (!response.ok) {
    throw new AuthError(extractDetail(payload) ?? `Request failed (${response.status})`, response.status);
  }
  return payload as T;
}

async function parseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export function getCurrentUser(): Promise<User | null> {
  return request<User>('/users/me/').catch((err: unknown) => {
    if (err instanceof AuthError && (err.status === 401 || err.status === 403)) return null;
    throw err;
  });
}

export function loginRequest(username: string, password: string): Promise<User> {
  return request<User>('/users/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function signupRequest(input: SignupInput): Promise<User> {
  return request<User>('/users/auth/signup/', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logoutRequest(): Promise<void> {
  return request<void>('/users/auth/logout/', { method: 'POST' }).catch((err: unknown) => {
    if (err instanceof AuthError && err.status === 401) return;
    throw err;
  });
}
