// frontend/src/lib/api.ts
"use client";

/**
 * Base host (no trailing slash), then enforce a single "/api" suffix.
 * This makes calls resilient whether callers use "/properties" OR "/api/properties".
 */
export const RAW_API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000"
).replace(/\/+$/, ""); // trim trailing slash(es)

// Always end with exactly ".../api"
export const API_BASE = RAW_API_BASE.replace(/\/api\/?$/, "") + "/api";

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  json: T | null;
  // back-compat alias (old code reads res.data)
  data: T | null;
  error?: string; // optional friendly error
};

function isFormData(body: any): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function safeJoin(base: string, path: string) {
  const b = (base || "").replace(/\/+$/, "");
  const p = (path || "").startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

/**
 * Normalize accidental:
 *  - "/api/api" duplication
 *  - "/api/api/..." anywhere
 *  - "/api/api?..." cases
 */
function normalizeUrl(base: string, path: string) {
  let url = safeJoin(base, path);

  // collapse repeated /api segments
  url = url.replace(/\/api\/api(\/|\?)/g, "/api$1");
  url = url.replace(/\/api\/api$/g, "/api");

  return url;
}

function withAuthHeaders(init: RequestInit = {}): RequestInit {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("rk_token") : null;

  // start with existing headers (never clobber what caller set)
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  // Only set JSON content-type if body is not FormData and caller didn’t set it
  if (!headers["Content-Type"] && !isFormData((init as any).body)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) headers.Authorization = `Bearer ${token}`;
  return { ...init, headers };
}

export async function apiFetch<T = any>(
  path: string,
  init: RequestInit & { params?: Record<string, string | number> } = {}
): Promise<ApiResult<T>> {
  try {
    let url = normalizeUrl(API_BASE, path);

    // ✅ Add query params support (like Axios)
    if (init.params) {
      const qs = new URLSearchParams(
        Object.entries(init.params).map(([k, v]) => [k, String(v)])
      ).toString();
      url += (url.includes("?") ? "&" : "?") + qs;
      delete (init as any).params;
    }

    const res = await fetch(url, withAuthHeaders(init));

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // non-JSON response is OK
    }

    return {
      ok: res.ok,
      status: res.status,
      json: (json as T) ?? null,
      data: (json as T) ?? null,
      error: res.ok
        ? undefined
        : json?.message || `Request failed (${res.status})`,
    };
  } catch (e: any) {
    // Network/CORS/DNS/connection refused etc.
    const msg = e?.message || "Failed to fetch";
    console.error("[apiFetch] Network error:", msg, {
      RAW_API_BASE,
      API_BASE,
      path,
    });

    return {
      ok: false,
      status: 0,
      json: null,
      data: null,
      error: msg,
    };
  }
}

// Helpers
export const apiGet = <T = any>(
  path: string,
  init?: RequestInit & { params?: Record<string, string | number> }
) => apiFetch<T>(path, { ...init, method: "GET" });

export const apiPost = <T = any>(
  path: string,
  body?: any,
  init?: RequestInit
) =>
  apiFetch<T>(path, {
    ...init,
    method: "POST",
    body: isFormData(body)
      ? body
      : body !== undefined
      ? JSON.stringify(body)
      : undefined,
  });

export const apiPut = <T = any>(
  path: string,
  body?: any,
  init?: RequestInit
) =>
  apiFetch<T>(path, {
    ...init,
    method: "PUT",
    body: isFormData(body)
      ? body
      : body !== undefined
      ? JSON.stringify(body)
      : undefined,
  });

export const apiPatch = <T = any>(
  path: string,
  body?: any,
  init?: RequestInit
) =>
  apiFetch<T>(path, {
    ...init,
    method: "PATCH",
    body: isFormData(body)
      ? body
      : body !== undefined
      ? JSON.stringify(body)
      : undefined,
  });

export const apiDelete = <T = any>(
  path: string,
  body?: any,
  init?: RequestInit
) =>
  apiFetch<T>(path, {
    ...init,
    method: "DELETE",
    body: isFormData(body)
      ? body
      : body !== undefined
      ? JSON.stringify(body)
      : undefined,
  });

// Default export to keep legacy imports working
const api = {
  fetch: apiFetch,
  get: apiGet,
  post: apiPost,
  put: apiPut,
  patch: apiPatch,
  delete: apiDelete,
};

export default api;
