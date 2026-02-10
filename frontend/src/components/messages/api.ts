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

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: authHeaders(init?.headers),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
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

  createSupportTicket(payload: { subject: string; category?: string; content: string; file?: File }): Promise<any> {
    const t = token();
    const formData = new FormData();
    formData.append("subject", payload.subject);
    if (payload.category) formData.append("category", payload.category);
    formData.append("message", payload.content); // ✅ backend expects {message}
    if (payload.file) formData.append("file", payload.file);

    return fetch(`${API_BASE}/api/support/tickets`, {
      method: "POST",
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: formData,
    }).then(async (res) => {
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
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
