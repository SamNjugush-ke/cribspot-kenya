// frontend/src/components/messages/api.ts
"use client";

import { API_BASE } from "@/lib/api";
import type { Thread, SendMessagePayload, Message } from "@/types/messages";

function token() {
  return typeof window !== "undefined" ? localStorage.getItem("rk_token") : null;
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const t = token();
  return {
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
    ...(extra || {}),
  };
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

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const url = normalizeApiUrl(API_BASE, path);

  const res = await fetch(url, {
    ...init,
    headers: authHeaders(init?.headers),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // If backend returned JSON, try to pull a message out
    try {
      const j = text ? JSON.parse(text) : null;
      throw new Error(j?.message || j?.error || text || `HTTP ${res.status}`);
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }
  }

  // Some endpoints may return empty bodies; keep it safe
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    //ts-expect-error - caller expects T, but backend may return text
    return (await res.text().catch(() => "")) as T;
  }

  return res.json() as Promise<T>;
}

export const MessagesAPI = {
  // ------------------
  // Conversations
  // ------------------
  listThreads(box?: "inbox" | "sent"): Promise<Thread[]> {
    const q = box ? `?box=${encodeURIComponent(box)}` : "";
    return http<Thread[]>(`/api/messages/threads${q}`);
  },

  getThread(id: string): Promise<Thread> {
    return http<Thread>(`/api/messages/threads/${id}`);
  },

  send(payload: SendMessagePayload & { threadId: string }): Promise<Message> {
    return http<Message>(`/api/messages/threads/${payload.threadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: payload.content }),
    });
  },

  markRead(id: string): Promise<{ ok: boolean; lastReadAt?: string }> {
    return http(`/api/messages/threads/${id}/read`, { method: "POST" });
  },

  unreadCount(): Promise<{ unread: number }> {
    return http(`/api/messages/unread-count`);
  },

  // ------------------
  // Broadcasts (In-app, Admin)
  // ------------------
  listBroadcasts(): Promise<any[]> {
    // backend task below adds this. If not present yet, return empty.
    return http<any[]>(`/api/messages/broadcasts`).catch(() => []);
  },

  createBroadcast(body: { subject?: string; content: string; role?: string }): Promise<any> {
    return http(`/api/messages/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  // ------------------
  // Leads (optional; backend task below)
  // ------------------
  listLeads(): Promise<any[]> {
    return http<any[]>(`/api/messages/leads`).catch(() => []);
  },

  // ------------------
  // Support Tickets
  // ------------------
  listTickets(status?: "OPEN" | "CLOSED"): Promise<any[]> {
    const q = status ? `?status=${status}` : "";
    return http<any[]>(`/api/support/tickets${q}`);
  },

  getTicket(id: string): Promise<any> {
    return http(`/api/support/tickets/${id}`);
  },

  createSupportTicket(payload: {
    subject: string;
    category?: string;
    content: string;
    file?: File;
  }): Promise<any> {
    const t = token();

    const formData = new FormData();
    formData.append("subject", payload.subject);
    if (payload.category) formData.append("category", payload.category);
    formData.append("message", payload.content); // ✅ backend expects {message}
    if (payload.file) formData.append("file", payload.file);

    const url = normalizeApiUrl(API_BASE, `/api/support/tickets`);

    return fetch(url, {
      method: "POST",
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: formData,
      cache: "no-store",
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        try {
          const j = text ? JSON.parse(text) : null;
          throw new Error(j?.message || j?.error || text || `HTTP ${res.status}`);
        } catch {
          throw new Error(text || `HTTP ${res.status}`);
        }
      }
      return res.json();
    });
  },

  sendTicketMessage(ticketId: string, content: string): Promise<any> {
    return http(`/api/support/tickets/${ticketId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  },

  setTicketStatus(id: string, status: "OPEN" | "CLOSED", reason?: string): Promise<any> {
    return http(`/api/support/tickets/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason }),
    });
  },
};