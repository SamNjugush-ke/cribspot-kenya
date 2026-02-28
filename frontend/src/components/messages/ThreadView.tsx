// frontend/src/components/messages/ThreadView.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Thread, Message, Participant, UserLite } from "@/types/messages";
import { MessagesAPI } from "./api";
import Composer from "./Composer";

function fmtRole(role?: string) {
  if (!role) return "";
  return String(role).replaceAll("_", " ");
}

function senderLabel(opts: {
  msg: Message;
  meId?: string;
  participants: Participant[];
}) {
  const { msg, meId, participants } = opts;
  if (meId && msg.senderId === meId) return "You";

  const p = participants.find((x) => x.userId === msg.senderId);
  const u = p?.user as UserLite | undefined;

  const name = u?.name?.trim();
  const role = fmtRole(u?.role);

  if (name && role) return `${name} | ${role}`;
  if (name) return name;
  if (role) return role;

  // fallback if user info wasn’t included
  return "User";
}

export default function ThreadView({
  thread,
  meId,
  onMessageSent,
}: {
  thread: Thread;
  meId?: string;
  onMessageSent?: (m: Message) => void;
}) {
  const [messages, setMessages] = useState<Message[]>(thread.messages || []);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(thread.messages || []);
    MessagesAPI.markRead(thread.id).catch(() => {});
  }, [thread.id, thread.messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const headerTitle = useMemo(() => {
    if (thread.subject?.trim()) return thread.subject;
    const other = thread.participants.find((p) => p.userId !== meId)?.user;
    if (other?.name) return other.name;
    return thread.type === "SUPPORT" ? "Support" : "Conversation";
  }, [thread.subject, thread.participants, thread.type, meId]);

  const send = async (content: string) => {
    const res = await MessagesAPI.send({ threadId: thread.id, content });

    // optimistic append
    const fakeMsg: Message = {
      id: res?.id || Math.random().toString(36).slice(2),
      conversationId: thread.id,
      senderId: meId || "me",
      receiverId: "n/a",
      content,
      sentAt: new Date().toISOString(),
    };

    setMessages((m) => [...m, fakeMsg]);
    onMessageSent?.(fakeMsg);
    setTimeout(() => MessagesAPI.markRead(thread.id).catch(() => {}), 300);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="h-12 border-b px-4 flex items-center justify-between">
        <div className="min-w-0">
          <div className="font-medium truncate">{headerTitle}</div>
          <div className="text-xs text-gray-500">{thread.type}</div>
        </div>
      </div>

      {/* Messages list */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.map((m) => {
          const mine = m.senderId === meId;
          const label = senderLabel({ msg: m, meId, participants: thread.participants });

          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow ${
                  mine ? "bg-[#004AAD] text-white" : "bg-white"
                }`}
              >
                {/* Sender label */}
                <div className={`text-[11px] font-medium ${mine ? "text-white/90" : "text-gray-600"}`}>
                  {label}
                </div>

                <div className="mt-1 whitespace-pre-wrap">{m.content}</div>

                <div className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-gray-500"}`}>
                  {new Date(m.sentAt).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="border-t bg-white p-3">
        <Composer onSend={send} />
      </div>
    </div>
  );
}