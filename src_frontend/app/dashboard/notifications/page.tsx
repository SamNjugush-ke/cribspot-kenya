"use client";

import { useEffect, useMemo, useState } from "react";

import { NotificationsAPI } from "@/components/messages/api";
import type { NotificationItem } from "@/types/messages";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

function fmt(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [includeRead, setIncludeRead] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<NotificationItem | null>(null);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const list = await NotificationsAPI.listMine({ includeRead });
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setItems([]);
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeRead]);

  const unreadCount = useMemo(() => items.filter((x) => !x.readAt).length, [items]);

  const markRead = async (id: string) => {
    try {
      await NotificationsAPI.markRead(id);
      setItems((arr) =>
        arr.map((x) => (x.id === id ? { ...x, readAt: x.readAt || new Date().toISOString() } : x))
      );
    } catch {
      // ignore
    }
  };

  const openItem = async (n: NotificationItem) => {
    setActive(n);
    setOpen(true);
    if (!n.readAt) await markRead(n.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-gray-600">
            Broadcasts and system alerts you’ve received.
            {unreadCount > 0 ? ` (${unreadCount} unread)` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant={includeRead ? "outline" : "default"} onClick={() => setIncludeRead(false)}>
            Unread only
          </Button>
          <Button variant={includeRead ? "default" : "outline"} onClick={() => setIncludeRead(true)}>
            All
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "…" : "Refresh"}
          </Button>
        </div>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="rounded-2xl border bg-white overflow-hidden">
        {loading ? (
          <div className="p-4 text-sm text-gray-600">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No notifications.</div>
        ) : (
          <div className="divide-y">
            {items.map((n) => (
              <div key={n.id} className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold truncate">{n.title}</div>
                    {!n.readAt && <Badge className="rounded-full">New</Badge>}
                  </div>

                  <div className="text-sm text-gray-700 mt-1 line-clamp-3 whitespace-pre-wrap">
                    {n.body}
                  </div>

                  <div className="text-xs text-gray-500 mt-2">{fmt(n.createdAt)}</div>

                  <div className="mt-2">
                    <Button variant="link" className="p-0 h-auto text-brand-blue" onClick={() => openItem(n)}>
                      Open
                    </Button>
                  </div>
                </div>

                {!n.readAt && (
                  <Button variant="outline" size="sm" onClick={() => markRead(n.id)}>
                    Mark read
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal to view full notification */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{active?.title || "Notification"}</DialogTitle>
          </DialogHeader>

          <div className="text-xs text-gray-500">{active ? fmt(active.createdAt) : ""}</div>
          <div className="mt-3 whitespace-pre-wrap text-sm text-gray-800">
            {active?.body || ""}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}