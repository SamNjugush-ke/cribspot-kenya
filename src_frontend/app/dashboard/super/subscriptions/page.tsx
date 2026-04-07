// frontend/src/app/dashboard/super/subscriptions/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/auth/Guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReasonConfirmModal from "@/components/super/ReasonConfirmModal";
import { adminFetch } from "@/lib/adminFetch";
import { API_BASE } from "@/lib/api";

type Plan = {
  id: string;
  name: string;
  price: number;
  durationInDays: number;
  totalListings: number;
  featuredListings: number;
  isActive?: boolean;
};

type SubscriptionRow = {
  id: string;
  userId: string;
  planId: string;
  startedAt: string;
  expiresAt: string;
  isActive: boolean;
  remainingListings: number;
  remainingFeatured: number;
  plan?: Partial<Plan> | null;
  user?: { id: string; email: string; name?: string | null } | null;
};

export default function SuperAdminSubscriptionsPage() {
  return (
    <Guard allowed={["SUPER_ADMIN"]}>
      <SubscriptionsInner />
    </Guard>
  );
}

function SubscriptionsInner() {
  const [items, setItems] = useState<SubscriptionRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [q, setQ] = useState("");
  const [activeOnly, setActiveOnly] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [expiringInDays, setExpiringInDays] = useState<string>("");

  // grant dialog
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantUserId, setGrantUserId] = useState("");
  const [grantPlanId, setGrantPlanId] = useState("");

  // extend dialog
  const [extendOpen, setExtendOpen] = useState(false);
  const [target, setTarget] = useState<SubscriptionRow | null>(null);
  const [extendDays, setExtendDays] = useState<number>(30);

  // reason confirm modal (single source of truth)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmAction, setConfirmAction] = useState<null | ((reason: string) => Promise<void>)>(null);

  // reset usage (reason not global anymore; per action)
  // export
  const [exportBusy, setExportBusy] = useState(false);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [subs, ps] = await Promise.all([
        adminFetch<any>("/api/admin/subscriptions"),
        // public GET /api/plans is fine; still ok to call via adminFetch
        adminFetch<any>("/api/plans"),
      ]);

      const subsArr: SubscriptionRow[] = Array.isArray(subs) ? subs : subs?.items ?? [];
      const plansArr: Plan[] = Array.isArray(ps) ? ps : ps?.items ?? [];

      setItems(subsArr);
      setPlans(plansArr);

      if (!grantPlanId && plansArr?.length) setGrantPlanId(plansArr[0].id);
    } finally {
      setLoading(false);
    }
  }

  const displayed = useMemo(() => {
    let out = [...items];

    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter((s) => {
        const hay = `${s.id} ${s.userId} ${s.planId} ${s.user?.email ?? ""} ${s.user?.name ?? ""} ${s.plan?.name ?? ""}`.toLowerCase();
        return hay.includes(needle);
      });
    }

    if (activeOnly !== "ALL") {
      const wantActive = activeOnly === "ACTIVE";
      out = out.filter((s) => !!s.isActive === wantActive);
    }

    const days = expiringInDays ? Number(expiringInDays) : NaN;
    if (!Number.isNaN(days) && days >= 0) {
      const now = Date.now();
      const horizon = now + days * 24 * 60 * 60 * 1000;
      out = out.filter((s) => new Date(s.expiresAt).getTime() <= horizon);
    }

    // urgency: earliest expiry first
    out.sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
    return out;
  }, [items, q, activeOnly, expiringInDays]);

  function confirm(title: string, fn: (reason: string) => Promise<void>) {
    setConfirmTitle(title);
    setConfirmAction(() => fn);
    setConfirmOpen(true);
  }

  function openExtend(row: SubscriptionRow) {
    setTarget(row);
    setExtendDays(30);
    setExtendOpen(true);
  }

  async function doGrant(reason: string) {
    if (!grantUserId.trim()) throw new Error("User ID is required");
    if (!grantPlanId) throw new Error("Plan is required");

    await adminFetch("/api/admin/subscriptions/grant", {
      method: "POST",
      json: {
        userId: grantUserId.trim(),
        planId: grantPlanId,
        reason,
      },
    });

    setGrantOpen(false);
    setGrantUserId("");
    await loadAll();
  }

  async function doExtend(reason: string) {
    if (!target) return;
    if (!extendDays || extendDays < 1) throw new Error("Extend days must be >= 1");

    await adminFetch(`/api/admin/subscriptions/${target.id}/extend`, {
      method: "PATCH",
      json: { days: extendDays, reason },
    });

    setExtendOpen(false);
    setTarget(null);
    await loadAll();
  }

  async function doResetUsage(row: SubscriptionRow, reason: string) {
    await adminFetch(`/api/admin/subscriptions/${row.id}/reset-usage`, {
      method: "PATCH",
      json: { reason },
    });
    await loadAll();
  }

  async function exportSubs() {
    try {
      setExportBusy(true);
      const token = localStorage.getItem("rk_token");
      const url = `${API_BASE}/api/admin/exports/subscriptions`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return alert("Export failed");
      const blob = await res.blob();

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `subscriptions_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="text-sm text-gray-600">Admin view of all subscriptions + grant/extend/reset actions.</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAll}>Refresh</Button>
          <Button variant="outline" disabled={exportBusy} onClick={exportSubs}>
            {exportBusy ? "Exporting…" : "Export"}
          </Button>
          <Button className="bg-brand-blue text-white" onClick={() => setGrantOpen(true)}>
            Grant Subscription
          </Button>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label>Search</Label>
              <Input className="w-72" placeholder="user email / plan / ids…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>

            <div>
              <Label>Status</Label>
              <select
                className="rounded-md border px-3 py-2 w-40"
                value={activeOnly}
                onChange={(e) => setActiveOnly(e.target.value as any)}
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active only</option>
                <option value="INACTIVE">Inactive only</option>
              </select>
            </div>

            <div>
              <Label>Expiring in (days)</Label>
              <Input
                className="w-44"
                type="number"
                min={0}
                placeholder="e.g. 14"
                value={expiringInDays}
                onChange={(e) => setExpiringInDays(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {displayed.map((s) => {
                const exp = new Date(s.expiresAt);
                const expSoon = exp.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

                return (
                  <TableRow key={s.id}>
                    <TableCell className="min-w-[240px]">
                      <div className="font-medium">{s.user?.email ?? s.userId}</div>
                      <div className="text-xs text-gray-500 truncate">{s.user?.name ?? "—"}</div>
                    </TableCell>

                    <TableCell className="min-w-[220px]">
                      <div className="font-medium">{s.plan?.name ?? s.planId}</div>
                      <div className="text-xs text-gray-500">
                        Listings: {Number(s.plan?.totalListings ?? 0)} · Featured: {Number(s.plan?.featuredListings ?? 0)}
                      </div>
                    </TableCell>

                    <TableCell>{s.isActive ? "Yes" : "No"}</TableCell>

                    <TableCell className="whitespace-nowrap">
                      {s.startedAt ? new Date(s.startedAt).toLocaleDateString() : "—"}
                    </TableCell>

                    <TableCell className={`whitespace-nowrap ${expSoon ? "text-brand-red font-semibold" : ""}`}>
                      {s.expiresAt ? exp.toLocaleDateString() : "—"}
                    </TableCell>

                    <TableCell className="min-w-[180px]">
                      <div>Listings: <b>{s.remainingListings ?? 0}</b></div>
                      <div>Featured: <b>{s.remainingFeatured ?? 0}</b></div>
                    </TableCell>

                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openExtend(s)}>
                          Extend
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            confirm("Reset subscription usage (remaining quotas)", async (reason) => {
                              await doResetUsage(s, reason);
                            })
                          }
                        >
                          Reset usage
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {!displayed.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                    No subscriptions match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Grant dialog -> confirm reason in ReasonConfirmModal */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Grant Subscription</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>User ID</Label>
              <Input value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)} placeholder="paste userId…" />
              <div className="text-xs text-gray-500 mt-1">
                Tip: from Users page, copy the userId. (We can upgrade to a searchable picker later.)
              </div>
            </div>

            <div>
              <Label>Plan</Label>
              <select
                className="rounded-md border px-3 py-2 w-full"
                value={grantPlanId}
                onChange={(e) => setGrantPlanId(e.target.value)}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — KES {p.price} — {p.durationInDays}d — {p.totalListings} listings / {p.featuredListings} featured
                  </option>
                ))}
                {!plans.length && <option value="">No plans found</option>}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancel</Button>
            <Button
              className="bg-brand-blue text-white"
              onClick={() =>
                confirm("Grant subscription (requires reason)", async (reason) => {
                  await doGrant(reason);
                })
              }
            >
              Grant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend dialog -> confirm reason in ReasonConfirmModal */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Extend Subscription</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-gray-600">
              {target ? (
                <>
                  Extending <b>{target.user?.email ?? target.userId}</b> · <b>{target.plan?.name ?? target.planId}</b>
                </>
              ) : (
                "—"
              )}
            </div>

            <div>
              <Label>Days to extend</Label>
              <Input type="number" min={1} value={extendDays} onChange={(e) => setExtendDays(Number(e.target.value))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendOpen(false)}>Cancel</Button>
            <Button
              className="bg-brand-blue text-white"
              onClick={() =>
                confirm("Extend subscription (requires reason)", async (reason) => {
                  await doExtend(reason);
                })
              }
            >
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reason modal */}
      <ReasonConfirmModal
        open={confirmOpen}
        title={confirmTitle}
        confirmText="Apply"
        onClose={() => setConfirmOpen(false)}
        onConfirm={async (reason) => {
          if (!confirmAction) return;
          await confirmAction(reason);
        }}
      />
    </section>
  );
}