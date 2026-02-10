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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);

  // Default JSON unless caller sets something else
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const err: ApiError = {
      status: res.status,
      message: (body && (body.message || body.error)) || `Request failed (${res.status})`,
      details: body,
    };
    throw err;
  }

  return body as T;
}