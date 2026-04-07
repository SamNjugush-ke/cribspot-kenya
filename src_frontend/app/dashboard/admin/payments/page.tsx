"use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/auth/Guard";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  provider?: string | null;
  reference?: string | null;
  phone?: string | null;
  createdAt?: string;
  paidAt?: string;
  user?: { id: string; email?: string; name?: string | null };
};

const PAY_ENDPOINTS = [
  "/admin/payments",
  "/admin/transactions",
  "/payments/admin",
  "/payments",
];

async function tryList() {
  let last = "";
  for (const path of PAY_ENDPOINTS) {
    const res = await apiGet<any>(path);
    if (res.ok) {
      const data = res.data;
      const arr: PaymentRow[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.items)
          ? (data as any).items
          : Array.isArray((data as any)?.payments)
            ? (data as any).payments
            : [];
      return { path, items: arr };
    }
    last = res.error || `Failed (${res.status})`;
  }
  throw new Error(last || "No payments endpoint matched");
}

function moneyKES(n: number) {
  const v = Number(n || 0);
  return `KES ${v.toLocaleString()}`;
}

export default function AdminPaymentsPage() {
  return (
    <Guard allowed={["ADMIN", "SUPER_ADMIN"]}>
      <AdminPaymentsInner />
    </Guard>
  );
}

function AdminPaymentsInner() {
  const [source, setSource] = useState<string>("");
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const { path, items } = await tryList();
      setSource(path);
      setItems(items);
    } catch (e: any) {
      setSource("");
      setItems([]);
      setErr(e?.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const displayed = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((p) => {
        const text = `${p.id} ${p.status} ${p.provider ?? ""} ${p.reference ?? ""} ${p.phone ?? ""} ${p.user?.email ?? ""}`.toLowerCase();
        return !needle || text.includes(needle);
      })
      .sort((a, b) => {
        const t1 = new Date(a.paidAt || a.createdAt || 0).getTime();
        const t2 = new Date(b.paidAt || b.createdAt || 0).getTime();
        return t2 - t1;
      });
  }, [items, q]);

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <div className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `Showing ${displayed.length} of ${items.length}`}
          </div>
          {source && (
            <div className="text-xs text-muted-foreground">
              Source: <code className="rounded bg-muted px-1 py-0.5">{source}</code>
            </div>
          )}
          {err && <div className="text-sm text-red-600">{err}</div>}
        </div>

        <Button variant="outline" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search id / phone / reference / email…"
          className="w-96"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>User</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : displayed.length ? (
              displayed.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.id}</TableCell>
                  <TableCell className="whitespace-nowrap">{moneyKES(p.amount)}</TableCell>
                  <TableCell>{p.status}</TableCell>
                  <TableCell>{p.provider || "—"}</TableCell>
                  <TableCell>{p.reference || "—"}</TableCell>
                  <TableCell>{p.user?.email || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {p.paidAt
                      ? new Date(p.paidAt).toLocaleString()
                      : p.createdAt
                        ? new Date(p.createdAt).toLocaleString()
                        : "—"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No payments match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
