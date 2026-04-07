// frontend/src/components/messages/ThreadList.tsx
"use client";

import { useEffect, useState } from "react";
import { MessagesAPI } from "./api";
import type { Thread, Participant, Message, UserLite } from "@/types/messages";
import { cn } from "@/lib/utils";

function trim(text?: string, max = 48) {
  if (!text) return "";
  const t = text.trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function fmtRole(role?: string) {
  if (!role) return "";
  return String(role).replaceAll("_", " ");
}

function senderLabelFromThread(opts: {
  thread: Thread;
  last?: Message;
  meId?: string | null;
}) {
  const { thread, last, meId } = opts;

  const senderId = last?.senderId;

  // If latest message is mine, label as "You"
  if (meId && senderId && senderId === meId) return "You";

  // Resolve sender from participants (same method as ThreadView)
  const p =
    senderId && thread.participants
      ? (thread.participants as Participant[]).find((x) => x.userId === senderId)
      : undefined;

  const u = p?.user as UserLite | undefined;

  const name = u?.name?.trim();
  const role = fmtRole(u?.role);

  if (name && role) return `${name} | ${role}`;
  if (name) return name;
  if (role) return role;

  // Fallback: show the "other" participant
  const other = thread.participants?.find((x) => (meId ? x.userId !== meId : true))
    ?.user as UserLite | undefined;

  const otherName = other?.name?.trim();
  const otherRole = fmtRole(other?.role);

  if (otherName && otherRole) return `${otherName} | ${otherRole}`;
  if (otherName) return otherName;
  if (otherRole) return otherRole;

  return "User";
}

export default function ThreadList({
  activeId,
  onPick,
  meId,
}: {
  activeId?: string | null;
  onPick: (t: Thread) => void;
  meId?: string | null;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // Fix TS: listThreads only accepts "DIRECT" | "BROADCAST"
        const t = await MessagesAPI.listThreads("DIRECT");
        setThreads(t);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading threads…</div>;
  if (error) return <div className="p-4 text-sm text-red-600">{error}</div>;
  if (!threads.length) return <div className="p-4 text-sm text-gray-500">No conversations yet.</div>;

  return (
    <ul className="divide-y">
      {threads.map((t) => {
        const last = t.messages?.[0];

        const subject = trim(
          t.subject?.trim()
            ? t.subject
            : t.type === "SUPPORT"
              ? "Support"
              : "Conversation",
          48
        );

        // ✅ No hook here — safe inside map
        const sender = senderLabelFromThread({ thread: t, last, meId });

        return (
          <li key={t.id}>
            <button
              onClick={() => onPick(t)}
              className={cn(
                "w-full text-left px-3 py-3 hover:bg-gray-50 transition flex items-start gap-2",
                activeId === t.id ? "bg-gray-50" : ""
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{subject}</div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">{sender}</div>
                  </div>

                  {!!t.unread && (
                    <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-[#004AAD] text-white text-xs px-2 py-0.5">
                      {t.unread}
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-600 line-clamp-1 mt-1">
                  {last?.content || "No messages yet"}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}