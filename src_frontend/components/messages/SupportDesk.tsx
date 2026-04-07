"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { SupportAPI } from "./api";

import type { SupportTicket, SupportMessage, SupportAttachment, UserLite } from "@/types/messages";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type AnyObj = Record<string, any>;
function isObj(v: unknown): v is AnyObj {
  return typeof v === "object" && v !== null;
}
function unwrap(res: unknown): any {
  if (isObj(res) && "ok" in res && ("data" in res || "json" in res)) {
    if (!(res as AnyObj).ok) return null;
    return (res as AnyObj).data ?? (res as AnyObj).json;
  }
  return res;
}

const MAX_FILES = 2;
const MAX_MB = 5;

function fmtDate(s?: string) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function isUnder5MB(file: File) {
  return file.size <= MAX_MB * 1024 * 1024;
}

function labelForSender(meId: string | null, m: SupportMessage) {
  if (meId && m.senderId === meId) return "You";
  const name = m.sender?.name?.trim();
  const role = m.sender?.role?.replace("_", " ");
  if (name && role) return `${name} | ${role}`;
  if (name) return name;
  // fallback when sender isn’t populated
  return "Support";
}

function renderAttachment(a: SupportAttachment) {
  const url = a.url;
  const name = a.name || "Attachment";
  const mime = a.mime || "";

  const isImage = mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(name);

  if (isImage) {
    return (
      <a
        key={a.id}
        href={url}
        target="_blank"
        className="block rounded-xl border overflow-hidden hover:opacity-95"
        title="Open image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} className="w-full max-h-[280px] object-contain bg-gray-50" />
        <div className="p-2 text-xs text-gray-600 flex items-center justify-between gap-2">
          <span className="truncate">{name}</span>
          <span className="text-brand-blue underline">Open</span>
        </div>
      </a>
    );
  }

  return (
    <a
      key={a.id}
      href={url}
      target="_blank"
      className="block rounded-xl border p-2 text-sm hover:bg-gray-50"
      title="Open/download"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">{name}</span>
        <span className="text-brand-blue underline text-xs">Download</span>
      </div>
    </a>
  );
}

