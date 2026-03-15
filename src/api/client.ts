import { clearAuthUser, clearCashState, getAuthUser, setCashOpen } from '@/lib/auth';
import { resolveApiBaseUrl } from '@/api/baseUrl';

const API_URL = resolveApiBaseUrl();

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('pos.accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearAuthUser();
    setCashOpen(false);
    clearCashState();
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
    throw new Error('Sesión expirada');
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Error API');
  }
  return json.data as T;
}

export async function apiFile(path: string, options: RequestInit = {}): Promise<{ blob: Blob; filename: string | null }> {
  const token = localStorage.getItem('pos.accessToken');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearAuthUser();
    setCashOpen(false);
    clearCashState();
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
    throw new Error('Sesión expirada');
  }

  if (!res.ok) {
    try {
      const json = await res.json();
      throw new Error(json?.error?.message || 'Error API');
    } catch {
      throw new Error('No se pudo descargar el archivo');
    }
  }

  const contentDisposition = res.headers.get('content-disposition');
  const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/i);
  const filename = filenameMatch?.[1] ?? null;
  const blob = await res.blob();
  return { blob, filename };
}

export function getSiteId() {
  const user = getAuthUser();
  return (user as any)?.siteId || localStorage.getItem('pos.siteId') || '';
}
