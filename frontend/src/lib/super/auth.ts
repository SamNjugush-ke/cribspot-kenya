// frontend/src/lib/super/auth.ts
export const TOKEN_KEY = "rk_token";

export type JwtPayload = {
  id?: string;
  sub?: string;
  email?: string;
  role?: string;
  impersonated?: boolean;
  impersonatorId?: string;
  impersonatedUserId?: string;
  iat?: number;
  exp?: number;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function base64UrlDecode(input: string) {
  // base64url -> base64
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const decoded = atob(padded);
  return decoded;
}

export function getJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const json = base64UrlDecode(parts[1]);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
