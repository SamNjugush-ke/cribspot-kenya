//frontend/src/app/dashboard/lister/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  BarChart3,
  Plus,
  Sparkles,
  Clock,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Megaphone,
  ArrowRight,
  Star,
  Eye,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

type Unit = { rent: number };
type Property = {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  featured?: boolean;
  createdAt: string;
  units: Unit[];
};

type Usage = {
  remainingListings: number;
  remainingFeatured: number;
  totalListings: number;
  totalFeatured: number;
  usedPublished: number;
  activeCount: number;
  expiresAtSoonest: string | null;
};

function clamp(n: number, min = 0, max = 100) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

function pct(used: number, total: number) {
  if (!total || total <= 0) return 0;
  return clamp((used / total) * 100);
}

function fmtMoney(n?: number | null) {
  if (!Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString();
}

function fmtDate(d?: string | null) {
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

function ProgressBar({
  value,
  tone = 'brand',
}: {
  value: number;
  tone?: 'brand' | 'warn' | 'danger';
}) {
  const p = clamp(value);
  const bar =
    tone === 'danger'
      ? 'bg-red-500'
      : tone === 'warn'
      ? 'bg-amber-500'
      : 'bg-[#004AAD]';

  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-2 rounded-full ${bar}`} style={{ width: `${p}%` }} />
    </div>
  );
}

function StatusPill({ status }: { status: Property['status'] }) {
  if (status === 'PUBLISHED')
    return <Badge className="bg-green-100 text-green-700">PUBLISHED</Badge>;
  if (status === 'DRAFT') return <Badge className="bg-gray-100 text-gray-700">DRAFT</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800">UNPUBLISHED</Badge>;
}

export default function ListerDashboardHome() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const [resProps, resUsage] = await Promise.all([
        apiGet<{ items: Property[] }>('/api/properties/mine?limit=100'),
        apiGet<Usage>('/api/subscriptions/usage'),
      ]);

      if (resProps.ok && resProps.data?.items) setProperties(resProps.data.items);
      if (resUsage.ok && resUsage.data) setUsage(resUsage.data);

      setLoading(false);
    })();
  }, []);

  // Basic counts
  const totals = useMemo(() => {
    const published = properties.filter((p) => p.status === 'PUBLISHED').length;
    const drafts = properties.filter((p) => p.status === 'DRAFT').length;
    const unpublished = properties.filter((p) => p.status === 'UNPUBLISHED').length;
    const featured = properties.filter((p) => p.featured).length;

    const rents = properties
      .flatMap((p) => p.units?.map((u) => u.rent).filter((r) => Number.isFinite(r)) ?? [])
      .map(Number);

    const avgRent = rents.length ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length) : null;
    const maxRent = rents.length ? Math.max(...rents) : null;

    return { published, drafts, unpublished, featured, avgRent, maxRent };
  }, [properties]);

  // Subscription insights
  const sub = useMemo(() => {
    const expiresIn = daysLeft(usage?.expiresAtSoonest ?? null);
    const expiringSoon = typeof expiresIn === 'number' && expiresIn <= 7;

    const totalListings = usage?.totalListings ?? 0;
    const remainingListings = usage?.remainingListings ?? 0;
    const usedListings = Math.max(0, totalListings - remainingListings);

    const totalFeatured = usage?.totalFeatured ?? 0;
    const remainingFeatured = usage?.remainingFeatured ?? 0;
    const usedFeatured = Math.max(0, totalFeatured - remainingFeatured);

    const listingPct = pct(usedListings, totalListings);
    const featuredPct = pct(usedFeatured, totalFeatured);

    const listingTone: 'brand' | 'warn' | 'danger' =
      listingPct >= 90 ? 'danger' : listingPct >= 70 ? 'warn' : 'brand';
    const featuredTone: 'brand' | 'warn' | 'danger' =
      featuredPct >= 90 ? 'danger' : featuredPct >= 70 ? 'warn' : 'brand';

    return {
      expiresIn,
      expiringSoon,
      usedListings,
      listingPct,
      listingTone,
      usedFeatured,
      featuredPct,
      featuredTone,
    };
  }, [usage]);

  // Chart data (last 14 days activity)
  const activitySeries = useMemo(() => {
    // group created listings per day
    const map = new Map<string, number>();
    for (const p of properties) {
      const d = new Date(p.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = d.toLocaleDateString();
      map.set(key, (map.get(key) || 0) + 1);
    }

    // Keep recent keys (best-effort, sorted by actual date)
    const entries = Array.from(map.entries())
      .map(([k, v]) => ({ day: k, Listings: v }))
      .sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime());

    return entries.slice(-14);
  }, [properties]);

  // Status breakdown chart
  const statusBreakdown = useMemo(() => {
    return [
      { name: 'Published', value: totals.published },
      { name: 'Drafts', value: totals.drafts },
      { name: 'Unpublished', value: totals.unpublished },
    ];
  }, [totals]);

  // Action recommendations
  const nextActions = useMemo(() => {
    const actions: Array<{
      title: string;
      desc: string;
      href: string;
      icon: any;
      tone: 'brand' | 'warn' | 'danger' | 'neutral';
    }> = [];

    if ((usage?.activeCount ?? 0) <= 0) {
      actions.push({
        title: 'Activate a package to start listing',
        desc: 'You currently have no active subscription packages.',
        href: '/dashboard/lister/billing',
        icon: ShieldCheck,
        tone: 'danger',
      });
    } else {
      if (sub.expiringSoon) {
        actions.push({
          title: 'Renew soon to avoid interruptions',
          desc: `Your soonest package expires in ${sub.expiresIn ?? '—'} day(s).`,
          href: '/dashboard/lister/billing',
          icon: Clock,
          tone: 'warn',
        });
      }
      if ((usage?.remainingListings ?? 0) <= 0) {
        actions.push({
          title: 'You’re out of listing quota',
          desc: 'Extend a package or buy another to continue publishing.',
          href: '/dashboard/lister/billing',
          icon: AlertTriangle,
          tone: 'danger',
        });
      } else if (totals.drafts > 0) {
        actions.push({
          title: 'Publish your drafts',
          desc: `You have ${totals.drafts} draft listing(s) ready to go live.`,
          href: '/dashboard/lister/list',
          icon: Megaphone,
          tone: 'brand',
        });
      } else if (properties.length === 0) {
        actions.push({
          title: 'Create your first listing',
          desc: 'Start attracting tenants by adding a property now.',
          href: '/dashboard/lister/list',
          icon: Plus,
          tone: 'brand',
        });
      }
    }

    // Always keep one “quality” action
    actions.push({
      title: 'Improve listing quality',
      desc: 'Photos + accurate rent + complete details get more views.',
      href: '/dashboard/lister/list',
      icon: Sparkles,
      tone: 'neutral',
    });

    return actions.slice(0, 4);
  }, [properties.length, sub.expiringSoon, sub.expiresIn, totals.drafts, usage, sub]);

  const recent = useMemo(() => {
    return properties
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [properties]);

  return (
    <section className="p-6 space-y-6">
      {/* Top hero */}
      <div className="rounded-2xl border bg-gradient-to-r from-[#004AAD]/10 via-white to-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Lister Overview</h1>
            <p className="text-sm text-gray-600">
              Track your listings, quota, and what to do next — in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/lister/list">
              <Button className="bg-[#004AAD] hover:bg-[#00398a]">
                <Plus className="h-4 w-4 mr-2" />
                Add listing
              </Button>
            </Link>
            <Link href="/dashboard/lister/billing">
              <Button variant="outline">
                Manage subscription <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Quick KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="border-[#004AAD]/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total listings</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{properties.length}</CardContent>
          </Card>

          <Card className="border-[#004AAD]/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Published</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{totals.published}</CardContent>
          </Card>

          <Card className="border-[#004AAD]/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Drafts</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{totals.drafts}</CardContent>
          </Card>

          <Card className="border-[#004AAD]/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Featured</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{totals.featured}</CardContent>
          </Card>

          <Card className="border-[#004AAD]/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg rent</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">KES {fmtMoney(totals.avgRent)}</CardContent>
          </Card>
        </div>
      </div>

      {/* Actionable insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#004AAD]" />
                Activity & performance
              </CardTitle>
              <CardDescription>Listings created over time and status breakdown.</CardDescription>
            </div>
            {usage?.activeCount ? (
              <Badge className={sub.expiringSoon ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}>
                {sub.expiringSoon ? (
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Expiring soon
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Subscription active
                  </span>
                )}
              </Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-700">No subscription</Badge>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Quota / usage */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">Listing quota</div>
                  <Badge className="bg-gray-100 text-gray-700">
                    {usage ? `${usage.remainingListings} left` : '—'}
                  </Badge>
                </div>
                <div className="mt-2 text-sm">
                  Used: <b>{usage ? sub.usedListings : '—'}</b>{' '}
                  <span className="text-gray-500">/ {usage ? usage.totalListings : '—'}</span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={usage ? sub.listingPct : 0} tone={usage ? sub.listingTone : 'brand'} />
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Tip: keep some quota for quick re-posts & upgrades.
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">Featured quota</div>
                  <Badge className="bg-gray-100 text-gray-700">
                    {usage ? `${usage.remainingFeatured} left` : '—'}
                  </Badge>
                </div>
                <div className="mt-2 text-sm">
                  Used: <b>{usage ? sub.usedFeatured : '—'}</b>{' '}
                  <span className="text-gray-500">/ {usage ? usage.totalFeatured : '—'}</span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={usage ? sub.featuredPct : 0} tone={usage ? sub.featuredTone : 'brand'} />
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Tip: feature your best-performing units for faster inquiries.
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border p-4">
                <div className="text-sm font-medium text-gray-800">Recent listing activity</div>
                <div className="mt-2 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activitySeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" hide />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="Listings" stroke="#004AAD" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-xs text-gray-500">
                  Shows how consistently you add listings (consistency helps visibility).
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm font-medium text-gray-800">Status breakdown</div>
                <div className="mt-2 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusBreakdown}>
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#004AAD" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-xs text-gray-500">
                  Goal: keep drafts low and published high for maximum reach.
                </div>
              </div>
            </div>

            {/* Subscription quick note */}
            <div className="rounded-xl border bg-[#004AAD]/5 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Clock className="h-4 w-4 text-[#004AAD]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">Subscription status</div>
                  <div className="text-sm text-gray-700">
                    Active packages: <b>{usage?.activeCount ?? 0}</b> · Soonest expiry:{' '}
                    <b>{fmtDate(usage?.expiresAtSoonest ?? null)}</b>
                    {typeof sub.expiresIn === 'number' ? (
                      <span className="text-gray-500"> ({sub.expiresIn} day(s))</span>
                    ) : null}
                  </div>
                </div>
                <div className="ml-auto">
                  <Link href="/dashboard/lister/billing">
                    <Button size="sm" className="bg-[#004AAD] hover:bg-[#00398a]">
                      Manage
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#004AAD]" />
              Next best actions
            </CardTitle>
            <CardDescription>Do these to get better results quickly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {nextActions.map((a, idx) => {
              const Icon = a.icon;
              const frame =
                a.tone === 'danger'
                  ? 'border-red-200 bg-red-50'
                  : a.tone === 'warn'
                  ? 'border-amber-200 bg-amber-50'
                  : a.tone === 'brand'
                  ? 'border-[#004AAD]/20 bg-[#004AAD]/5'
                  : 'border-gray-200 bg-white';

              const iconTone =
                a.tone === 'danger'
                  ? 'text-red-600'
                  : a.tone === 'warn'
                  ? 'text-amber-600'
                  : 'text-[#004AAD]';

              return (
                <Link key={idx} href={a.href} className="block">
                  <div className={`rounded-xl border p-3 hover:shadow-sm transition ${frame}`}>
                    <div className="flex items-start gap-3">
                      <Icon className={`h-4 w-4 mt-0.5 ${iconTone}`} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">{a.title}</div>
                        <div className="text-xs text-gray-700">{a.desc}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-400 ml-auto mt-0.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent listings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#004AAD]" />
              Recent listings
            </CardTitle>
            <CardDescription>Quickly continue where you left off.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/lister/list">
              <Button size="sm" className="bg-[#004AAD] hover:bg-[#00398a]">
                <Plus className="h-4 w-4 mr-2" />
                Add new
              </Button>
            </Link>
            <Link href="/dashboard/lister/list">
              <Button size="sm" variant="outline">
                View all
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p>Loading…</p>
          ) : properties.length === 0 ? (
            <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-700">
              You haven’t added any listings yet. Start by creating your first listing.
              <div className="mt-3">
                <Link href="/dashboard/lister/list">
                  <Button className="bg-[#004AAD] hover:bg-[#00398a]">
                    <Plus className="h-4 w-4 mr-2" />
                    Create listing
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recent.map((p) => (
                <div key={p.id} className="rounded-xl border p-4 hover:shadow-sm transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 line-clamp-1">{p.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusPill status={p.status} />
                        {p.featured ? (
                          <Badge className="bg-yellow-100 text-yellow-800">
                            <Star className="h-3.5 w-3.5 mr-1" />
                            Featured
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        Added: {new Date(p.createdAt).toLocaleDateString()} · Rent:{' '}
                        <b>KES {fmtMoney(p.units?.[0]?.rent)}</b>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link href="/dashboard/lister/list">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          Manage
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* micro-insight */}
                  <div className="mt-3 rounded-lg bg-gray-50 p-2 text-xs text-gray-700">
                    {p.status === 'DRAFT'
                      ? 'Draft: publish to start receiving inquiries.'
                      : p.status === 'UNPUBLISHED'
                      ? 'Unpublished: review details then re-publish.'
                      : p.featured
                      ? 'Featured: keep photos + price accurate to maximize leads.'
                      : 'Published: consider featuring if it’s a top unit.'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}