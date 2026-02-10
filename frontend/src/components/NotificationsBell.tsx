'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';

type AlertItem = {
  id: string;
  title: string;
  body?: string | null;
  createdAt: string;
  read?: boolean | null;
  url?: string | null;
};

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AlertItem[]>([]);
  const unread = items.filter(i => !i.read).length;

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<AlertItem[]>('/api/alerts?limit=10');
        setItems(Array.isArray(res.data) ? res.data : []);
      } catch {
        setItems([]);
      }
    })();
  }, []);

  return (
    <div className="relative">
      <button
        className="relative p-2 rounded hover:bg-gray-100"
        onClick={() => setOpen(v => !v)}
        aria-label="notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] rounded-full bg-red-600 text-white text-[10px] leading-4 text-center px-1">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-md border bg-white shadow-md">
          <div className="px-3 py-2 border-b font-medium">Notifications</div>
          <div className="max-h-80 overflow-auto">
            {items.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No notifications</div>
            ) : (
              items.map(a => (
                <div key={a.id} className="px-3 py-2 hover:bg-gray-50">
                  <div className="text-sm font-medium">{a.title}</div>
                  {a.body && <div className="text-xs text-gray-600">{a.body}</div>}
                  <div className="mt-1 text-xs text-gray-400">
                    {new Date(a.createdAt).toLocaleString()}
                    {a.url && (
                      <>
                        {' • '}
                        <Link href={a.url} className="text-blue-600 hover:underline">
                          Open
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
