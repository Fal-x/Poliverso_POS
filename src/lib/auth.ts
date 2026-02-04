import type { User, UserRole } from '@/types/pos.types';

const AUTH_KEY = 'pos.authUser';
const CASH_OPEN_KEY = 'pos.cashOpen';
const CASH_STATE_KEY = 'pos.cashState';
const ACCESS_KEY = 'pos.accessToken';
const REFRESH_KEY = 'pos.refreshToken';
const SITE_KEY = 'pos.siteId';

export function setAuthUser(user: User) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function getAuthUser(): User | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as User;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAuthUser() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function isCashOpen(): boolean {
  return localStorage.getItem(CASH_OPEN_KEY) === 'true';
}

export function setCashOpen(open: boolean) {
  localStorage.setItem(CASH_OPEN_KEY, open ? 'true' : 'false');
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthUser() && getAccessToken());
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setSiteId(siteId: string) {
  localStorage.setItem(SITE_KEY, siteId);
}

export function getSiteIdStored() {
  return localStorage.getItem(SITE_KEY) || '';
}

export function getCashState(): { openingCashAmount: number; cashSales: number; cashSessionId?: string | null } | null {
  const raw = localStorage.getItem(CASH_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { openingCashAmount: number; cashSales: number; cashSessionId?: string | null };
  } catch {
    return null;
  }
}

export function setCashState(state: { openingCashAmount: number; cashSales: number; cashSessionId?: string | null }) {
  localStorage.setItem(CASH_STATE_KEY, JSON.stringify(state));
}

export function clearCashState() {
  localStorage.removeItem(CASH_STATE_KEY);
}

export function canAccessRoute(userRole: UserRole, routeRole: UserRole): boolean {
  const rank: Record<UserRole, number> = { cashier: 1, supervisor: 2, admin: 3 };
  return rank[userRole] >= rank[routeRole];
}
