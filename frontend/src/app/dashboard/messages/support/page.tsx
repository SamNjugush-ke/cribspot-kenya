"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import type { Thread } from "@/types/messages";
import ThreadView from "@/components/messages/ThreadView";
import TicketList from "@/components/messages/TicketList";
import SupportTicketForm from "@/components/messages/SupportTicketForm";

type MeResp = { user?: { id: string } };

export default function SupportMessagesPage() {
  const [me, setMe] = useState<MeResp | null>(null);
  const [active, setActive] = useState<Thread | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("rk_token");
    if (!token) return;
    fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setMe).catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-160px)]">
      <aside className="col-span-12 lg:col-span-3 border rounded-xl bg-white p-4 overflow-y-auto">
        <h2 className="font-semibold mb-2">New Ticket</h2>
        <SupportTicketForm onCreated={(id) => console.log("Created ticket", id)} />
        <hr className="my-3" />
        <TicketList onPick={(id) => console.log("Pick ticket", id)} />
      </aside>
      <section className="col-span-12 lg:col-span-9 border rounded-xl bg-white">
        {active ? (
          <ThreadView thread={active} meId={me?.user?.id} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            Select a ticket to view conversation
          </div>
        )}
      </section>
    </div>
  );
}
