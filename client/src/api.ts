import type { AppJSON } from './types';

const BASE = '/api';

async function apiFetch<T>(path: string, options: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = options;
  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    credentials: 'include', // always send session cookie
    headers: {
      'Content-Type': 'application/json',
      ...rest.headers,
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try { message = (JSON.parse(text) as { error?: string }).error || text; } catch { /* raw text */ }
    throw new Error(message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  me: () =>
    apiFetch<{ authenticated: boolean; username?: string }>('/me'),

  login: (username: string, password: string) =>
    apiFetch<{ success: boolean; username: string }>('/login', {
      method: 'POST',
      json: { username, password },
    }),

  logout: () =>
    apiFetch<{ success: boolean }>('/logout', { method: 'POST' }),

  generateApp: (appKind: string, prompt?: string) =>
    apiFetch<AppJSON>('/generate-app', {
      method: 'POST',
      json: { appKind, prompt },
    }),

  appEvent: (payload: {
    appKind: string;
    stateSummary: string;
    event: string;
    currentHtml?: string;
    currentCss?: string;
  }) =>
    apiFetch<AppJSON>('/app-event', {
      method: 'POST',
      json: payload,
    }),
};
