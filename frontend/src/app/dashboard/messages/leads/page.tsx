"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

type Lead = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  propertyId?: string | null;
  createdAt: string;
};

function pickArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.leads)) return payload.leads;
  return [];
}

async function fetchLeads(): Promise<Lead[]> {
  // Try a few likely endpoints (without breaking the UI if one doesn't exist)
  const tries = ["/leads", "/properties/leads", "/leads/mine"];

  for (const path of tries) {
    const res = await apiGet<any>(path, { cache: "no-store" });
    if (res.ok) {
      const arr = pickArray(res.data);
      return (arr || []) as Lead[];
    }
  }

  // None worked
  return [];
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const data = await fetchLeads();
        setLeads(Array.isArray(data) ? data : []);
        if (!data.length) {
          // If leads endpoint(s) don't exist, we keep UI calm but hint in console.
          // (No build break, no runtime crash.)
          console.warn("[LeadsPage] No leads returned. Ensure backend has /api/leads (or /api/properties/leads).");
        }
      } catch (e: any) {
        setErr(e?.message || "Failed to load leads");
        setLeads([]);
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
      ) : err ? (
        <div className="text-sm text-red-600">{err}</div>
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
              {leads.map((l) => (
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