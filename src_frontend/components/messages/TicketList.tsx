//frontend/src/components/messages/TicketList.tsx
"use client";

import { useEffect, useState } from "react";
import { SupportAPI } from "./api";

/**
 * Local UI-safe ticket type.
 * We normalize backend nulls into undefined.
 */
type Ticket = {
  id: string;
  subject: string;
  status: "OPEN" | "CLOSED";
  category?: string;
  ticketNumber: string;
  createdAt: string;
};

/**
 * Raw shape coming from backend.
 * (Matches SupportTicket more closely.)
 */
type RawTicket = {
  id: string;
  subject: string;
  status: "OPEN" | "CLOSED";
  category?: string | null;
  ticketNumber: string;
  createdAt: string;
};

export default function TicketList({
  onPick,
}: {
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState<Ticket[]>([]);
  const [closed, setClosed] = useState<Ticket[]>([]);

  useEffect(() => {
    (async () => {
      const openRows = (await SupportAPI.listTickets({
        status: "OPEN",
      })) as RawTicket[];

      const closedRows = (await SupportAPI.listTickets({
        status: "CLOSED",
      })) as RawTicket[];

      const allRows = [...openRows, ...closedRows];

      // Normalize null category → undefined
      const normalized: Ticket[] = allRows.map((t) => ({
        ...t,
        category: t.category ?? undefined,
      }));

      setOpen(normalized.filter((t) => t.status === "OPEN"));
      setClosed(normalized.filter((t) => t.status === "CLOSED"));
    })();
  }, []);

  const render = (list: Ticket[]) => (
    <ul className="divide-y">
      {list.map((t) => (
        <li
          key={t.id}
          className="p-2 cursor-pointer hover:bg-gray-50"
          onClick={() => onPick(t.id)}
        >
          <div className="font-medium text-sm">{t.subject}</div>
          <div className="text-xs text-gray-500">
            #{t.ticketNumber} · {t.category || "General"}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-1">Open</h3>
        {render(open)}
      </div>

      <div>
        <h3 className="font-semibold mb-1">Closed</h3>
        {render(closed)}
      </div>
    </div>
  );
}