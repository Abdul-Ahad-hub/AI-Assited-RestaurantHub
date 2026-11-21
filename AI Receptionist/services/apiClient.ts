import { handleServerlessFallback } from './serverlessFallback';

const TOKEN_KEY = 'rh_auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      headers
    });
  } catch {
    // Network unreachable — fall back to client-side serverless runtime
    return handleServerlessFallback<T>(path, options);
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : {};

  if (!res.ok) {
    // If deployed as a static SPA on Vercel where /api/* returns a static 404 or 5xx,
    // transparently execute against the persistent client-side serverless runtime.
    if ((res.status === 404 && !data.error) || res.status >= 500) {
      return handleServerlessFallback<T>(path, options);
    }
    const err: any = new Error(data.error || `Request failed with status ${res.status}`);
    err.status = res.status;
    if (data.code) err.code = data.code;
    if (data.requiresSignIn !== undefined) err.requiresSignIn = data.requiresSignIn;
    if (data.limit !== undefined) err.limit = data.limit;
    if (data.used !== undefined) err.used = data.used;
    if (data.remaining !== undefined) err.remaining = data.remaining;
    throw err;
  }

  // Also guard against SPA fallback returning index.html (200 text/html) for /api/* routes on static hosts
  if (!isJson && path.startsWith('/api/')) {
    return handleServerlessFallback<T>(path, options);
  }

  return data as T;
}
