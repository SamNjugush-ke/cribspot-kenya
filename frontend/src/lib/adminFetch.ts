// frontend/src/lib/adminFetch.ts
import { API_BASE } from "@/lib/api";

type Json = Record<string, any>;

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("rk_token") : null;
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
 * This happens when API_BASE already ends with `/api`
 * and callers pass paths starting with `/api/...`.
 */
function normalizeApiUrl(base: string, path: string) {
  let url = joinUrl(base, path);

  // Replace /api/api and keep trailing slash or query string intact
  url = url.replace(/\/api\/api(\/|\?)/g, "/api$1");
  // Also handle exact ending /api/api
  url = url.replace(/\/api\/api$/g, "/api");

  return url;
}

export async function adminFetch<T = any>(
  path: string,
  opts: RequestInit & { json?: Json } = {}
): Promise<T> {
  const token = getToken();

  const headers = new Headers(opts.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const hasBody = typeof opts.json !== "undefined";
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = normalizeApiUrl(API_BASE, path);

  const res = await fetch(url, {
    ...opts,
    headers,
    body: hasBody ? JSON.stringify(opts.json) : opts.body,
  });

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const msg =
      (data && ((data as any).error || (data as any).message)) ||
      `Request failed (${res.status})`;
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