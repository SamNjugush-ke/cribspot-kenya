// frontend/src/components/messages/api.ts
"use client";

import api, { apiGet, apiPost, apiPatch } from "@/lib/api";
import type { NotificationItem, SupportTicket, Thread } from "@/types/messages";

type AnyObj = Record<string, any>;
function isObj(v: unknown): v is AnyObj {
  return typeof v === "object" && v !== null;
}

/**
 * apiGet/apiPost/apiPatch return ApiResult<T> in this project:
 * { ok, status, data, json, error }
 * We must unwrap to get the actual payload.
 */
function unwrap<T = any>(res: unknown): T {
  if (isObj(res) && "ok" in res && ("data" in res || "json" in res)) {
    const ok = Boolean((res as AnyObj).ok);
    const err = (res as AnyObj).error as string | undefined;
    const status = (res as AnyObj).status as number | undefined;

    if (!ok) {
      const payload = (res as AnyObj).data ?? (res as AnyObj).json;
      const msg =
        (isObj(payload) && ((payload as AnyObj).message || (payload as AnyObj).error)) ||
        err ||
        `Request failed (${status ?? "?"})`;
      throw new Error(String(msg));
    }

    return ((res as AnyObj).data ?? (res as AnyObj).json) as T;
  }

  // If already raw json, return as-is
  return res as T;
}

function pickArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (!isObj(payload)) return [];
  const maybe =
    (payload as AnyObj).items ??
    (payload as AnyObj).data ??
    (payload as AnyObj).tickets ??
    (payload as AnyObj).threads ??
    (payload as AnyObj).notifications ??
    (payload as AnyObj).messages ??
    (payload as AnyObj).result;
  return Array.isArray(maybe) ? maybe : [];
}

function pickNumber(payload: any, keys: string[]): number {
  if (!isObj(payload)) return 0;
  for (const k of keys) {
    const v = (payload as AnyObj)[k];
    if (typeof v === "number") return v;
  }
  return 0;
}

/* --------------------------------
   DIRECT MESSAGING (Inbox)
--------------------------------- */

export const MessagesAPI = {
  async listThreads(type: "DIRECT" | "BROADCAST" = "DIRECT") {
    const res = await apiGet(`/messages/threads?type=${encodeURIComponent(type)}`);
    const data = unwrap<any>(res);
    return pickArray(data) as Thread[];
  },

  async getThread(id: string) {
    const res = await apiGet(`/messages/threads/${id}`);
    return unwrap<Thread>(res);
  },

  async send(input: { threadId: string; content: string }) {
    const res = await apiPost(`/messages/threads/${input.threadId}/messages`, {
      content: input.content,
    });
    return unwrap<any>(res);
  },

  async markRead(threadId: string) {
    const res = await apiPost(`/messages/threads/${threadId}/read`, {});
    return unwrap<any>(res);
  },

  async unreadCount(type: "DIRECT" | "BROADCAST" = "DIRECT") {
    const res = await apiGet(`/messages/unread-count?type=${encodeURIComponent(type)}`);
    const data = unwrap<any>(res);
    return pickNumber(data, ["unread", "count"]);
  },

  async validateRecipient(email: string) {
    const qs = new URLSearchParams({ email: email.trim().toLowerCase() });
    const res = await apiGet(`/messages/validate-recipient?${qs.toString()}`);
    const data = unwrap<any>(res);

    const user = data?.user;
    if (user && typeof user.id === "string") {
      return {
        ok: true as const,
        user: user as { id: string; email: string; name?: string; role?: string },
      };
    }

    return { ok: Boolean(data?.ok), user: undefined };
  },

  async startDirectByEmail(input: { email: string; subject?: string }) {
    const email = input.email.trim().toLowerCase();
    if (!email) throw new Error("Recipient email is required");

    const res = await apiPost(`/messages/start-direct`, { email, subject: input.subject });
    const thread = unwrap<any>(res); // backend returns the conversation object

    if (!thread?.id) throw new Error("Failed to start conversation");
    return { thread: thread as Thread };
  },
};

/* --------------------------------
   SUPPORT TICKETS
--------------------------------- */

export const SupportAPI = {
  async listTickets(params?: { status?: "OPEN" | "CLOSED"; q?: string }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.q) qs.set("q", params.q);

    const res = await apiGet(`/support/tickets?${qs.toString()}`);
    const data = unwrap<any>(res);
    return pickArray(data) as SupportTicket[];
  },

  async getTicket(id: string) {
    const res = await apiGet(`/support/tickets/${id}`);
    return unwrap<SupportTicket>(res);
  },

  /**
   * Create ticket (multipart)
   * Send BOTH message+content and BOTH files+file to match backend variants safely.
   */
  async createTicket(input: { subject: string; category?: string; message: string; files?: File[] }) {
    const fd = new FormData();
    fd.set("subject", input.subject);
    fd.set("category", input.category || "General");

    // Compatibility: some backends expect "message", some expect "content"
    fd.set("message", input.message);
    fd.set("content", input.message);

    const files = (input.files || []).slice(0, 2);
    for (const f of files) {
      // Compatibility: some backends use "files", others "file"
      fd.append("files", f);
      fd.append("file", f);
    }

    const res = await apiPost(`/support/tickets`, fd);
    return unwrap<SupportTicket>(res);
  },

  async replyToTicket(id: string, input: { content: string; files?: File[] }) {
    const fd = new FormData();
    fd.set("content", input.content);

    const files = (input.files || []).slice(0, 2);
    for (const f of files) {
      fd.append("files", f);
      fd.append("file", f);
    }

    const res = await apiPost(`/support/tickets/${id}/messages`, fd);
    return unwrap<any>(res);
  },

  async setTicketStatus(id: string, status: "OPEN" | "CLOSED") {
    const res = await apiPatch(`/support/tickets/${id}/status`, { status });
    return unwrap<any>(res);
  },
};

/* --------------------------------
   IN-APP NOTIFICATIONS (Bell)
--------------------------------- */

export const NotificationsAPI = {
  async listMine(params?: { includeRead?: boolean }) {
    const qs = new URLSearchParams();
    qs.set("includeRead", String(params?.includeRead ?? true));

    const res = await apiGet(`/notifications/mine?${qs.toString()}`);
    const data = unwrap<any>(res);
    return (pickArray(data) as NotificationItem[]) || [];
  },

  async unreadCount() {
    const res = await apiGet(`/notifications/unread-count`);
    const data = unwrap<any>(res);
    return pickNumber(data, ["count", "unread"]);
  },

  async markRead(id: string) {
    const res = await apiPost(`/notifications/${id}/read`, {});
    return unwrap<any>(res);
  },
};