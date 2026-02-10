// frontend/src/lib/adminFetch.ts
import { API_BASE } from "@/lib/api";

type Json = Record<string, any>;

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("rk_token") : null;
}

export async function adminFetch<T = any>(
  path: string,
  opts: RequestInit & { json?: Json } = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const hasBody = typeof opts.json !== "undefined";
  if (hasBody) (headers as any)["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
    body: hasBody ? JSON.stringify(opts.json) : opts.body,
  });

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const msg = data?.error || data?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
