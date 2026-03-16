"use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/auth/Guard";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, RefreshCw, Search } from "lucide-react";

type SubscriptionRow = {
  id: string;
  startedAt: string;
  expiresAt: string;
  isActive: boolean;
  remainingListings: number;
  remainingFeatured: number;
  user?: { id: string; name?: string | null; email?: string | null; role?: string | null; isBanned?: boolean };
  plan?: { id: string; name?: string; price?: number; durationInDays?: number; totalListings?: number; featuredListings?: number };
};

function fmtDate(v?: string) {
  if (!v) return "—";
  try { return new Date(v).toLocaleString(); } catch { return "—"; }
}

function toCsv(rows: any[]) {
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r || {}))));
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    const safe = s.replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${safe}"` : safe;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function AdminSubscriptionsPage() {
  return (
    <Guard allowed={["ADMIN", "SUPER_ADMIN"]}>
      <AdminSubscriptionsInner />
    </Guard>
  );
}

function AdminSubscriptionsInner() {
  const [items, setItems] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<any>("/admin/subscriptions", { params: { take: 200 } as any });
      const arr: SubscriptionRow[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray((res.data as any)?.items)
        ? (res.data as any).items
        : [];
      setItems(arr);
    } catch (e: any) {
      setItems([]);
      setErr(e?.message || "Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const displayed = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((s) => {
      const text = `${s.user?.name ?? ""} ${s.user?.email ?? ""} ${s.plan?.name ?? ""} ${s.user?.role ?? ""}`.toLowerCase();
      return !needle || text.includes(needle);
    });
  }, [items, q]);

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((s) => s.isActive).length,
    expired: items.filter((s) => !s.isActive).length,
    lowQuota: items.filter((s) => s.isActive && s.remainingListings <= 1).length,
  }), [items]);

  function exportRows(fmt: "csv" | "json") {
    const rows = displayed.map((s) => ({
      id: s.id,
      userName: s.user?.name ?? "",
      userEmail: s.user?.email ?? "",
      userRole: s.user?.role ?? "",
      planName: s.plan?.name ?? "",
      planPrice: s.plan?.price ?? "",
      totalListings: s.plan?.totalListings ?? "",
      totalFeatured: s.plan?.featuredListings ?? "",
      remainingListings: s.remainingListings,
      remainingFeatured: s.remainingFeatured,
      isActive: s.isActive,
      startedAt: s.startedAt,
      expiresAt: s.expiresAt,
    }));
    const stamp = new Date().toISOString().slice(0, 10);
    if (fmt === "json") {
      downloadFile(JSON.stringify(rows, null, 2), `subscriptions_${stamp}.json`, "application/json");
    } else {
      downloadFile(toCsv(rows), `subscriptions_${stamp}.csv`, "text/csv;charset=utf-8");
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
            <p className="text-sm text-muted-foreground mt-1">See live packages, expiry dates, and remaining quotas without digging through payment archaeology.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
            <Button variant="outline" onClick={() => exportRows("csv")} disabled={!displayed.length}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
            <Button variant="outline" onClick={() => exportRows("json")} disabled={!displayed.length}><Download className="mr-2 h-4 w-4" /> Export JSON</Button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border p-4"><div className="text-sm text-muted-foreground">Total</div><div className="mt-1 text-3xl font-bold">{stats.total}</div></div>
          <div className="rounded-2xl border p-4"><div className="text-sm text-muted-foreground">Active</div><div className="mt-1 text-3xl font-bold">{stats.active}</div></div>
          <div className="rounded-2xl border p-4"><div className="text-sm text-muted-foreground">Expired</div><div className="mt-1 text-3xl font-bold">{stats.expired}</div></div>
          <div className="rounded-2xl border p-4"><div className="text-sm text-muted-foreground">Low listing quota</div><div className="mt-1 text-3xl font-bold">{stats.lowQuota}</div></div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search user, email, role, plan..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border bg-white shadow-sm ring-1 ring-black/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Listings left</TableHead>
              <TableHead>Featured left</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading...</TableCell></TableRow>
            ) : displayed.length ? displayed.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-medium">{s.user?.name || "Unnamed user"}</div>
                  <div className="text-sm text-muted-foreground">{s.user?.email || "—"}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{s.plan?.name || "—"}</div>
                  <div className="text-sm text-muted-foreground">{typeof s.plan?.price === "number" ? `KES ${s.plan.price.toLocaleString()}` : "—"}</div>
                </TableCell>
                <TableCell>{s.remainingListings} / {s.plan?.totalListings ?? "—"}</TableCell>
                <TableCell>{s.remainingFeatured} / {s.plan?.featuredListings ?? "—"}</TableCell>
                <TableCell>{s.isActive ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge> : <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Expired</Badge>}</TableCell>
                <TableCell>
                  <div>{fmtDate(s.expiresAt)}</div>
                  <div className="text-xs text-muted-foreground">Started {fmtDate(s.startedAt)}</div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No subscriptions found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {err ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div> : null}
    </section>
  );
}
