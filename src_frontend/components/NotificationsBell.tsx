"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { NotificationsAPI } from "@/components/messages/api";
import type { NotificationItem } from "@/types/messages";

function fmt(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export default function NotificationsBell() {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const top = useMemo(() => items.slice(0, 5), [items]);

  async function refreshCounts() {
    try {
      const c = await NotificationsAPI.unreadCount();
      setUnread(c || 0);
    } catch {
      setUnread(0);
    }
  }

  async function refreshPreview() {
    try {
      setLoading(true);
      const list = await NotificationsAPI.listMine({ includeRead: true });
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshCounts();
    const t = setInterval(refreshCounts, 25000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;

    refreshPreview();

    // Mark the top unread as read when the dropdown opens.
    // Keeps the bell from “sticking” when users already saw the message.
    (async () => {
      try {
        const unreadItems = (items || []).filter((x) => !x.readAt).slice(0, 5);
        for (const n of unreadItems) {
          await NotificationsAPI.markRead(n.id);
        }
        await refreshCounts();
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative" aria-label="Notifications">
          <Button variant="outline" className="rounded-xl2 relative">
            <Bell className="h-4 w-4" />
          </Button>
          {unread > 0 && (
            <span className="absolute -top-2 -right-2">
              <Badge className="rounded-full px-2 py-0.5">{unread}</Badge>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[360px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <Link href="/dashboard/notifications" className="text-xs text-brand-blue hover:underline">
            View all
          </Link>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="p-3 text-sm text-gray-600">Loading…</div>
        ) : top.length ? (
          <div className="max-h-[360px] overflow-auto">
            {top.map((n) => (
              <DropdownMenuItem key={n.id} asChild>
                <Link
                  href={n.link || "/dashboard/notifications"}
                  className="cursor-pointer flex flex-col gap-1 items-start"
                >
                  <div className="w-full flex items-center justify-between gap-2">
                    <span className={`text-sm font-medium ${!n.readAt ? "text-gray-900" : "text-gray-700"}`}>
                      {n.title}
                    </span>
                    {!n.readAt && <span className="text-[10px] text-brand-blue">NEW</span>}
                  </div>
                  <div className="text-xs text-gray-600 line-clamp-2">{n.body}</div>
                  <div className="text-[10px] text-gray-500">{fmt(n.createdAt)}</div>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        ) : (
          <div className="p-3 text-sm text-gray-600">No notifications.</div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/notifications" className="cursor-pointer">
            Show all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
