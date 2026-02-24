"use client";

import { useEffect, useState } from "react";
import Guard from "@/components/auth/Guard";
import { apiGet } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Summary = {
  users?: { total?: number; active?: number; banned?: number };
  listings?: { draft?: number; published?: number; unpublished?: number; total?: number };
  payments?: { count?: number; totalAmount?: number };
  subscriptions?: { active?: number; expired?: number; expiringSoon?: number; total?: number };
  audit?: { last24h?: number };
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function AdminOverviewPage() {
  return (
    <Guard allowed={["ADMIN", "SUPER_ADMIN"]}>
      <AdminOverviewInner />
    </Guard>
  );
}

function AdminOverviewInner() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      // If your backend uses a different path, the catch block will show it.
      const res = await apiGet<any>("/analytics/summary");
      const payload = (res as any)?.data ?? (res as any)?.json ?? (res as any);
      setData(payload || null);
    } catch (e: any) {
      setData(null);
      setErr(e?.message || "Failed to load summary");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const usersTotal = String(data?.users?.total ?? "—");
  const usersActive = String(data?.users?.active ?? "—");
  const usersBanned = String(data?.users?.banned ?? "—");

  const listingsPublished = String(data?.listings?.published ?? "—");
  const listingsDraft = String(data?.listings?.draft ?? "—");
  const listingsUnpublished = String(data?.listings?.unpublished ?? "—");

  const paymentsCount = data?.payments?.count ?? undefined;
  const paymentsTotal = data?.payments?.totalAmount ?? undefined;

  const subsActive = String(data?.subscriptions?.active ?? "—");
  const subsExpired = String(data?.subscriptions?.expired ?? "—");

  const audit24h = String(data?.audit?.last24h ?? "—");

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="text-sm text-muted-foreground">
            {loading ? "Loading…" : err ? err : "Overview stats"}
          </div>
        </div>

        <Button variant="outline" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Users (total)" value={usersTotal} />
        <StatCard label="Users (active)" value={usersActive} />
        <StatCard label="Users (banned)" value={usersBanned} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Listings (published)" value={listingsPublished} />
        <StatCard label="Listings (draft)" value={listingsDraft} />
        <StatCard label="Listings (unpublished)" value={listingsUnpublished} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard
          label="Payments (count)"
          value={typeof paymentsCount === "number" ? paymentsCount.toLocaleString() : "—"}
        />
        <StatCard
          label="Payments (KES total)"
          value={typeof paymentsTotal === "number" ? paymentsTotal.toLocaleString() : "—"}
        />
        <StatCard label="Audit (last 24h)" value={audit24h} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <StatCard label="Subscriptions (active)" value={subsActive} />
        <StatCard label="Subscriptions (expired)" value={subsExpired} />
      </div>

      {err && (
        <div className="rounded-xl border p-4 text-sm text-red-700 bg-red-50">
          {err}
        </div>
      )}
    </section>
  );
}
