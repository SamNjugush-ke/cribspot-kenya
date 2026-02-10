"use client";

import { useEffect, useMemo, useState } from "react";
import RequirePermission from "@/components/super/RequirePermission";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { API_BASE } from "@/lib/api";

type ExportKey = "users" | "listings" | "payments" | "subscriptions" | "audit";
type ExportFormat = "csv" | "json";

type AnyRow = Record<string, any>;

function buildQuery(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && String(v).trim() !== "") q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

function getTokenHeader(): HeadersInit {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("rk_token") : null;

  const h: Record<string, string> = {};
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}


async function fetchJsonExport(key: ExportKey, query: string) {
  const url = `${API_BASE}/api/admin/exports/${key}${query}`;
  const res = await fetch(url, { headers: getTokenHeader() });
  if (!res.ok) throw new Error(`Failed to load ${key} (${res.status})`);
  const data = await res.json();

  // Normalize common shapes
  if (Array.isArray(data)) return data as AnyRow[];
  if (data?.items && Array.isArray(data.items)) return data.items as AnyRow[];
  if (data?.data && Array.isArray(data.data)) return data.data as AnyRow[];
  return [];
}

function safeIso(d: string) {
  // Accept YYYY-MM-DD input
  if (!d) return "";
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return "";
  return t.toISOString();
}

function pickFirstDateField(row: AnyRow): string | null {
  // Try common timestamp keys
  const candidates = [
    "createdAt",
    "updatedAt",
    "paidAt",
    "date",
    "timestamp",
    "expiresAt",
    "endAt",
    "endsAt",
    "startAt",
  ];
  for (const k of candidates) {
    if (row?.[k]) return k;
  }

  // Last resort: find any key ending with "At"
  const atKey = Object.keys(row || {}).find((k) => /At$/.test(k) && row[k]);
  return atKey || null;
}

function inDateRange(row: AnyRow, from?: string, to?: string) {
  if (!from && !to) return true;
  const field = pickFirstDateField(row);
  if (!field) return true;

  const raw = row[field];
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return true;

  const fromDt = from ? new Date(from + "T00:00:00.000Z") : null;
  const toDt = to ? new Date(to + "T23:59:59.999Z") : null;

  if (fromDt && dt < fromDt) return false;
  if (toDt && dt > toDt) return false;
  return true;
}

function keywordHit(row: AnyRow, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;

  // stringify shallowly; keep it cheap
  try {
    const text = JSON.stringify(row).toLowerCase();
    return text.includes(needle);
  } catch {
    return true;
  }
}

