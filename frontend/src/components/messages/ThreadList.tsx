//frontend/src/components/messages/ThreadList.tsx
"use client";

import { useEffect, useState } from "react";
import { MessagesAPI } from "./api";
import type { Thread } from "@/types/messages";
import { cn } from "@/lib/utils";

export default function ThreadList({
  activeId,
  onPick,
}: {
  activeId?: string | null;
  onPick: (t: Thread) => void;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const t = await MessagesAPI.listThreads("inbox");
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
        const title =
          t.subject ||
          (t.participants?.[0]?.user?.name && t.participants.map(p => p.user?.name).join(", ")) ||
          (t.type === "SUPPORT" ? "Support" : "Conversation");
        return (
          <li key={t.id}>
            <button
              onClick={() => onPick(t)}
              className={cn(
                "w-full text-left px-3 py-3 hover:bg-gray-50 transition flex items-start gap-2",
                activeId === t.id ? "bg-gray-50" : ""
              )}
            >
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{title}</span>
                  {!!t.unread && <span className="ml-2 inline-flex items-center justify-center rounded-full bg-[#004AAD] text-white text-xs px-2 py-0.5">{t.unread}</span>}
                </div>
                <p className="text-xs text-gray-600 line-clamp-1 mt-0.5">{last?.content || "No messages yet"}</p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}