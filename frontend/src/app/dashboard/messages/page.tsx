"use client";

import { useEffect, useMemo, useState } from "react";
import ThreadList from "@/components/messages/ThreadList";
import ThreadView from "@/components/messages/ThreadView";
import EmptyState from "@/components/messages/EmptyState";
import SupportTicketForm from "@/components/messages/SupportTicketForm";
import TicketList from "@/components/messages/TicketList";
import type { Thread } from "@/types/messages";
import { MessagesAPI } from "@/components/messages/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Role = "SUPER_ADMIN" | "ADMIN" | "LISTER" | "RENTER" | "AGENT" | "EDITOR";

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function getMeFromToken(): { id?: string; role?: Role } {
  const t = typeof window !== "undefined" ? localStorage.getItem("rk_token") : null;
  if (!t) return {};
  const p = decodeJwtPayload(t);
  return { id: p?.id || p?.userId || p?.sub, role: (String(p?.role || "") as Role) || undefined };
}

type Tab = "INBOX" | "SUPPORT" | "BROADCASTS" | "LEADS";

export default function MessagesHubPage() {
  const me = useMemo(() => getMeFromToken(), []);
  const isAdmin = me.role === "ADMIN" || me.role === "SUPER_ADMIN";

  const [tab, setTab] = useState<Tab>("INBOX");

  // inbox
  const [active, setActive] = useState<Thread | null>(null);

  // support
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  useEffect(() => {
    // default: admins often want support triage first
    if (isAdmin) setTab("SUPPORT");
  }, [isAdmin]);

  return (
    <div className="space-y-4">
      {/* Top Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          className={cn(
            "px-3 py-2 rounded-lg border text-sm",
            tab === "INBOX" ? "bg-brand-gray" : "bg-white hover:bg-gray-50"
          )}
          onClick={() => setTab("INBOX")}
        >
          Inbox
        </button>

        <button
          className={cn(
            "px-3 py-2 rounded-lg border text-sm",
            tab === "SUPPORT" ? "bg-brand-gray" : "bg-white hover:bg-gray-50"
          )}
          onClick={() => setTab("SUPPORT")}
        >
          Support Tickets
        </button>

        {isAdmin && (
          <>
            <button
              className={cn(
                "px-3 py-2 rounded-lg border text-sm",
                tab === "BROADCASTS" ? "bg-brand-gray" : "bg-white hover:bg-gray-50"
              )}
              onClick={() => setTab("BROADCASTS")}
            >
              Broadcasts
            </button>

            <button
              className={cn(
                "px-3 py-2 rounded-lg border text-sm",
                tab === "LEADS" ? "bg-brand-gray" : "bg-white hover:bg-gray-50"
              )}
              onClick={() => setTab("LEADS")}
            >
              Leads
            </button>
          </>
        )}
      </div>

      {/* INBOX */}
      {tab === "INBOX" && (
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
          <aside className="col-span-12 md:col-span-4 lg:col-span-3 border rounded-xl bg-white overflow-hidden">
            <div className="h-12 border-b flex items-center px-3 font-semibold">Conversations</div>
            <div className="h-[calc(100%-48px)] overflow-y-auto">
              <ThreadList
                activeId={active?.id || null}
                onPick={async (t) => {
                  // ensure we load full thread (latest messages)
                  try {
                    const full = await MessagesAPI.getThread(t.id);
                    setActive(full as any);
                  } catch {
                    setActive(t);
                  }
                }}
              />
            </div>
          </aside>

          <section className="col-span-12 md:col-span-8 lg:col-span-9 border rounded-xl bg-white overflow-hidden">
            {!active ? (
              <EmptyState title="Pick a conversation" description="Choose a thread from the left to start chatting." />
            ) : (
              <ThreadView
                thread={active}
                meId={me.id}
                onMessageSent={() => {
                  // optional: could refresh list later (Phase 5 polish)
                }}
              />
            )}
          </section>
        </div>
      )}

      {/* SUPPORT */}
      {tab === "SUPPORT" && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-5 space-y-4">
            {/* ticket form (everyone can create) */}
            <SupportTicketForm
              onCreated={(id) => {
                setActiveTicketId(id);
              }}
            />

            <div className="border rounded-xl bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Tickets</h3>
                <Button size="sm" variant="outline" onClick={() => setActiveTicketId(null)}>
                  Clear selection
                </Button>
              </div>
              <div className="mt-3">
                <TicketList onPick={(id) => setActiveTicketId(id)} />
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 border rounded-xl bg-white overflow-hidden">
            {!activeTicketId ? (
              <EmptyState
                title={isAdmin ? "Pick a ticket to respond" : "Your support ticket thread"}
                description="Select a ticket from the list to view and reply."
              />
            ) : (
              <SupportTicketThread ticketId={activeTicketId} isAdmin={isAdmin} />
            )}
          </div>
        </div>
      )}

      {/* Broadcasts + Leads: we keep them as separate pages for now */}
      {tab === "BROADCASTS" && isAdmin && <BroadcastsPanel />}
      {tab === "LEADS" && isAdmin && <LeadsPanel />}
    </div>
  );
}