function toCsv(rows: AnyRow[]) {
  const headers = Array.from(
    new Set(
      rows.flatMap((r) => Object.keys(r || {}))
    )
  );

  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s =
      typeof v === "string" || typeof v === "number" || typeof v === "boolean"
        ? String(v)
        : JSON.stringify(v);
    const needsQuotes = /[,"\n]/.test(s);
    const safe = s.replace(/"/g, '""');
    return needsQuotes ? `"${safe}"` : safe;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r?.[h])).join(",")),
  ];

  return lines.join("\n");
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function uniqueValues(rows: AnyRow[], key: string) {
  const s = new Set<string>();
  for (const r of rows) {
    const v = r?.[key];
    if (v === null || v === undefined) continue;
    s.add(String(v));
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

export default function SuperReportsPage() {
  return (
    <RequirePermission anyOf={["EXPORT_DATA"]}>
      <ReportsInner />
    </RequirePermission>
  );
}

function ReportsInner() {
  const [tab, setTab] = useState<ExportKey>("users");

  // Common filters
  const [from, setFrom] = useState(""); // YYYY-MM-DD
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  // Per-tab filters
  const [userStatus, setUserStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [userRole, setUserRole] = useState<string>("ALL");

  const [listingStatus, setListingStatus] = useState<string>("ALL");
  const [listingFeatured, setListingFeatured] = useState<"ALL" | "YES" | "NO">("ALL");

  const [paymentStatus, setPaymentStatus] = useState<string>("ALL");
  const [paymentProvider, setPaymentProvider] = useState<string>("ALL");

  const [subState, setSubState] = useState<"ALL" | "ACTIVE" | "EXPIRED">("ALL");

  const [auditAction, setAuditAction] = useState<string>("ALL");

  // Data
  const [rawRows, setRawRows] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  // Always fetch JSON for table preview
  const queryForServer = useMemo(() => {
    return buildQuery({
      format: "json",
      from: from || undefined,
      to: to || undefined,
      q: q.trim() || undefined,
    });
  }, [from, to, q]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setErr("");

        const rows = await fetchJsonExport(tab, queryForServer);

        if (!alive) return;
        setRawRows(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        if (!alive) return;
        setRawRows([]);
        setErr(e?.message || "Failed to load data");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [tab, queryForServer]);

  // Derived options
  const userRoles = useMemo(() => uniqueValues(rawRows, "role"), [rawRows]);
  const listingStatuses = useMemo(() => uniqueValues(rawRows, "status"), [rawRows]);
  const paymentStatuses = useMemo(() => uniqueValues(rawRows, "status"), [rawRows]);
  const paymentProviders = useMemo(() => uniqueValues(rawRows, "provider"), [rawRows]);
  const auditActions = useMemo(() => uniqueValues(rawRows, "action"), [rawRows]);

  // Client-side filtering (so table changes “in real time” even if backend ignores filters)
  const visibleRows = useMemo(() => {
    let out = [...rawRows];

    // common
    out = out.filter((r) => inDateRange(r, from || undefined, to || undefined));
    out = out.filter((r) => keywordHit(r, q));

    if (tab === "users") {
      // ACTIVE/INACTIVE mapped to isBanned (since that’s what you have)
      if (userStatus !== "ALL") {
        out = out.filter((r) => {
          const isBanned = !!r?.isBanned;
          const active = !isBanned;
          return userStatus === "ACTIVE" ? active : !active;
        });
      }
      if (userRole !== "ALL") out = out.filter((r) => String(r?.role) === userRole);
    }

    if (tab === "listings") {
      if (listingStatus !== "ALL") out = out.filter((r) => String(r?.status) === listingStatus);
      if (listingFeatured !== "ALL") {
        out = out.filter((r) => (listingFeatured === "YES" ? !!r?.featured : !r?.featured));
      }
    }

    if (tab === "payments") {
      if (paymentStatus !== "ALL") out = out.filter((r) => String(r?.status) === paymentStatus);
      if (paymentProvider !== "ALL") out = out.filter((r) => String(r?.provider) === paymentProvider);
    }

    if (tab === "subscriptions") {
      // heuristic: look for end/expiry fields
      if (subState !== "ALL") {
        out = out.filter((r) => {
          const endRaw = r?.endsAt ?? r?.endAt ?? r?.expiresAt;
          if (!endRaw) return subState === "ACTIVE"; // if unknown, treat as active-ish
          const end = new Date(endRaw);
          if (Number.isNaN(end.getTime())) return subState === "ACTIVE";
          const active = end.getTime() >= Date.now();
          return subState === "ACTIVE" ? active : !active;
        });
      }
    }

    if (tab === "audit") {
      if (auditAction !== "ALL") out = out.filter((r) => String(r?.action) === auditAction);
    }

    return out;
  }, [
    rawRows,
    tab,
    from,
    to,
    q,
    userStatus,
    userRole,
    listingStatus,
    listingFeatured,
    paymentStatus,
    paymentProvider,
    subState,
    auditAction,
  ]);

  const columns = useMemo(() => {
    // choose a stable set of columns: most common keys across visible rows
    const counts = new Map<string, number>();
    for (const r of visibleRows.slice(0, 300)) {
      for (const k of Object.keys(r || {})) {
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k)
      .slice(0, 12); // keep it readable
  }, [visibleRows]);

  function renderCell(v: any) {
    if (v === null || v === undefined) return <span className="opacity-50">—</span>;
    if (typeof v === "boolean") return v ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>;
    if (typeof v === "number") return v.toLocaleString();
    if (typeof v === "string") {
      // show date-ish strings nicely
      if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString();
      return v;
    }
    // objects/arrays
    try {
      const s = JSON.stringify(v);
      return s.length > 80 ? s.slice(0, 77) + "…" : s;
    } catch {
      return String(v);
    }
  }

  function exportVisible(format: ExportFormat) {
    const date = new Date().toISOString().slice(0, 10);
    const base = `${tab}_${date}_visible_${visibleRows.length}`;

    if (format === "json") {
      downloadBlob(JSON.stringify(visibleRows, null, 2), `${base}.json`, "application/json");
      return;
    }

    const csv = toCsv(visibleRows);
    downloadBlob(csv, `${base}.csv`, "text/csv;charset=utf-8");
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-gray-600">
            Tabs + live table. Export downloads only what you’re currently seeing.
          </p>
        </div>

        <div className="flex gap-2">
          <Button className="bg-brand-blue text-white" onClick={() => exportVisible("csv")} disabled={loading}>
            Export CSV
          </Button>
          <Button className="bg-brand-blue text-white" onClick={() => exportVisible("json")} disabled={loading}>
            Export JSON
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ExportKey)}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <Card className="shadow-soft mt-4">
          <CardContent className="p-4 space-y-4">
            {/* Common filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label>From</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <Label>To</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Keyword</Label>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="email / id / action / anything…" />
              </div>
            </div>

            {/* Tab-specific filters */}
            <TabsContent value="users" className="m-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Status</Label>
                  <select
                    value={userStatus}
                    onChange={(e) => setUserStatus(e.target.value as any)}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="ALL">All</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                  <div className="text-xs text-gray-500 mt-1">Mapped to isBanned: Active = not banned.</div>
                </div>

                <div>
                  <Label>Role</Label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="ALL">All</option>
                    {userRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <Button variant="outline" onClick={() => { setFrom(""); setTo(""); setQ(""); setUserStatus("ALL"); setUserRole("ALL"); }}>
                    Clear filters
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="listings" className="m-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Status</Label>
                  <select
                    value={listingStatus}
                    onChange={(e) => setListingStatus(e.target.value)}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="ALL">All</option>
                    {listingStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Featured</Label>
                  <select
                    value={listingFeatured}
                    onChange={(e) => setListingFeatured(e.target.value as any)}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="ALL">All</option>
                    <option value="YES">Featured</option>
                    <option value="NO">Not featured</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <Button variant="outline" onClick={() => { setFrom(""); setTo(""); setQ(""); setListingStatus("ALL"); setListingFeatured("ALL"); }}>
                    Clear filters
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="payments" className="m-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Status</Label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="ALL">All</option>
                    {paymentStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Provider</Label>
                  <select
                    value={paymentProvider}
                    onChange={(e) => setPaymentProvider(e.target.value)}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="ALL">All</option>
                    {paymentProviders.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <Button variant="outline" onClick={() => { setFrom(""); setTo(""); setQ(""); setPaymentStatus("ALL"); setPaymentProvider("ALL"); }}>
                    Clear filters
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="subscriptions" className="m-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>State</Label>
                  <select
                    value={subState}
                    onChange={(e) => setSubState(e.target.value as any)}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="ALL">All</option>
                    <option value="ACTIVE">Active</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                  <div className="text-xs text-gray-500 mt-1">Heuristic using endsAt/endAt/expiresAt.</div>
                </div>

                <div className="flex items-end">
                  <Button variant="outline" onClick={() => { setFrom(""); setTo(""); setQ(""); setSubState("ALL"); }}>
                    Clear filters
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="audit" className="m-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Action</Label>
                  <select
                    value={auditAction}
                    onChange={(e) => setAuditAction(e.target.value)}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="ALL">All</option>
                    {auditActions.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <Button variant="outline" onClick={() => { setFrom(""); setTo(""); setQ(""); setAuditAction("ALL"); }}>
                    Clear filters
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Table */}
            <div className="rounded-2xl border bg-white overflow-hidden">
              <div className="flex items-center justify-between gap-2 p-3 border-b">
                <div className="text-sm">
                  {loading ? (
                    <span className="opacity-70">Loading…</span>
                  ) : err ? (
                    <span className="text-red-600">{err}</span>
                  ) : (
                    <>
                      Showing <b>{visibleRows.length.toLocaleString()}</b> rows
                      {rawRows.length !== visibleRows.length ? (
                        <span className="opacity-70"> (filtered from {rawRows.length.toLocaleString()})</span>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${API_BASE}/api/admin/exports/${tab}${buildQuery({
                          format: "json",
                          from: from || undefined,
                          to: to || undefined,
                          q: q.trim() || undefined,
                        })}`
                      )
                    }
                  >
                    Copy JSON link
                  </Button>
                </div>
              </div>

              <div className="max-h-[60vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((c) => (
                        <TableHead key={c} className="whitespace-nowrap">
                          {c}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {!loading && !visibleRows.length ? (
                      <TableRow>
                        <TableCell colSpan={columns.length || 1} className="text-center py-8 text-gray-500">
                          No rows match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleRows.slice(0, 500).map((r, idx) => (
                        <TableRow key={r?.id ?? idx}>
                          {columns.map((c) => (
                            <TableCell key={c} className="align-top">
                              {renderCell(r?.[c])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {visibleRows.length > 500 && (
                <div className="p-3 border-t text-xs text-gray-500">
                  Table is showing the first 500 rows for performance, but export includes <b>all visible rows</b>.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Tabs>
    </section>
  );
}
