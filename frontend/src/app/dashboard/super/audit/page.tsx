"use client";

import { useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/super/RequirePermission";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminFetch } from "@/lib/adminFetch";
import { API_BASE } from "@/lib/api";

type AuditRow = {
  id: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  actorId?: string | null;
  impersonatedUserId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: any;
  createdAt: string;
  actor?: { id: string; email?: string; name?: string } | null;
};

function buildQuery(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined) return;
    const s = String(v).trim();
    if (!s) return;
    q.set(k, s);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

function previewJson(obj: any) {
  try {
    const raw = JSON.stringify(obj ?? {});
    if (raw.length <= 90) return raw;
    return raw.slice(0, 90) + "…";
  } catch {
    return "—";
  }
}

function prettyJson(obj: any) {
  try {
    return JSON.stringify(obj ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

async function downloadWithAuth(url: string, filename: string) {
  const token = localStorage.getItem("rk_token");
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Export failed (${res.status})`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function AuditPage() {
  return (
    <RequirePermission anyOf={["VIEW_SYSTEM_LOGS"]}>
      <AuditInner />
    </RequirePermission>
  );
}

function AuditInner() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [q, setQ] = useState("");
  const [action, setAction] = useState("ALL");
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState("");

  // pagination-ready (client-side for now)
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(50);

  // details modal
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      setLoading(true);

      // Shape is server-pagination ready. Backend can ignore for now.
      const query = buildQuery({
        q: q.trim() || undefined,
        action: action !== "ALL" ? action : undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit,
      });

      const data = await adminFetch<any>(`/api/audit${query}`);
      const arr: AuditRow[] = Array.isArray(data) ? data : data?.items ?? [];
      setItems(arr);
    } finally {
      setLoading(false);
    }
  }

  // local filtering still applies (works even if backend ignores filters)
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((r) => {
      const blob = `${r.action} ${r.targetType ?? ""} ${r.targetId ?? ""} ${r.actor?.email ?? ""} ${r.actorId ?? ""} ${
        r.impersonatedUserId ?? ""
      }`.toLowerCase();

      const okQ = !qq || blob.includes(qq);
      const okA = action === "ALL" || r.action === action;

      const ts = new Date(r.createdAt).getTime();
      const okFrom = from ? ts >= new Date(from).getTime() : true;
      const okTo = to ? ts <= new Date(to).getTime() + 86_399_000 : true;

      return okQ && okA && okFrom && okTo;
    });
  }, [items, q, action, from, to]);

  // pagination on the client (until backend implements it)
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [filtered, currentPage, limit]);

  const knownActions = useMemo(() => {
    return Array.from(new Set(items.map((x) => x.action))).filter(Boolean).sort();
  }, [items]);

  async function exportAudit(format: "csv" | "json" = "csv") {
    try {
      const query = buildQuery({
        format,
        q: q.trim() || undefined,
        action: action !== "ALL" ? action : undefined,
        from: from || undefined,
        to: to || undefined,
      });

      const url = `${API_BASE}/api/admin/exports/audit${query}`;
      const date = new Date().toISOString().slice(0, 10);
      const filename = `audit_${date}.${format === "json" ? "json" : "csv"}`;

      await downloadWithAuth(url, filename);
    } catch (e: any) {
      alert(e?.message || "Audit export failed");
    }
  }

  function openDetails(row: AuditRow) {
    setSelected(row);
    setOpen(true);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-sm text-gray-600">
            VIEW_SYSTEM_LOGS gated. Filter + export supported.
          </p>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportAudit("csv")}>
            Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportAudit("json")}>
            Export JSON
          </Button>
          <Button size="sm" className="bg-brand-blue text-white" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="md:col-span-2">
              <Label>Search</Label>
              <Input
                placeholder="action / actor / target / impersonation…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div>
              <Label>Action</Label>
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setPage(1);
                }}
                className="w-full border rounded px-3 py-2"
              >
                <option value="ALL">All</option>
                {knownActions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>From</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div>
              <Label>To</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="text-xs text-gray-500">
              Showing <b>{Math.min(total, (currentPage - 1) * limit + 1)}</b>–<b>{Math.min(total, currentPage * limit)}</b> of{" "}
              <b>{total}</b>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs">Rows</Label>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="border rounded px-2 py-1 text-sm"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>

              <Button
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <div className="text-sm text-gray-700">
                Page <b>{currentPage}</b> / <b>{totalPages}</b>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Impersonation</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead className="text-right"> </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {pageSlice.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</TableCell>

                  <TableCell className="font-medium whitespace-nowrap">{r.action}</TableCell>

                  <TableCell className="whitespace-nowrap">
                    {r.actor?.email || r.actor?.name || r.actorId || "—"}
                  </TableCell>

                  <TableCell className="whitespace-nowrap">
                    {(r.targetType || "—") + (r.targetId ? `:${r.targetId}` : "")}
                  </TableCell>

                  <TableCell className="whitespace-nowrap">
                    {r.impersonatedUserId ? (
                      <span className="text-xs rounded px-2 py-1 bg-brand-sky/10 text-brand-blue">
                        as {r.impersonatedUserId}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>

                  <TableCell className="max-w-[360px] truncate text-xs text-gray-600">
                    {r.metadata ? previewJson(r.metadata) : "—"}
                  </TableCell>

                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => openDetails(r)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {!pageSlice.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-6">
                    No audit entries match your filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Details modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Audit Entry</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-gray-500">Action</div>
                  <div className="font-semibold">{selected.action}</div>

                  <div className="mt-2 text-xs text-gray-500">Time</div>
                  <div>{new Date(selected.createdAt).toLocaleString()}</div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs text-gray-500">Actor</div>
                  <div className="font-semibold">
                    {selected.actor?.email || selected.actor?.name || selected.actorId || "—"}
                  </div>

                  <div className="mt-2 text-xs text-gray-500">Target</div>
                  <div>
                    {(selected.targetType || "—") + (selected.targetId ? `:${selected.targetId}` : "")}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-gray-500">Impersonated user</div>
                  <div className="font-semibold">{selected.impersonatedUserId || "—"}</div>

                  <div className="mt-2 text-xs text-gray-500">IP</div>
                  <div className="truncate">{selected.ip || "—"}</div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="text-xs text-gray-500">User-Agent</div>
                  <div className="truncate">{selected.userAgent || "—"}</div>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Metadata</div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(prettyJson(selected.metadata))}
                    >
                      Copy JSON
                    </Button>
                  </div>
                </div>

                <pre className="mt-2 max-h-[340px] overflow-auto rounded-md bg-brand-gray p-3 text-xs">
                  {prettyJson(selected.metadata)}
                </pre>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
