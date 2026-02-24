"use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/auth/Guard";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
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

type ListingStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED";

type ListingRow = {
  id: string;
  title: string;
  location: string;
  county?: string | null;
  constituency?: string | null;
  ward?: string | null;
  featured?: boolean;
  status: ListingStatus;
  createdAt?: string;
  updatedAt?: string;
  lister?: { id: string; name?: string | null; email?: string };
  listerId?: string;
};

type AnyResp = any;

function normalizeListingArray(data: AnyResp): ListingRow[] {
  const arr: any[] =
    Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.properties)
          ? data.properties
          : Array.isArray(data?.listings)
            ? data.listings
            : Array.isArray(data?.data)
              ? data.data
              : [];

  return arr
    .filter(Boolean)
    .map((p: any) => ({
      id: String(p.id),
      title: String(p.title ?? ""),
      location: String(p.location ?? ""),
      county: p.county ?? null,
      constituency: p.constituency ?? null,
      ward: p.ward ?? null,
      featured: !!p.featured,
      status: (p.status as ListingStatus) ?? "DRAFT",
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      lister: p.lister ?? (p.user ? p.user : undefined),
      listerId: p.listerId ?? p.userId,
    }));
}

/**
 * Your backend already has a reliable super reports/export endpoint:
 *   GET /api/admin/exports/listings?format=json
 * Since apiGet() already prefixes /api, we call it as:
 *   /admin/exports/listings
 *
 * We keep a couple of legacy fallbacks, but exports should solve the 404.
 */
const LIST_ENDPOINTS: Array<{ path: string; params?: Record<string, any> }> = [
  { path: "/admin/exports/listings", params: { format: "json" } }, // ✅ most reliable in your stack
  { path: "/admin/properties" },
  { path: "/admin/listings" },
  { path: "/admin/properties/all" },
  { path: "/admin/listings/all" },
  { path: "/properties/admin" },
];

async function tryList(): Promise<{ path: string; items: ListingRow[] }> {
  let lastErr = "";
  for (const cand of LIST_ENDPOINTS) {
    const res = await apiGet<any>(cand.path, cand.params ? { params: cand.params } : undefined);

    if (res.ok) {
      return { path: cand.path, items: normalizeListingArray(res.data) };
    }

    // Keep last error for user-friendly reporting
    lastErr = res.error || (res.status ? `Failed (${res.status})` : "Request failed");
  }
  throw new Error(lastErr || "No listings endpoint matched");
}

export default function AdminListingsPage() {
  return (
    <Guard allowed={["ADMIN", "SUPER_ADMIN"]}>
      <AdminListingsInner />
    </Guard>
  );
}

function AdminListingsInner() {
  const [source, setSource] = useState<string>("");
  const [items, setItems] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ALL" | ListingStatus>("ALL");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const out = await tryList();
      setSource(out.path);
      setItems(out.items);
    } catch (e: any) {
      setSource("");
      setItems([]);
      setErr(e?.message || "Failed to load listings");
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
        const text = `${p.title} ${p.location} ${p.county ?? ""} ${p.constituency ?? ""} ${p.ward ?? ""} ${p.status}`.toLowerCase();
        const okQ = !needle || text.includes(needle);
        const okS = status === "ALL" || p.status === status;
        return okQ && okS;
      })
      .sort((a, b) => {
        const t1 = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const t2 = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return t2 - t1;
      });
  }, [items, q, status]);

  async function updateStatus(id: string, next: ListingStatus) {
    setBusyId(id);
    setErr(null);

    // We try multiple candidates because your codebase has both
    // "admin edit property" and "property publish/unpublish" flows.
    const attempts: Array<{
      method: "PATCH" | "POST";
      path: string;
      body?: any;
    }> = [
      // ✅ New admin controller usually does PATCH /admin/properties/:id {status}
      { method: "PATCH", path: `/admin/properties/${id}`, body: { status: next } },
      { method: "PATCH", path: `/admin/listings/${id}`, body: { status: next } },

      // Some stacks prefer a dedicated status route
      { method: "PATCH", path: `/admin/properties/${id}/status`, body: { status: next } },
      { method: "PATCH", path: `/admin/listings/${id}/status`, body: { status: next } },

      // Legacy: allow patching the base resource (RBAC should still enforce)
      { method: "PATCH", path: `/properties/${id}`, body: { status: next } },

      // Legacy publish endpoints
      ...(next === "PUBLISHED"
        ? [{ method: "PATCH" as const, path: `/properties/${id}/publish`, body: {} }]
        : next === "UNPUBLISHED"
          ? [{ method: "PATCH" as const, path: `/properties/${id}/unpublish`, body: {} }]
          : []),

      // Very old variants sometimes used POST
      ...(next === "PUBLISHED"
        ? [{ method: "POST" as const, path: `/properties/${id}/publish`, body: {} }]
        : next === "UNPUBLISHED"
          ? [{ method: "POST" as const, path: `/properties/${id}/unpublish`, body: {} }]
          : []),
    ];

    let last = "Request failed";
    for (const a of attempts) {
      const res =
        a.method === "PATCH"
          ? await apiPatch<any>(a.path, a.body ?? {})
          : await apiPost<any>(a.path, a.body ?? {});
      if (res.ok) {
        await load();
        setBusyId(null);
        return;
      }
      last = res.error || (res.status ? `Failed (${res.status})` : "Request failed");
    }

    setBusyId(null);
    alert(last || "Failed to update listing");
  }

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Listings</h1>
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
          placeholder="Search title/location/county…"
          className="w-80"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select
          className="border rounded px-2 py-2"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
        >
          <option value="ALL">All statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="PUBLISHED">PUBLISHED</option>
          <option value="UNPUBLISHED">UNPUBLISHED</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : displayed.length ? (
              displayed.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{p.title}</span>
                      <span className="text-xs text-muted-foreground">{p.id}</span>
                      {(p.lister?.email || p.listerId) && (
                        <span className="text-xs text-muted-foreground">
                          Lister: {p.lister?.email || p.listerId}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm">
                      {p.location}
                      <div className="text-xs text-muted-foreground">
                        {(p.county || "") +
                          (p.constituency ? `, ${p.constituency}` : "") +
                          (p.ward ? `, ${p.ward}` : "")}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                      {p.status}
                    </span>
                  </TableCell>

                  <TableCell>{p.featured ? "Yes" : "No"}</TableCell>

                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(p.id, "PUBLISHED")}
                        disabled={p.status === "PUBLISHED" || busyId === p.id}
                      >
                        {busyId === p.id && p.status !== "PUBLISHED" ? "…" : "Publish"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(p.id, "UNPUBLISHED")}
                        disabled={p.status === "UNPUBLISHED" || busyId === p.id}
                      >
                        {busyId === p.id && p.status !== "UNPUBLISHED" ? "…" : "Unpublish"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No listings match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}