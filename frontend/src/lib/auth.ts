// src/lib/auth.ts
import { apiGet } from '@/lib/api';

/** Read the JWT (if any) */
export function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('rk_token') : null;
}

/** Logout helper */
export function logout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('rk_token');
  localStorage.removeItem('rk_user');
  window.location.href = '/login';
}

/** Pull role no matter how /me is shaped */
export function extractRole(me: any): string | null {
  const role =
    me?.role ??
    me?.user?.role ??
    me?.data?.role ??
    me?.data?.user?.role ??
    null;
  return typeof role === 'string' ? role.toUpperCase() : null;
}

/** Return the inner user object (normalized), or null if unauthenticated */
export async function requireMe(): Promise<any | null> {
  const res = await apiGet('/api/auth/me');
  if (!res.ok) return null;
  const me = (res.json as any) ?? null;
  return me?.user ?? me;
}

/** ✅ Back-compat alias expected by your layout/topbar/guards */
export const fetchCurrentUser = requireMe;

/** Role check utility (accepts string | string[]) */
export function hasRole(me: any, roles: string | string[]): boolean {
  const target = Array.isArray(roles) ? roles.map(r => r.toUpperCase()) : [String(roles).toUpperCase()];
  const role = extractRole(me);
  return !!role && target.includes(role);
}