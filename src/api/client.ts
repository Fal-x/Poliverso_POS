import { clearAuthUser, clearCashState, getAuthUser, setCashOpen } from '@/lib/auth';
import { resolveApiBaseUrl } from '@/api/baseUrl';

const API_URL = resolveApiBaseUrl();

type ApiErrorPayload = {
  success?: false;
  error?: {
    code?: string;
    message?: string;
  };
  meta?: {
    requestId?: string;
  };
};

class ApiError extends Error {
  status?: number;
  path: string;
  method: string;
  code?: string;
  requestId?: string;

  constructor(params: {
    path: string;
    method: string;
    status?: number;
    code?: string;
    message: string;
    requestId?: string;
  }) {
    const scope = `${params.method} ${params.path}`;
    const statusPart = params.status ? ` [${params.status}]` : '';
    const codePart = params.code ? ` ${params.code}` : '';
    const requestPart = params.requestId ? ` (req ${params.requestId})` : '';
    super(`${scope}${statusPart}${codePart}: ${params.message}${requestPart}`);
    this.name = 'ApiError';
    this.status = params.status;
    this.path = params.path;
    this.method = params.method;
    this.code = params.code;
    this.requestId = params.requestId;
  }
}

function describeMethod(options?: RequestInit) {
  return (options?.method || 'GET').toUpperCase();
}

async function parseErrorPayload(res: Response): Promise<ApiErrorPayload | null> {
  try {
    return (await res.json()) as ApiErrorPayload;
  } catch {
    return null;
  }
}

async function buildApiError(path: string, options: RequestInit, res?: Response, fallbackMessage?: string) {
  const method = describeMethod(options);
  if (!res) {
    return new ApiError({
      path,
      method,
      message: fallbackMessage || 'Fallo de red o no se pudo contactar el backend',
    });
  }

  const payload = await parseErrorPayload(res);
  return new ApiError({
    path,
    method,
    status: res.status,
    code: payload?.error?.code,
    requestId: payload?.meta?.requestId,
    message:
      payload?.error?.message ||
      fallbackMessage ||
      `Falló la llamada al backend con estado HTTP ${res.status}`,
  });
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('pos.accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fallo de red desconocido';
    throw await buildApiError(path, options, undefined, message);
  }

  if (res.status === 401) {
    clearAuthUser();
    setCashOpen(false);
    clearCashState();
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
    throw new ApiError({
      path,
      method: describeMethod(options),
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Sesión expirada o token inválido',
    });
  }

  const json = await res.json();
  if (!json.success) {
    throw new ApiError({
      path,
      method: describeMethod(options),
      status: res.status,
      code: json.error?.code,
      requestId: json.meta?.requestId,
      message: json.error?.message || 'Error API',
    });
  }
  return json.data as T;
}

export async function apiFile(path: string, options: RequestInit = {}): Promise<{ blob: Blob; filename: string | null }> {
  const token = localStorage.getItem('pos.accessToken');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fallo de red desconocido';
    throw await buildApiError(path, options, undefined, message);
  }

  if (res.status === 401) {
    clearAuthUser();
    setCashOpen(false);
    clearCashState();
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
    throw new ApiError({
      path,
      method: describeMethod(options),
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Sesión expirada o token inválido',
    });
  }

  if (!res.ok) {
    throw await buildApiError(path, options, res, 'No se pudo descargar el archivo');
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
