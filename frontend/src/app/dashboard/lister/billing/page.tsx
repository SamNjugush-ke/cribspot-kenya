'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CheckoutDialog from '@/components/billing/CheckoutDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Clock, Sparkles } from 'lucide-react';

type Plan = {
  id: string;
  name: string;
  price: number;
  durationInDays: number;
  totalListings: number;
  featuredListings: number;
  isActive: boolean;
};

type Subscription = {
  id: string;
  userId: string;
  planId: string;
  startedAt: string;
  expiresAt: string;
  remainingListings: number;
  remainingFeatured: number;
  isActive: boolean;
  plan?: Plan;
};

type Payment = {
  id: string;
  amount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  provider: 'MPESA';
  externalRef?: string | null;
  createdAt: string;
  transactionCode?: string | null;
  plan: Plan;
};

type ActiveSnapshot = {
  subscriptions?: Subscription[];
  aggregate?: {
    activeCount: number;
    remainingListings: number;
    remainingFeatured: number;
    totalListings: number;
    totalFeatured: number;
    expiresAtSoonest?: string | null;
  };
  // some versions might include different keys; we keep it loose
  [k: string]: any;
};

function unwrapActiveSnapshot(json: any): ActiveSnapshot | null {
  if (!json) return null;
  // controller returns either { message, active } or active
  if (json.active) return json.active as ActiveSnapshot;
  // if it already looks like snapshot
  if (json.aggregate || json.subscriptions) return json as ActiveSnapshot;
  return null;
}

function safeDateStr(d?: string | null) {
  if (!d) return '—';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleString();
}

