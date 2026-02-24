// frontend/src/lib/apiClient.ts
import { API_BASE } from "@/lib/api";

export type ApiError = {
  status: number;
  message: string;
  details?: any;
};

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rk_token");
}

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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();

  // Ensure we always have a Headers object (and preserve any provided headers)
  const headers = new Headers(init.headers || {});

  // Default JSON only when a body exists, unless the caller already set Content-Type
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const url = normalizeApiUrl(API_BASE, path);

  const res = await fetch(url, { ...init, headers });

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const err: ApiError = {
      status: res.status,
      message: (body && ((body as any).message || (body as any).error)) || `Request failed (${res.status})`,
      details: body,
    };
    throw err;
  }

  return body as T;
}