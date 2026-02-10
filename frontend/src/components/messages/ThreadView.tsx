//frontend/src/components/messages/ThreadView.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { Thread, Message } from "@/types/messages";
import { MessagesAPI } from "./api";
import Composer from "./Composer";

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
    // mark as read
    MessagesAPI.markRead(thread.id).catch(() => {});
  }, [thread.id]);

  useEffect(() => {
    // auto-scroll
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

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
        <div>
          <div className="font-medium">{thread.subject || (thread.type === "SUPPORT" ? "Support" : "Conversation")}</div>
          <div className="text-xs text-gray-500">{thread.type}</div>
        </div>
      </div>

      {/* Messages list */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
        {messages.map((m) => {
          const mine = m.senderId === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow ${mine ? "bg-[#004AAD] text-white" : "bg-white"}`}>
                <div>{m.content}</div>
                <div className="text-[10px] opacity-70 mt-0.5">{new Date(m.sentAt).toLocaleString()}</div>
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