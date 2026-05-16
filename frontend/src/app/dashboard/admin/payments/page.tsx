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
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
} from "lucide-react";

type PaymentRow = {
  id: string;
  amount: number;
  status: "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED" | string;
  provider?: string | null;
  method?: string | null;
  reference?: string | null;
  externalRef?: string | null;
  transactionCode?: string | null;
  phone?: string | null;
  createdAt?: string;
  paidAt?: string;
  user?: { id?: string; email?: string; name?: string | null };
  plan?: { id?: string; name?: string | null };
};

type SortField =
  | "createdAt"
  | "amount"
  | "status"
  | "method"
  | "reference"
  | "user";

function moneyKES(n: number) {
  return `KES ${Number(n || 0).toLocaleString()}`;
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function normalizedMethod(p: PaymentRow) {
  return p.method || p.provider || "—";
}

function normalizedReference(p: PaymentRow) {
  if (p.status === "SUCCESS") {
    return p.reference || p.transactionCode || p.externalRef || "—";
  }

  return p.reference || p.transactionCode || "—";
}

function statusClass(status: string) {
  if (status === "SUCCESS") return "bg-green-100 text-green-700 hover:bg-green-100";
  if (status === "PENDING") return "bg-amber-100 text-amber-800 hover:bg-amber-100";
  if (status === "FAILED") return "bg-red-100 text-red-700 hover:bg-red-100";
  return "bg-gray-100 text-gray-700 hover:bg-gray-100";
}

function compareValue(row: PaymentRow, field: SortField) {
  if (field === "createdAt") return new Date(row.paidAt || row.createdAt || 0).getTime();
  if (field === "amount") return Number(row.amount || 0);
  if (field === "status") return row.status || "";
  if (field === "method") return normalizedMethod(row);
  if (field === "reference") return normalizedReference(row);
  if (field === "user") return row.user?.email || row.user?.name || "";
  return "";
}

export default function AdminPaymentsPage() {
  return (
    <Guard allowed={["ADMIN", "SUPER_ADMIN"]}>
      <AdminPaymentsInner />
    </Guard>
  );
}

function AdminPaymentsInner() {
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "ALL">(25);
  const [sort, setSort] = useState<{ field: SortField; dir: "asc" | "desc" }>({
    field: "createdAt",
    dir: "desc",
  });

  async function load() {
    setLoading(true);
    setErr(null);

    const res = await apiGet<any>("/payments", {
      params: { take: 500 },
      cache: "no-store" as any,
    });

    if (!res.ok) {
      setItems([]);
      setErr(res.error || "Failed to load payments");
      setLoading(false);
      return;
    }

    const arr: PaymentRow[] = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data?.items)
      ? res.data.items
      : Array.isArray(res.data?.payments)
      ? res.data.payments
      : [];

    setItems(arr);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [q, status, pageSize, sort.field, sort.dir]);

  function toggleSort(field: SortField) {
    setSort((cur) =>
      cur.field === field
        ? { field, dir: cur.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" }
    );
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return items
      .filter((p) => {
        const text = [
          p.id,
          p.status,
          normalizedMethod(p),
          normalizedReference(p),
          p.externalRef,
          p.transactionCode,
          p.phone,
          p.user?.email,
          p.user?.name,
          p.plan?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const okQ = !needle || text.includes(needle);
        const okStatus = status === "ALL" || p.status === status;

        return okQ && okStatus;
      })
      .sort((a, b) => {
        const av = compareValue(a, sort.field);
        const bv = compareValue(b, sort.field);

        let result = 0;
        if (typeof av === "number" && typeof bv === "number") result = av - bv;
        else result = String(av).localeCompare(String(bv));

        return sort.dir === "asc" ? result : -result;
      });
  }, [items, q, status, sort]);

  const stats = useMemo(() => {
    const successful = items.filter((p) => p.status === "SUCCESS");
    const pending = items.filter((p) => p.status === "PENDING");
    const failed = items.filter((p) => p.status === "FAILED" || p.status === "EXPIRED");

    return {
      attempts: items.length,
      successfulCount: successful.length,
      successfulRevenue: successful.reduce((sum, p) => sum + Number(p.amount || 0), 0),
      pendingCount: pending.length,
      failedCount: failed.length,
    };
  }, [items]);

  const totalPages =
    pageSize === "ALL" ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));

  const displayed =
    pageSize === "ALL"
      ? filtered
      : filtered.slice((page - 1) * pageSize, page * pageSize);

  const canPrev = page > 1 && pageSize !== "ALL";
  const canNext = page < totalPages && pageSize !== "ALL";

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Track all payment attempts, successful receipts, and failed STK sessions.
          </p>
          {err && <div className="mt-1 text-sm text-red-600">{err}</div>}
        </div>

        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-muted-foreground">Successful revenue</div>
          <div className="mt-1 text-2xl font-bold">{moneyKES(stats.successfulRevenue)}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-muted-foreground">Successful payments</div>
          <div className="mt-1 text-2xl font-bold">{stats.successfulCount}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="mt-1 text-2xl font-bold">{stats.pendingCount}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-muted-foreground">Failed / expired</div>
          <div className="mt-1 text-2xl font-bold">{stats.failedCount}</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search phone, email, receipt, transaction..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="EXPIRED">Expired</option>
          </select>

          <select
            className="rounded-md border px-3 py-2 text-sm"
            value={String(pageSize)}
            onChange={(e) => {
              const value = e.target.value;
              setPageSize(value === "ALL" ? "ALL" : Number(value));
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} rows
              </option>
            ))}
            <option value="ALL">All</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => toggleSort("createdAt")} className="cursor-pointer">
                Date <ArrowUpDown className="ml-1 inline h-3.5 w-3.5" />
              </TableHead>
              <TableHead onClick={() => toggleSort("user")} className="cursor-pointer">
                User <ArrowUpDown className="ml-1 inline h-3.5 w-3.5" />
              </TableHead>
              <TableHead onClick={() => toggleSort("method")} className="cursor-pointer">
                Method <ArrowUpDown className="ml-1 inline h-3.5 w-3.5" />
              </TableHead>
              <TableHead onClick={() => toggleSort("status")} className="cursor-pointer">
                Status <ArrowUpDown className="ml-1 inline h-3.5 w-3.5" />
              </TableHead>
              <TableHead onClick={() => toggleSort("amount")} className="cursor-pointer text-right">
                Amount <ArrowUpDown className="ml-1 inline h-3.5 w-3.5" />
              </TableHead>
              <TableHead onClick={() => toggleSort("reference")} className="cursor-pointer">
                M-Pesa reference <ArrowUpDown className="ml-1 inline h-3.5 w-3.5" />
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : displayed.length ? (
              displayed.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(p.paidAt || p.createdAt)}</TableCell>
                  <TableCell className="min-w-[220px]">
                    <div className="font-medium">{p.user?.email || "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.user?.name || p.id}</div>
                  </TableCell>
                  <TableCell>{normalizedMethod(p)}</TableCell>
                  <TableCell>
                    <Badge className={statusClass(p.status)}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap">
                    {moneyKES(p.amount)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {normalizedReference(p)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No payments match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-sm">
          <div>
            Showing <b>{displayed.length}</b> of <b>{filtered.length}</b> filtered records
            {pageSize !== "ALL" ? (
              <>
                {" "}
                · Page <b>{page}</b> of <b>{totalPages}</b>
              </>
            ) : null}
          </div>

          {pageSize !== "ALL" ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!canPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canNext}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}