// frontend/src/app/dashboard/super/payments/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/auth/Guard";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { adminFetch } from "@/lib/adminFetch";
import { Download, RefreshCw, Search, SlidersHorizontal, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

type Payment = {
  id: string;
  amount: number;
  status: "SUCCESS" | "EXPIRED" | "PENDING";
  method: string | null;
  transactionCode?: string | null;
  createdAt: string;
  user?: { email: string } | null;
};

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function formatKes(n: number) {
  const v = Number(n || 0);
  return `KES ${v.toLocaleString()}`;
}

function statusBadge(status: Payment["status"]) {
  if (status === "SUCCESS") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "PENDING") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function toCSV(rows: Record<string, any>[]) {
  const headers = Array.from(
    rows.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    const safe = s.replace(/"/g, '""');
    return /[",\n]/.test(safe) ? `"${safe}"` : safe;
  };

  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))];
  return lines.join("\n");
}


function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function PaymentsPage() {
  return (
    <Guard allowed={["SUPER_ADMIN"]}>
      <PaymentsInner />
    </Guard>
  );
}

function PaymentsInner() {
  const [items, setItems] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [method, setMethod] = useState<string>("ALL");
  const [from, setFrom] = useState<string>(""); // yyyy-mm-dd
  const [to, setTo] = useState<string>(""); // yyyy-mm-dd

  // sort
  const [sort, setSort] = useState<{ field: keyof Payment; dir: "asc" | "desc" } | null>({
    field: "createdAt",
    dir: "desc",
  });

  // client pagination (always)
  const [page, setPage] = useState(1); // 1-based
  const [pageSize, setPageSize] = useState(25);

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await adminFetch<any>(`/api/payments`);
      const arr: Payment[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setItems(arr);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to load payments");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // whenever filters/sort/pageSize change, reset to page 1 (keeps UX sane)
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, method, from, to, sort?.field, sort?.dir, pageSize]);

  const methods = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) if (i.method) set.add(i.method);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    let out = items.filter((p) => {
      const text = `${p.user?.email ?? ""} ${p.method ?? ""} ${p.transactionCode ?? ""} ${p.id}`.toLowerCase();
      const okQ = !needle || text.includes(needle);
      const okStatus = status === "ALL" || p.status === status;
      const okMethod = method === "ALL" || (p.method ?? "") === method;

      const ts = new Date(p.createdAt).getTime();

      // Date inputs are yyyy-mm-dd; interpret as local midnight
      const fromTs = from ? new Date(from).getTime() : null;
      const toTs = to ? new Date(to).getTime() + 86_399_000 : null;

      const okFrom = fromTs == null ? true : ts >= fromTs;
      const okTo = toTs == null ? true : ts <= toTs;

      return okQ && okStatus && okMethod && okFrom && okTo;
    });

    if (sort) {
      out = [...out].sort((a, b) => {
        const aVal = (a as any)[sort.field];
        const bVal = (b as any)[sort.field];

        if (sort.field === "createdAt") {
          const A = new Date(aVal).getTime();
          const B = new Date(bVal).getTime();
          return sort.dir === "asc" ? A - B : B - A;
        }

        if (sort.field === "amount") {
          const A = Number(aVal || 0);
          const B = Number(bVal || 0);
          return sort.dir === "asc" ? A - B : B - A;
        }

        const A = String(aVal ?? "");
        const B = String(bVal ?? "");
        return sort.dir === "asc" ? A.localeCompare(B) : B.localeCompare(A);
      });
    }

    return out;
  }, [items, q, status, method, from, to, sort]);

  const filteredCountClient = filtered.length;

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredCountClient / pageSize));
  }, [filteredCountClient, pageSize]);

  // clamp page if filters reduce total pages
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const displayed = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const stats = useMemo(() => {
    // KPI is based on what is currently shown (displayed) — matches your earlier behavior
    const base = displayed;
    const totalAmount = base.reduce((s, p) => s + Number(p.amount || 0), 0);
    const success = base.filter((p) => p.status === "SUCCESS");
    const pending = base.filter((p) => p.status === "PENDING");
    const expired = base.filter((p) => p.status === "EXPIRED");

    return {
      count: base.length,
      total: totalAmount,
      successCount: success.length,
      pendingCount: pending.length,
      expiredCount: expired.length,
      successTotal: success.reduce((s, p) => s + Number(p.amount || 0), 0),
    };
  }, [displayed]);

  function toggleSort(field: keyof Payment) {
    setSort((prev) =>
      prev && prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" }
    );
  }

  function sortIndicator(field: keyof Payment) {
    if (!sort || sort.field !== field) return null;
    return <span className="ml-1 text-[10px] opacity-70">{sort.dir === "asc" ? "↑" : "↓"}</span>;
  }

  const clearFilters = () => {
    setQ("");
    setStatus("ALL");
    setMethod("ALL");
    setFrom("");
    setTo("");
    setPage(1);
  };

  async function exportCurrentView() {
    // export exactly what is on the table right now (paged view)
    setExporting(true);
    try {
      const rows = displayed.map((p) => ({
        createdAt: new Date(p.createdAt).toISOString(),
        userEmail: p.user?.email ?? "",
        method: p.method ?? "",
        status: p.status,
        amount: p.amount,
        transactionCode: p.transactionCode ?? "",
        id: p.id,
      }));

      downloadText(`payments_view_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-sm text-gray-600">
            {loading
              ? "Loading…"
              : `Filtered total: ${filteredCountClient.toLocaleString()} (showing page ${page} of ${totalPages})`}
          </p>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCurrentView} disabled={exporting || loading}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Exporting…" : "Export (current view)"}
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI cards (based on displayed rows) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="rounded-xl2">
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Revenue (current view)</div>
            <div className="text-xl font-semibold mt-1">{formatKes(stats.total)}</div>
            <div className="text-xs text-gray-500 mt-1">{stats.count.toLocaleString()} payments</div>
          </CardContent>
        </Card>

        <Card className="rounded-xl2">
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Successful</div>
            <div className="text-xl font-semibold mt-1">{stats.successCount.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">{formatKes(stats.successTotal)}</div>
          </CardContent>
        </Card>

        <Card className="rounded-xl2">
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Pending</div>
            <div className="text-xl font-semibold mt-1">{stats.pendingCount.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">Awaiting completion</div>
          </CardContent>
        </Card>

        <Card className="rounded-xl2">
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">Expired</div>
            <div className="text-xl font-semibold mt-1">{stats.expiredCount.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">Timed out / cancelled</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="rounded-xl2">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-gray-500" />
              <div className="font-semibold">Filters</div>
              <Badge variant="outline" className="rounded-full text-xs">
                Client mode
              </Badge>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <div className="md:col-span-2">
              <div className="text-xs text-gray-500 mb-1">Search</div>
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="User email, txn code, method, id…"
                  className="pl-9"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="border rounded-md px-3 py-2 w-full"
              >
                <option value="ALL">All</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="PENDING">PENDING</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Method</div>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="border rounded-md px-3 py-2 w-full"
              >
                <option value="ALL">All</option>
                {methods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">From</div>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">To</div>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <div className="text-xs text-gray-500">
              Tip: Filters apply instantly. Export downloads only the current table view.
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Rows</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border rounded-md px-2 py-1.5 text-sm"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table + pagination */}
      <Card className="rounded-xl2 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-gray-600">Loading payments…</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-brand-gray/60">
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("createdAt")}>
                      Created{" "}
                      <span className="inline-flex items-center">
                        <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-60" />
                        {sortIndicator("createdAt")}
                      </span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("id")}>
                      User{" "}
                      <span className="inline-flex items-center">
                        <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-60" />
                        {sortIndicator("id")}
                      </span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("method")}>
                      Method{" "}
                      <span className="inline-flex items-center">
                        <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-60" />
                        {sortIndicator("method")}
                      </span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("status")}>
                      Status{" "}
                      <span className="inline-flex items-center">
                        <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-60" />
                        {sortIndicator("status")}
                      </span>
                    </TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("amount")}>
                      Amount{" "}
                      <span className="inline-flex items-center">
                        <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-60" />
                        {sortIndicator("amount")}
                      </span>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("transactionCode")}>
                      Txn Code{" "}
                      <span className="inline-flex items-center">
                        <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-60" />
                        {sortIndicator("transactionCode")}
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {displayed.map((p) => (
                    <TableRow key={p.id} className="hover:bg-brand-gray/50">
                      <TableCell className="whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleTimeString()}</div>
                      </TableCell>

                      <TableCell className="min-w-[220px]">
                        <div className="text-sm font-medium">{p.user?.email ?? "—"}</div>
                        <div className="text-xs text-gray-500 font-mono truncate max-w-[260px]" title={p.id}>
                          {p.id}
                        </div>
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        {p.method ? (
                          <Badge variant="outline" className="rounded-full">
                            {p.method}
                          </Badge>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </TableCell>

                      <TableCell className="whitespace-nowrap">
                        <span
                          className={cx(
                            "inline-flex items-center px-2 py-0.5 text-xs rounded-full border",
                            statusBadge(p.status)
                          )}
                        >
                          {p.status}
                        </span>
                      </TableCell>

                      <TableCell className="text-right font-semibold whitespace-nowrap">
                        {formatKes(p.amount)}
                      </TableCell>

                      <TableCell className="font-mono text-xs whitespace-nowrap">{p.transactionCode ?? "—"}</TableCell>
                    </TableRow>
                  ))}

                  {!displayed.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-10">
                        <div className="font-medium">No payments match your filters</div>
                        <div className="text-xs mt-1">Try clearing filters or adjusting dates.</div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="p-3 text-xs text-gray-600 border-t bg-white flex items-center justify-between gap-2 flex-wrap">
                <div>
                  Page <b>{page}</b> of <b>{totalPages}</b>{" "}
                  <span className="text-gray-500">·</span>{" "}
                  Filtered total: <b>{filteredCountClient.toLocaleString()}</b>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canPrev}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canNext}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