export default function SupportDesk() {
  const [meId, setMeId] = useState<string | null>(null);
  const [meRole, setMeRole] = useState<string | null>(null);

  const [tab, setTab] = useState<"OPEN" | "CLOSED">("OPEN");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<SupportTicket | null>(null);

  const isLister = meRole === "LISTER";
  const isAdmin = meRole === "ADMIN" || meRole === "SUPER_ADMIN";

  // Raise ticket modal (Lister only)
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("General");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Reply box (right pane)
  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyErr, setReplyErr] = useState<string | null>(null);
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    (async () => {
      const wrapped = await apiGet("/auth/me");
      const data = unwrap(wrapped);
      setMeId(data?.id || data?.user?.id || null);
      setMeRole(data?.role || data?.user?.role || null);
    })().catch(() => {
      setMeId(null);
      setMeRole(null);
    });
  }, []);

  async function refreshList() {
    const rows = await SupportAPI.listTickets({ status: tab });
    const list = Array.isArray(rows) ? rows : [];
    setTickets(list);

    if (activeId && !list.some((t) => t.id === activeId)) {
      setActiveId(null);
      setActive(null);
    }
  }

  async function loadTicket(id: string) {
    setActiveId(id);
    setActive(null);
    const t = await SupportAPI.getTicket(id);
    setActive(t);
  }

  useEffect(() => {
    refreshList().catch(() => setTickets([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const openCount = useMemo(() => tickets.filter((t) => t.status === "OPEN").length, [tickets]);

  function validateFiles(next: File[], setErr: (s: string | null) => void) {
    if (next.length > MAX_FILES) {
      setErr(`Only ${MAX_FILES} attachments are allowed.`);
      return false;
    }
    const tooBig = next.find((f) => !isUnder5MB(f));
    if (tooBig) {
      setErr(`"${tooBig.name}" is larger than ${MAX_MB}MB. Please upload a smaller file.`);
      return false;
    }
    setErr(null);
    return true;
  }

  async function submitTicket() {
    setCreateErr(null);
    setCreateOk(null);

    if (!subject.trim()) return setCreateErr("Subject is required.");
    if (!message.trim()) return setCreateErr("Message is required.");
    if (!validateFiles(files, setCreateErr)) return;

    try {
      setCreating(true);
      const created = await SupportAPI.createTicket({
        subject: subject.trim(),
        category: category.trim() || "General",
        message: message.trim(),
        files,
      });

      setCreateOk(`Ticket sent successfully: #${created.ticketNumber}`);
      await refreshList();

      // Auto open created ticket and clear form
      if (created?.id) await loadTicket(created.id);
      setSubject("");
      setCategory("General");
      setMessage("");
      setFiles([]);
    } catch (e: any) {
      setCreateErr(e?.message || "Failed to send ticket.");
    } finally {
      setCreating(false);
    }
  }

  async function sendReply() {
    if (!activeId) return;
    setReplyErr(null);

    if (!reply.trim()) return setReplyErr("Reply message is required.");
    if (!validateFiles(replyFiles, setReplyErr)) return;

    try {
      setReplying(true);
      await SupportAPI.replyToTicket(activeId, { content: reply.trim(), files: replyFiles });
      setReply("");
      setReplyFiles([]);
      await loadTicket(activeId);
      await refreshList();
    } catch (e: any) {
      setReplyErr(e?.message || "Failed to send reply.");
    } finally {
      setReplying(false);
    }
  }

  async function toggleStatus() {
    if (!activeId || !active) return;
    const next = active.status === "OPEN" ? "CLOSED" : "OPEN";
    await SupportAPI.setTicketStatus(activeId, next);
    await loadTicket(activeId);
    await refreshList();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
      {/* Left: Ticket list */}
      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between">
            <span>Support</span>
            <span className="text-xs font-normal text-gray-500">
              {tab === "OPEN" ? `${openCount} open` : `${tickets.length} closed`}
            </span>
          </CardTitle>

          <div className="flex gap-2 pt-2">
            <Button
              variant={tab === "OPEN" ? "default" : "outline"}
              onClick={() => setTab("OPEN")}
              className="rounded-xl"
            >
              Open
            </Button>
            <Button
              variant={tab === "CLOSED" ? "default" : "outline"}
              onClick={() => setTab("CLOSED")}
              className="rounded-xl"
            >
              Closed
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="max-h-[75vh] overflow-auto">
            {tickets.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No tickets yet.</div>
            ) : (
              <ul className="divide-y">
                {tickets.map((t) => (
                  <li
                    key={t.id}
                    onClick={() => loadTicket(t.id)}
                    className={`p-3 cursor-pointer hover:bg-gray-50 ${activeId === t.id ? "bg-gray-50" : ""}`}
                  >
                    <div className="text-sm font-medium">{t.subject}</div>
                    <div className="text-xs text-gray-500">
                      #{t.ticketNumber} · {t.category || "General"}
                    </div>
                    <div className="text-xs text-gray-400">{fmtDate(t.updatedAt || t.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Right: Ticket thread (empty by default) */}
      <Card className="rounded-2xl overflow-hidden min-h-[75vh]">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="truncate">
              {active ? `Ticket #${active.ticketNumber}` : "Select a ticket"}
            </span>

            <div className="flex items-center gap-2">
              {active && (
                <Button variant="outline" onClick={toggleStatus} className="rounded-xl">
                  {active.status === "OPEN" ? "Close" : "Reopen"}
                </Button>
              )}

              {isLister && (
                <Button
                  onClick={() => {
                    setCreateErr(null);
                    setCreateOk(null);
                    setRaiseOpen(true);
                  }}
                  className="bg-brand-blue text-white hover:bg-brand-sky rounded-xl2"
                >
                  Raise a Ticket
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {!active ? (
            <div className="text-sm text-gray-600">
              Pick a ticket on the left to view the conversation.
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{active.subject}</div>
                  <div className="text-xs text-gray-500">
                    {active.category || "General"} · created {fmtDate(active.createdAt)}
                  </div>
                </div>
                <div>
                  <Badge className="rounded-full" variant={active.status === "OPEN" ? "default" : "secondary"}>
                    {active.status}
                  </Badge>
                </div>
              </div>

              <div className="border rounded-2xl p-3 max-h-[44vh] overflow-auto space-y-3 bg-white">
                {(active.messages || []).map((m) => {
                  const senderLabel = labelForSender(meId, m);
                  return (
                    <div key={m.id} className="p-3 rounded-2xl border bg-gray-50/40">
                      <div className="text-xs text-gray-500 flex items-center justify-between gap-2">
                        <span className="truncate">{senderLabel}</span>
                        <span>{fmtDate(m.createdAt)}</span>
                      </div>
                      <div className="mt-1 text-sm whitespace-pre-wrap text-gray-800">{m.content}</div>

                      {Array.isArray(m.supportAttachments) && m.supportAttachments.length > 0 && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          {m.supportAttachments.map((a) => renderAttachment(a))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <div className="text-xs text-gray-600">Reply</div>
                <Textarea
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write a reply…"
                />

                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Attachments (max {MAX_FILES}, {MAX_MB}MB each)</div>
                  <Input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const incoming = e.target.files ? Array.from(e.target.files) : [];
                      const next = [...replyFiles, ...incoming];

                      if (next.length > MAX_FILES) {
                        setReplyErr(`Only ${MAX_FILES} attachments are allowed.`);
                        return;
                      }
                      const tooBig = next.find((f) => !isUnder5MB(f));
                      if (tooBig) {
                        setReplyErr(`"${tooBig.name}" is larger than ${MAX_MB}MB. Please upload a smaller file.`);
                        return;
                      }

                      setReplyErr(null);
                      setReplyFiles(next);
                    }}
                  />

                  {replyFiles.length > 0 && (
                    <div className="text-xs text-gray-500">
                      Selected: {replyFiles.map((f) => f.name).join(", ")}
                      <Button variant="ghost" size="sm" className="ml-2" onClick={() => setReplyFiles([])}>
                        clear
                      </Button>
                    </div>
                  )}
                </div>

                {replyErr && <div className="text-sm text-red-600">{replyErr}</div>}

                <Button
                  onClick={sendReply}
                  disabled={replying}
                  className="bg-brand-blue text-white hover:bg-brand-sky rounded-xl2"
                >
                  {replying ? "Sending…" : "Send reply"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Raise ticket modal */}
      <Dialog open={raiseOpen} onOpenChange={setRaiseOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Raise a Ticket</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs text-gray-600">Subject</div>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Payment issue" />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-gray-600">Category</div>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="General" />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-gray-600">Message</div>
              <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the issue…" />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-gray-600">Attachments (max {MAX_FILES}, {MAX_MB}MB each)</div>
              <Input
                type="file"
                multiple
                onChange={(e) => {
                  const incoming = e.target.files ? Array.from(e.target.files) : [];
                  const next = [...files, ...incoming];

                  if (next.length > MAX_FILES) {
                    setCreateErr(`Only ${MAX_FILES} attachments are allowed.`);
                    return;
                  }
                  const tooBig = next.find((f) => !isUnder5MB(f));
                  if (tooBig) {
                    setCreateErr(`"${tooBig.name}" is larger than ${MAX_MB}MB. Please upload a smaller file.`);
                    return;
                  }

                  setCreateErr(null);
                  setFiles(next);
                }}
              />

              {files.length > 0 && (
                <div className="text-xs text-gray-500">
                  Selected: {files.map((f) => f.name).join(", ")}
                  <Button variant="ghost" size="sm" className="ml-2" onClick={() => setFiles([])}>
                    clear
                  </Button>
                </div>
              )}
            </div>

            {createOk && <div className="text-sm text-green-700">{createOk}</div>}
            {createErr && <div className="text-sm text-red-600">{createErr}</div>}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRaiseOpen(false)}>
              Close
            </Button>
            <Button
              onClick={submitTicket}
              disabled={creating}
              className="bg-brand-blue text-white hover:bg-brand-sky rounded-xl2"
            >
              {creating ? "Sending…" : "Send ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}