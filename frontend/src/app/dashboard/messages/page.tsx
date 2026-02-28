// frontend/src/app/dashboard/messages/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import type { Thread } from "@/types/messages";

import ThreadList from "@/components/messages/ThreadList";
import ThreadView from "@/components/messages/ThreadView";
import { MessagesAPI } from "@/components/messages/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

export default function MessagesInboxPage() {
  const [meId, setMeId] = useState<string | undefined>();
  const [active, setActive] = useState<Thread | null>(null);
  const [activeFull, setActiveFull] = useState<Thread | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // New message modal
  const [open, setOpen] = useState(false);
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const wrapped = await apiGet("/auth/me");
        const data = unwrap(wrapped);
        setMeId(data?.id || data?.user?.id);
      } catch {
        setMeId(undefined);
      }
    })();
  }, []);

  useEffect(() => {
    if (!active?.id) {
      setActiveFull(null);
      return;
    }

    MessagesAPI.getThread(active.id)
      .then((t) => setActiveFull(t))
      .catch(() => setActiveFull(active));
  }, [active?.id, reloadKey]);

  const onPick = (t: Thread) => {
    setActive(t);
    setReloadKey((x) => x + 1);
  };

  const canSend = useMemo(() => {
    const e = toEmail.trim();
    return e.includes("@") && body.trim().length > 0;
  }, [toEmail, body]);

  const createAndSend = async () => {
    setErr(null);
    if (!canSend) return;

    try {
      setBusy(true);

      const email = toEmail.trim().toLowerCase();

      // 1) validate recipient
      const v = await MessagesAPI.validateRecipient(email);
      if (!v?.ok || !v?.user?.id) {
        throw new Error("No user found with that email. Please confirm the address and try again.");
      }

      // 2) ensure thread exists
      const started = await MessagesAPI.startDirectByEmail({
        email,
        subject: subject.trim() || undefined,
      });
      const thread = started?.thread;
      if (!thread?.id) throw new Error("Failed to start conversation.");

      // 3) send first message
      await MessagesAPI.send({ threadId: thread.id, content: body.trim() });

      // 4) open it
      setActive(thread);
      setReloadKey((x) => x + 1);

      setOpen(false);
      setToEmail("");
      setSubject("");
      setBody("");
    } catch (e: any) {
      setErr(e?.message || "Failed to send");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="p-3 border-b flex items-center justify-between gap-2">
          <div className="font-semibold">Inbox</div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-brand-blue text-white hover:bg-brand-sky rounded-xl2">
                New message
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[560px]">
              <DialogHeader>
                <DialogTitle>New message</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-xs text-gray-600">To (email)</div>
                  <Input value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="user@example.com" />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Subject (optional)</div>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-gray-600">Message</div>
                  <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" />
                </div>

                {err && <div className="text-sm text-red-600">{err}</div>}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button disabled={!canSend || busy} onClick={createAndSend} className="bg-brand-blue text-white">
                  {busy ? "Sending…" : "Send"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <ThreadList activeId={active?.id} onPick={onPick} key={reloadKey} />
      </div>

      <div className="rounded-2xl border bg-white overflow-hidden min-h-[70vh]">
        {!activeFull ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-600 p-8">
            Pick a conversation.
          </div>
        ) : (
          <ThreadView
            thread={activeFull}
            meId={meId}
            onMessageSent={() => setReloadKey((x) => x + 1)}
          />
        )}
      </div>
    </div>
  );
}