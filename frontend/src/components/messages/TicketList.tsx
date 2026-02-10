//frontend/src/components/messages/TicketList.tsx
"use client";

import { useEffect, useState } from "react";
import { MessagesAPI } from "./api";

type Ticket = {
  id: string;
  subject: string;
  status: "OPEN" | "CLOSED";
  category?: string;
  ticketNumber: string;
  createdAt: string;
};

export default function TicketList({ onPick }: { onPick: (id: string) => void }) {
  const [open, setOpen] = useState<Ticket[]>([]);
  const [closed, setClosed] = useState<Ticket[]>([]);

  useEffect(() => {
    (async () => {
      const rows = await MessagesAPI.listTickets();
      setOpen(rows.filter((t: Ticket) => t.status === "OPEN"));
      setClosed(rows.filter((t: Ticket) => t.status === "CLOSED"));
    })();
  }, []);

  const render = (list: Ticket[]) => (
    <ul className="divide-y">
      {list.map(t => (
        <li key={t.id} className="p-2 cursor-pointer hover:bg-gray-50" onClick={() => onPick(t.id)}>
          <div className="font-medium text-sm">{t.subject}</div>
          <div className="text-xs text-gray-500">#{t.ticketNumber} · {t.category || "General"}</div>
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
