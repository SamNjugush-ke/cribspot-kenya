// frontend/src/lib/super/api.ts
import { getToken, getJwtPayload } from "./auth";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "") + "/api";

export type Permission = string;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }

  return (await res.json()) as T;
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