/** Simple ticket thread viewer inside the hub (no new component file needed) */
function SupportTicketThread({ ticketId, isAdmin }: { ticketId: string; isAdmin: boolean }) {
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const t = await MessagesAPI.getTicket(ticketId);
        setTicket(t);
      } finally {
        setLoading(false);
      }
    })();
  }, [ticketId]);

  const send = async () => {
    if (!reply.trim()) return;
    try {
      setBusy(true);
      await MessagesAPI.sendTicketMessage(ticketId, reply.trim());
      const t = await MessagesAPI.getTicket(ticketId);
      setTicket(t);
      setReply("");
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    const ok = confirm("Close this ticket?");
    if (!ok) return;
    await MessagesAPI.setTicketStatus(ticketId, "CLOSED");
    const t = await MessagesAPI.getTicket(ticketId);
    setTicket(t);
  };

  const reopen = async () => {
    await MessagesAPI.setTicketStatus(ticketId, "OPEN");
    const t = await MessagesAPI.getTicket(ticketId);
    setTicket(t);
  };

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading ticket…</div>;
  if (!ticket) return <div className="p-4 text-sm text-gray-500">Ticket not found.</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <div className="h-14 border-b px-4 flex items-center justify-between">
        <div>
          <div className="font-semibold">{ticket.subject || "Support Ticket"}</div>
          <div className="text-xs text-gray-500">
            #{ticket.ticketNumber} · {ticket.category || "General"} · {ticket.status || "OPEN"}
          </div>
        </div>

        <div className="flex gap-2">
          {ticket.status === "CLOSED" ? (
            <Button size="sm" variant="outline" onClick={reopen}>
              Reopen
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={close}>
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
        {(ticket.messages || []).map((m: any) => (
          <div key={m.id} className="bg-white rounded-xl p-3 shadow-sm">
            <div className="text-xs text-gray-500 flex items-center justify-between">
              <span>{m.sender?.name || m.sender?.role || "User"}</span>
              <span>{m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</span>
            </div>
            <div className="text-sm mt-1">{m.content}</div>
          </div>
        ))}
        {!ticket.messages?.length && <div className="text-sm text-gray-500">No messages yet.</div>}
      </div>

      <div className="border-t bg-white p-3 flex gap-2">
        <input
          className="flex-1 h-11 border rounded-md px-3 text-sm"
          placeholder="Type reply…"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          disabled={ticket.status === "CLOSED"}
        />
        <Button className="h-11 bg-brand-blue text-white" onClick={send} disabled={busy || ticket.status === "CLOSED"}>
          Send
        </Button>
      </div>

      {!isAdmin && (
        <div className="px-4 py-2 text-xs text-gray-500 border-t">
          Note: admins can see all tickets; you can only see yours.
        </div>
      )}
    </div>
  );
}

function BroadcastsPanel() {
  // reuse your existing /dashboard/messages/broadcasts page logic, but inline for simplicity
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [role, setRole] = useState<string>("ALL");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    MessagesAPI.listBroadcasts().then(setRecent).catch(() => setRecent([]));
  }, []);

  const send = async () => {
    if (!content.trim()) return;
    try {
      setBusy(true);
      const res = await MessagesAPI.createBroadcast({
        subject: subject.trim() || undefined,
        content: content.trim(),
        role: role === "ALL" ? undefined : role,
      });
      setMsg(`Broadcast sent to ${res.recipients ?? "N"} users.`);
      setContent("");
      setSubject("");
      const list = await MessagesAPI.listBroadcasts();
      setRecent(list);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 lg:col-span-7 border rounded-xl bg-white p-4">
        <h2 className="font-semibold mb-2">Compose broadcast</h2>
        <div className="grid gap-3">
          <input
            className="h-11 border rounded-md px-3 text-sm"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (optional)"
          />
          <select className="h-11 border rounded-md px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="ALL">All users</option>
            {["SUPER_ADMIN", "ADMIN", "LISTER", "RENTER", "AGENT", "EDITOR"].map((r) => (
              <option key={r} value={r}>
                Role: {r}
              </option>
            ))}
          </select>
          <textarea
            className="border rounded-md px-3 py-2 text-sm"
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Message…"
          />
          <Button disabled={busy} onClick={send} className="bg-brand-blue text-white">
            Send broadcast
          </Button>
          {msg && <div className="text-sm">{msg}</div>}
        </div>
      </div>

      <div className="col-span-12 lg:col-span-5 border rounded-xl bg-white p-4">
        <h2 className="font-semibold mb-2">Recent broadcasts</h2>
        {!recent.length ? (
          <p className="text-sm text-gray-500">No broadcast history yet (endpoint required).</p>
        ) : (
          <ul className="divide-y">
            {recent.map((b: any) => (
              <li key={b.id} className="py-3">
                <div className="text-sm font-medium">{b.subject || "Announcement"}</div>
                <div className="text-xs text-gray-500">
                  {b.createdAt ? new Date(b.createdAt).toLocaleString() : ""} · by {b.actorEmail || b.actorId || "—"}
                </div>
                <div className="text-xs text-gray-600 line-clamp-2 mt-1">{b.preview || ""}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LeadsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await MessagesAPI.listLeads();
        setRows(data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="border rounded-xl bg-white p-4">
      <h2 className="font-semibold mb-3">Leads</h2>
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : rows.length ? (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Property</th>
                <th className="py-2 pr-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l: any) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{l.name || "—"}</td>
                  <td className="py-2 pr-3">{l.email || "—"}</td>
                  <td className="py-2 pr-3">{l.phone || "—"}</td>
                  <td className="py-2 pr-3">{l.propertyId || "—"}</td>
                  <td className="py-2 pr-3">{l.createdAt ? new Date(l.createdAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-gray-500">No leads yet (endpoint/model needed).</div>
      )}
    </div>
  );
}