function daysLeft(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function ProgressBar({ value }: { value: number }) {
  const pct = clampPct(value);
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className="h-2 rounded-full bg-[#004AAD]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeSnap, setActiveSnap] = useState<ActiveSnapshot | null>(null);
  const [activeSubs, setActiveSubs] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const [extendPickerOpen, setExtendPickerOpen] = useState(false);
  const [extendPlanId, setExtendPlanId] = useState<string | null>(null);

  const hasPending = useMemo(() => payments.some((p) => p.status === 'PENDING'), [payments]);

  async function load() {
    setLoading(true);

    const [p0, p1, p2] = await Promise.all([
      apiGet<Plan[]>('/api/plans'),
      apiGet<any>('/api/subscriptions/me'),
      apiGet<Payment[]>('/api/payments/mine'),
    ]);

    setPlans(p0.json || []);
    setPayments(p2.json || []);

    const snap = unwrapActiveSnapshot(p1.json);
    setActiveSnap(snap);

    const subsRaw = Array.isArray(snap?.subscriptions) ? snap!.subscriptions : [];
    // keep only active-ish (either isActive or not expired)
    const now = Date.now();
    const subs = subsRaw.filter((s: any) => {
      const exp = s?.expiresAt ? new Date(s.expiresAt).getTime() : NaN;
      const notExpired = Number.isFinite(exp) ? exp > now : true;
      return (s?.isActive === true && notExpired) || (s?.isActive == null && notExpired);
    });

    // sort soonest expiry first (FIFO feel)
    subs.sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());

    setActiveSubs(subs);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Poll while there is a pending payment (lets the UI update after callback)
  useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [hasPending]);

  const activeCount = activeSnap?.aggregate?.activeCount ?? activeSubs.length ?? 0;
  const hasActive = activeCount > 0;

  const soonestExpiry = activeSnap?.aggregate?.expiresAtSoonest ?? activeSubs[0]?.expiresAt ?? null;
  const dLeft = daysLeft(soonestExpiry);
  const expiringSoon = typeof dLeft === 'number' && dLeft <= 7;

  function openPayForPlan(pl: Plan) {
    setSelectedPlan(pl);
    setDialogOpen(true);
  }

  function openExtendPicker() {
    // default to soonest expiry subscription’s plan
    const first = activeSubs[0];
    setExtendPlanId(first?.planId ?? first?.plan?.id ?? null);
    setExtendPickerOpen(true);
  }

  function confirmExtend() {
    const pid = extendPlanId;
    if (!pid) return;

    const pl =
      plans.find((p) => p.id === pid) ||
      activeSubs.find((s) => s.planId === pid)?.plan ||
      null;

    setExtendPickerOpen(false);
    if (pl) openPayForPlan(pl);
  }

  return (
    <section className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing & Subscription</h1>
          <p className="text-sm text-gray-600">
            Manage packages, renewals, and usage quotas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!hasActive ? (
            <Button
              className="bg-[#004AAD] hover:bg-[#00398a]"
              onClick={() => {
                // just scroll to plans grid
                document.getElementById('plans-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              Get a plan
            </Button>
          ) : (
            <Button
              className="bg-[#004AAD] hover:bg-[#00398a]"
              onClick={openExtendPicker}
            >
              Extend
            </Button>
          )}
        </div>
      </div>

      {/* Aggregate summary */}
      <Card className="border-[#004AAD]/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#004AAD]" />
            Active packages summary
          </CardTitle>

          {loading ? null : hasActive ? (
            <Badge className={expiringSoon ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}>
              {expiringSoon ? (
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Expiring soon
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Active
                </span>
              )}
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-700">No active plan</Badge>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-gray-600">Loading…</p>
          ) : !hasActive ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-gray-700">No active plan.</p>
              <Button
                className="bg-[#004AAD] hover:bg-[#00398a]"
                onClick={() => document.getElementById('plans-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                View packages
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border bg-white p-4">
                <div className="text-sm text-gray-600">Active packages</div>
                <div className="mt-1 text-2xl font-semibold">{activeCount}</div>
                <div className="mt-2 text-xs text-gray-500">
                  Soonest expiry: <b>{safeDateStr(soonestExpiry)}</b>
                  {typeof dLeft === 'number' ? ` (${dLeft} days)` : ''}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4">
                <div className="text-sm text-gray-600">Listings remaining</div>
                <div className="mt-1 text-2xl font-semibold">
                  {activeSnap?.aggregate?.remainingListings ?? '—'}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Total purchased: <b>{activeSnap?.aggregate?.totalListings ?? '—'}</b>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4">
                <div className="text-sm text-gray-600">Featured remaining</div>
                <div className="mt-1 text-2xl font-semibold">
                  {activeSnap?.aggregate?.remainingFeatured ?? '—'}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Total purchased: <b>{activeSnap?.aggregate?.totalFeatured ?? '—'}</b>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active subscriptions list (cards) */}
      {hasActive ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Running packages</h2>
            <Button variant="outline" onClick={openExtendPicker}>
              Extend a package
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSubs.map((s) => {
              const plan = s.plan;
              const dl = daysLeft(s.expiresAt);
              const soon = typeof dl === 'number' && dl <= 7;

              const totalL = plan?.totalListings ?? 0;
              const totalF = plan?.featuredListings ?? 0;

              const usedL = totalL > 0 ? Math.max(0, totalL - (s.remainingListings ?? 0)) : 0;
              const usedF = totalF > 0 ? Math.max(0, totalF - (s.remainingFeatured ?? 0)) : 0;

              const pctL = totalL > 0 ? (usedL / totalL) * 100 : 0;
              const pctF = totalF > 0 ? (usedF / totalF) * 100 : 0;

              return (
                <Card key={s.id} className={soon ? 'border-amber-200' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-3">
                      <span className="truncate">{plan?.name ?? 'Package'}</span>
                      <Badge className={soon ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}>
                        {soon ? `Expiring in ${dl}d` : 'Active'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-gray-700">
                      Expires: <b>{safeDateStr(s.expiresAt)}</b>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">Listings</span>
                        <span className="text-gray-700">
                          Remaining: <b>{s.remainingListings}</b>{' '}
                          {plan?.totalListings ? <span className="text-xs text-gray-500">/ {plan.totalListings}</span> : null}
                        </span>
                      </div>
                      <ProgressBar value={pctL} />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">Featured</span>
                        <span className="text-gray-700">
                          Remaining: <b>{s.remainingFeatured}</b>{' '}
                          {plan?.featuredListings ? <span className="text-xs text-gray-500">/ {plan.featuredListings}</span> : null}
                        </span>
                      </div>
                      <ProgressBar value={pctF} />
                    </div>

                    <div className="pt-1 flex gap-2">
                      <Button
                        className="bg-[#004AAD] hover:bg-[#00398a]"
                        onClick={() => {
                          // choose this plan to extend
                          const pl = plans.find((p) => p.id === s.planId) || s.plan || null;
                          if (pl) openPayForPlan(pl);
                        }}
                      >
                        Extend this package
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => (window.location.href = '/dashboard/lister/list')}
                      >
                        List property
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Plans grid */}
      <div id="plans-grid" className="space-y-3">
        <h2 className="text-lg font-semibold">Packages</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((pl) => (
            <Card key={pl.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{pl.name}</span>
                  {!pl.isActive ? <Badge className="bg-gray-100 text-gray-700">Unavailable</Badge> : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-2">
                <div className="text-3xl font-bold">KES {pl.price}</div>
                <div className="text-sm text-gray-700">Duration: {pl.durationInDays} days</div>
                <div className="text-sm text-gray-700">Listings: {pl.totalListings}</div>
                <div className="text-sm text-gray-700">Featured: {pl.featuredListings}</div>

                <div className="mt-auto pt-2">
                  <Button
                    className="bg-[#004AAD] hover:bg-[#00398a] w-full"
                    disabled={!pl.isActive}
                    onClick={() => openPayForPlan(pl)}
                  >
                    Buy this package
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Payments history */}
      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {payments.length === 0 && <p className="text-gray-700">No payments yet.</p>}
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between border rounded-md px-3 py-2">
              <div>
                <div className="font-medium">{p.plan?.name ?? '—'}</div>
                <div className="text-xs text-gray-600">
                  {new Date(p.createdAt).toLocaleString()} &middot; Ref: {p.externalRef || '-'}
                  {p.transactionCode ? ` · Receipt: ${p.transactionCode}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span>KES {p.amount}</span>
                <Badge
                  className={
                    p.status === 'SUCCESS'
                      ? 'bg-green-100 text-green-700'
                      : p.status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-800'
                      : p.status === 'FAILED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'
                  }
                >
                  {p.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Extend picker */}
      <Dialog open={extendPickerOpen} onOpenChange={setExtendPickerOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Extend a package</DialogTitle>
            <DialogDescription>
              Choose which running package you want to extend (stack quotas & time).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {activeSubs.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setExtendPlanId(s.planId)}
                className={`w-full text-left rounded-xl border p-3 hover:bg-gray-50 ${
                  extendPlanId === s.planId ? 'border-[#004AAD] bg-[#004AAD]/5' : ''
                }`}
              >
                <div className="font-medium">{s.plan?.name ?? 'Package'}</div>
                <div className="text-xs text-gray-600">Expires: {safeDateStr(s.expiresAt)}</div>
              </button>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setExtendPickerOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#004AAD] hover:bg-[#00398a]" onClick={confirmExtend} disabled={!extendPlanId}>
              Continue to payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout */}
      <CheckoutDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        plan={selectedPlan}
        onSuccess={() => load()}
      />
    </section>
  );
}