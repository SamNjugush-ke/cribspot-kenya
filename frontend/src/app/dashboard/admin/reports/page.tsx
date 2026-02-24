"use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/auth/Guard";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ExportKey = "users" | "listings" | "payments" | "subscriptions" | "audit";

type AnyRow = Record<string, any>;

const EXPORT_ENDPOINTS = [
  (k: ExportKey, q: string) => `/admin/exports/${k}${q}`,
  (k: ExportKey, q: string) => `/admin/reports/exports/${k}${q}`,
  (k: ExportKey, q: string) => `/admin/export/${k}${q}`,
];

function buildQuery(params: Record<string, string | undefined>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && String(v).trim() !== "") usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

async function fetchExport(key: ExportKey, query: string) {
  let last = "";
  for (const mk of EXPORT_ENDPOINTS) {
    const path = mk(key, query);
    const res = await apiGet<any>(path);
    if (res.ok) {
      const data = res.data;
      const rows: AnyRow[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.items)
          ? (data as any).items
          : Array.isArray((data as any)?.data)
            ? (data as any).data
            : [];
      return { path, rows };
    }
    last = res.error || `Failed (${res.status})`;
  }
  throw new Error(last || "No exports endpoint matched");
}

function toCsv(rows: AnyRow[]) {
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r || {}))));
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
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r?.[h])).join(","))];
  return lines.join("\n");
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function AdminReportsPage() {
  return (
    <Guard allowed={["ADMIN", "SUPER_ADMIN"]}>
      <AdminReportsInner />
    </Guard>
  );
}

function AdminReportsInner() {
  const [tab, setTab] = useState<ExportKey>("users");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const [source, setSource] = useState<string>("");
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const query = useMemo(
    () =>
      buildQuery({
        format: "json",
        from: from || undefined,
        to: to || undefined,
        q: q.trim() || undefined,
      }),
    [from, to, q]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const out = await fetchExport(tab, query);
        if (!alive) return;
        setSource(out.path);
        setRows(out.rows);
      } catch (e: any) {
        if (!alive) return;
        setSource("");
        setRows([]);
        setErr(e?.message || "Failed to load report");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab, query]);

  const columns = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows.slice(0, 300)) {
      for (const k of Object.keys(r || {})) counts.set(k, (counts.get(k) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k)
      .slice(0, 12);
  }, [rows]);

  function exportRows(fmt: "csv" | "json") {
    const date = new Date().toISOString().slice(0, 10);
    const base = `${tab}_${date}_${rows.length}`;
    if (fmt === "json") {
      download(JSON.stringify(rows, null, 2), `${base}.json`, "application/json");
    } else {
      download(toCsv(rows), `${base}.csv`, "text/csv;charset=utf-8");
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <div className="text-sm text-muted-foreground">
            {loading ? "Loading…" : err ? err : `Rows: ${rows.length.toLocaleString()}`}
          </div>
          {source && (
            <div className="text-xs text-muted-foreground">
              Endpoint: <code className="rounded bg-muted px-1 py-0.5">{source}</code>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button className="bg-brand-blue text-white" onClick={() => exportRows("csv")} disabled={loading || !rows.length}>
            Export CSV
          </Button>
          <Button className="bg-brand-blue text-white" onClick={() => exportRows("json")} disabled={loading || !rows.length}>
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

        <div className="rounded-xl border bg-white p-4 mt-4 space-y-3">
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

          <TabsContent value={tab} className="m-0">
            <div className="overflow-x-auto rounded-xl border">
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
                  {!loading && !rows.length ? (
                    <TableRow>
                      <TableCell colSpan={columns.length || 1} className="py-8 text-center text-muted-foreground">
                        {err
                          ? "Exports endpoint is missing or blocked by permissions."
                          : "No rows match the current filters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.slice(0, 300).map((r, idx) => (
                      <TableRow key={r?.id ?? idx}>
                        {columns.map((c) => (
                          <TableCell key={c} className="align-top">
                            {r?.[c] === null || r?.[c] === undefined ? "—" : typeof r[c] === "object" ? JSON.stringify(r[c]).slice(0, 80) : String(r[c])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {rows.length > 300 && (
              <div className="text-xs text-muted-foreground mt-2">
                Table shows first 300 rows for performance. Export includes all loaded rows.
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </section>
  );
}
