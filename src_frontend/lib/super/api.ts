// frontend/src/lib/super/api.ts
import { API_BASE } from "@/lib/api";
import { getToken, getJwtPayload } from "./auth";

export type Permission = string;

/**
 * Safely joins a base URL and a path without double slashes.
 */
function joinUrl(base: string, path: string) {
  const b = (base || "").replace(/\/+$/, "");
  const p = (path || "").startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

/**
 * Normalizes accidental `/api/api` duplication.
 * This happens when API_BASE already ends with `/api` and callers pass paths starting with `/api/...`.
 */
function normalizeApiUrl(base: string, path: string) {
  let url = joinUrl(base, path);

  // Replace /api/api and keep trailing slash or query string intact
  url = url.replace(/\/api\/api(\/|\?)/g, "/api$1");
  // Also handle an exact ending /api/api (no trailing slash)
  url = url.replace(/\/api\/api$/g, "/api");

  return url;
}

/**
 * Super-admin UI fetch helper.
 * API_BASE already includes `/api` (standardized in @/lib/api)
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();

  const headers = new Headers(init.headers || {});
  // Keep any existing content-type if caller set it (but default to JSON)
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const url = normalizeApiUrl(API_BASE, path);

  const res = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error((json as any)?.message || "Request failed");
  }

  return json as T;
}

export async function fetchMyEffectivePermissions(): Promise<Permission[]> {
  const token = getToken();
  if (!token) return [];

  const payload = getJwtPayload(token);
  const userId = payload?.id || payload?.sub;
  const role = payload?.role;

  // SUPER_ADMIN bypass (server-side) — in UI we treat as “all access”
  if (role === "SUPER_ADMIN") return ["*"];

  // We rely on your existing endpoint (admin-only). If the current user doesn't
  // have MANAGE_USERS, this will 403 — that's OK; we fall back to role-only gating.
  if (!userId) return [];

  try {
    const data = await apiFetch<{ permissions: Permission[] }>(`/admin/rbac/effective/${userId}`);
    return data.permissions || [];
  } catch {
    return [];
  }
}