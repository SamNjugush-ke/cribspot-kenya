// src/app/dashboard/messages/leads/page.tsx
"use client";

import { useEffect, useState } from "react";
import { MessagesAPI } from "@/components/messages/api";

type Lead = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  propertyId?: string;
  createdAt: string;
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await MessagesAPI.listLeads();
        setLeads(data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="border rounded-xl bg-white p-4">
      <h2 className="font-semibold mb-3">Leads</h2>
      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : leads.length ? (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Property</th>
                <th className="py-2 pr-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{l.name}</td>
                  <td className="py-2 pr-3">{l.email || "—"}</td>
                  <td className="py-2 pr-3">{l.phone || "—"}</td>
                  <td className="py-2 pr-3">{l.propertyId || "—"}</td>
                  <td className="py-2 pr-3">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-gray-500">No leads yet.</div>
      )}
    </div>
  );
}