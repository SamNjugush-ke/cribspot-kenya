'use client';

import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/auth/Guard';
import RequirePermission from '@/components/super/RequirePermission';
import { apiGet } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Summary = {
  users?: { total?: number; active?: number; banned?: number };
  listings?: { draft?: number; published?: number; unpublished?: number; total?: number };
  payments?: { totalAmount?: number; count?: number };
  subscriptions?: { active?: number; expired?: number; expiringSoon?: number; total?: number };
  audit?: { last24h?: number };
};

function StatCard({ label, value, hint }: { label: string; value: any; hint?: string }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value ?? '—'}</div>
        {hint ? <div className="text-xs text-muted-foreground mt-1">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardHome() {
  return (
    <Guard allowed={['ADMIN', 'SUPER_ADMIN']}>
      <RequirePermission anyOf={['VIEW_ANALYTICS']}>
        <AdminDashboardInner />
      </RequirePermission>
    </Guard>
  );
}

function AdminDashboardInner() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await apiGet<any>('/analytics/summary');
      // apiGet has had a couple shapes in this repo (json/data). Normalize safely.
      const data = (res as any)?.data ?? (res as any)?.json ?? res;
      if (!data) throw new Error('Empty response');
      setSummary(data as Summary);
    } catch (e: any) {
      setSummary(null);
      setErr(e?.message || 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const users = summary?.users || {};
  const listings = summary?.listings || {};
  const payments = summary?.payments || {};
  const subs = summary?.subscriptions || {};
  const audit = summary?.audit || {};

  const money = useMemo(() => {
    const n = Number(payments.totalAmount || 0);
    return `KES ${n.toLocaleString()}`;
  }, [payments.totalAmount]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="text-sm text-muted-foreground">
            {loading ? 'Loading…' : err ? <span className="text-red-600">{err}</span> : 'Overview'}
          </div>
        </div>

        <Button variant="outline" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Users — Total" value={users.total} />
        <StatCard label="Users — Active" value={users.active} hint="Active = not banned" />
        <StatCard label="Users — Banned" value={users.banned} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Listings — Draft" value={listings.draft} />
        <StatCard label="Listings — Published" value={listings.published} />
        <StatCard label="Listings — Unpublished" value={listings.unpublished} />
        <StatCard label="Listings — Total" value={listings.total} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Payments — Total Amount" value={money} />
        <StatCard label="Payments — Count" value={payments.count} />
        <StatCard label="Subscriptions — Active" value={subs.active} />
        <StatCard label="Audit — Last 24h" value={audit.last24h} />
      </div>

      <div className="rounded-xl border bg-white p-4 text-sm text-muted-foreground">
        Tip: the detailed pages live under <code className="rounded bg-muted px-1 py-0.5">/dashboard/admin/*</code>.
      </div>
    </section>
  );
}
