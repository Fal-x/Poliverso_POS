const DEFAULT_API_PORT = '3001';
const API_PREFIX = '/api/v1';

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function getBrowserDefaultApiUrl(): string {
  return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_API_PORT}${API_PREFIX}`;
}

export function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (!configured) return getBrowserDefaultApiUrl();

  try {
    const parsed = new URL(configured, window.location.origin);
    const browserHost = window.location.hostname;

    if (isLoopbackHost(parsed.hostname) && !isLoopbackHost(browserHost)) {
      return getBrowserDefaultApiUrl();
    }
  } catch {
    return configured;
  }

  return configured;
}
