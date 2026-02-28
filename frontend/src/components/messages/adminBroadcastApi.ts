// frontend/src/components/messages/adminBroadcastApi.ts
"use client";

import { apiGet, apiPost } from "@/lib/api";

type Role = "SUPER_ADMIN" | "ADMIN" | "LISTER" | "RENTER" | "AGENT" | "EDITOR";

type Audience = {
  roles?: Role[];
  userIds?: string[];
  onlySubscribed?: boolean;
};

export type BroadcastSendInput = {
  subject?: string;
  content: string;
  channels: { inApp?: boolean; email?: boolean };
  audience: Audience;
};

type AnyObj = Record<string, any>;
function isObj(v: unknown): v is AnyObj {
  return typeof v === "object" && v !== null;
}

/**
 * Unwrap ApiResult<T> from apiGet/apiPost/apiPatch
 */
function unwrap<T = any>(res: unknown): T {
  if (isObj(res) && "ok" in res && ("data" in res || "json" in res)) {
    const ok = Boolean(res.ok);
    if (!ok) {
      const payload = (res as AnyObj).data ?? (res as AnyObj).json;
      const msg =
        (isObj(payload) && ((payload as AnyObj).message || (payload as AnyObj).error)) ||
        (res as AnyObj).error ||
        "Request failed";
      throw new Error(String(msg));
    }
    return ((res as AnyObj).data ?? (res as AnyObj).json) as T;
  }
  return res as T;
}

/**
 * POST /api/admin/broadcasts/send
 * body: { subject?, content, channels, audience }
 */
export async function sendBroadcast(input: BroadcastSendInput) {
  const content = String(input?.content || "").trim();
  if (!content) throw new Error("Message body is required.");

  const res = await apiPost("/admin/broadcasts/send", {
    subject: input.subject?.trim() || undefined,
    content,
    channels: {
      inApp: !!input.channels?.inApp,
      email: !!input.channels?.email,
    },
    audience: {
      roles: input.audience?.roles?.length ? input.audience.roles : undefined,
      userIds: input.audience?.userIds?.length ? input.audience.userIds : undefined,
      onlySubscribed: !!input.audience?.onlySubscribed,
    },
  });

  return unwrap<{
    ok: boolean;
    channels: { inApp: boolean; email: boolean };
    inApp: { recipients: number };
    email: { sent: number };
    audienceCount: number;
  }>(res);
}

/**
 * GET /api/admin/broadcasts/history
 */
export async function listBroadcastHistory() {
  const res = await apiGet("/admin/broadcasts/history");
  return unwrap<{ items: any[] }>(res);
}

/**
 * GET /api/admin/users/search?q=...
 * Returns { items: [{id,email,name,role}] }
 */
export async function searchUsers(q: string) {
  const qs = new URLSearchParams({ q: String(q || "").trim() }).toString();
  const res = await apiGet(`/admin/users/search?${qs}`);
  return unwrap<{ items: { id: string; email: string; name?: string | null; role?: string }[] }>(res);
}