import { clearAuthUser, clearCashState, getAuthUser, setCashOpen } from '@/lib/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('pos.accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const demoToken = import.meta.env.VITE_DEMO_TOKEN;
  if (demoToken) headers['x-demo-token'] = demoToken;

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

export function getSiteId() {
  const user = getAuthUser();
  return (user as any)?.siteId || localStorage.getItem('pos.siteId') || '';
}
