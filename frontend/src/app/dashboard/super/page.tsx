// frontend/src/app/dashboard/super/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import RequirePermission from "@/components/super/RequirePermission";
import { adminFetch } from "@/lib/adminFetch";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

import {
  ArrowRight,
  BarChart3,
  Building2,
  FileDown,
  Flag,
  HandCoins,
  LayoutGrid,
  ListChecks,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Users,
  Bell,
  MessagesSquare,
  CreditCard,
  Package,
  Activity,
} from "lucide-react";

type ListingStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";

type Summary = {
  users?: {
    total: number;
    active: number;
    banned: number;
    roles?: Record<string, number>;
  };
  listings?: {
    total: number;
    byStatus: Record<ListingStatus, number>;
    featured: number;
  };
  payments?: {
    totalAmountKes: number;
    count: number;
    byStatus?: Record<string, number>;
  };
  subscriptions?: {
    active: number;
    expired: number;
    expiringSoon?: number; // optional
  };
  audit?: {
    last24h: number;
  };
  messages?: {
    threads?: number;
    unread?: number;
  };
};

type PropertyLite = {
  id: string;
  title: string;
  location: string | null;
  county: string | null;
  status: ListingStatus;
  featured: boolean;
  createdAt: string;
  lister?: { email: string; phone?: string | null; name?: string | null };
};

type UserLite = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isBanned: boolean;
  createdAt: string;
};

function fmtNum(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function fmtKes(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `KES ${Math.round(n).toLocaleString()}`;
}

function daysUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function StatCard({
  title,
  value,
  sub,
  icon,
  accent = "blue",
  href,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: "blue" | "sky" | "red" | "black";
  href?: string;
}) {
  const ring =
    accent === "blue"
      ? "ring-brand-blue/20"
      : accent === "sky"
      ? "ring-brand-sky/20"
      : accent === "red"
      ? "ring-brand-red/20"
      : "ring-brand-black/10";

  const iconBg =
    accent === "blue"
      ? "bg-brand-blue/10"
      : accent === "sky"
      ? "bg-brand-sky/10"
      : accent === "red"
      ? "bg-brand-red/10"
      : "bg-brand-black/5";

  const body = (
    <Card className={`shadow-soft rounded-xl2 border border-border ring-1 ${ring} hover:translate-y-[-1px] transition`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-brand-black/70">{title}</div>
            <div className="text-2xl font-bold text-brand-black mt-1">{value}</div>
            {sub ? <div className="text-xs text-brand-black/60 mt-1">{sub}</div> : null}
          </div>
          <div className={`h-10 w-10 rounded-xl2 ${iconBg} flex items-center justify-center`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

function QuickLink({
  href,
  title,
  desc,
  icon,
  badge,
}: {
  href: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="shadow-soft rounded-xl2 border border-border hover:translate-y-[-1px] transition">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl2 bg-brand-gray flex items-center justify-center">{icon}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="font-semibold text-brand-black truncate">{title}</div>
                {badge ? <Badge className="bg-brand-blue text-white rounded-full">{badge}</Badge> : null}
              </div>
              <div className="text-sm text-brand-black/60 mt-1">{desc}</div>
            </div>
            <ArrowRight className="h-5 w-5 text-brand-black/40 mt-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function MiniBars({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number; pill?: "blue" | "gray" | "red" | "yellow" }[];
}) {
  const max = Math.max(1, ...items.map((x) => x.value));
  return (
    <Card className="rounded-xl2 border border-border shadow-soft">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-brand-black">{title}</div>
          <BarChart3 className="h-5 w-5 text-brand-black/50" />
        </div>

        <div className="mt-3 space-y-2">
          {items.map((x) => {
            const w = Math.round((x.value / max) * 100);
            const pill =
              x.pill === "blue"
                ? "bg-brand-blue text-white"
                : x.pill === "red"
                ? "bg-brand-red text-white"
                : x.pill === "yellow"
                ? "bg-yellow-500 text-white"
                : "bg-brand-gray text-brand-black";
            return (
              <div key={x.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-brand-black/70">
                  <span className="truncate">{x.label}</span>
                  <Badge className={`${pill} rounded-full`}>{fmtNum(x.value)}</Badge>
                </div>
                <div className="h-2 rounded-full bg-brand-gray overflow-hidden">
                  <div className="h-2 bg-brand-blue" style={{ width: `${clamp(w, 2, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuperOverviewPage() {
  return (
    <RequirePermission anyOf={["VIEW_ANALYTICS"]}>
      <SuperOverviewInner />
    </RequirePermission>
  );
}

function SuperOverviewInner() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);

  // fallbacks / preview panels
  const [listings, setListings] = useState<PropertyLite[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);

  // UI
  const [tab, setTab] = useState<"highlights" | "ops" | "insights">("highlights");
  const [search, setSearch] = useState("");
  const [statusChip, setStatusChip] = useState<"ALL" | ListingStatus>("ALL");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      setLoading(true);

      // 1) optional analytics summary
      let s: Summary | null = null;
      try {
        s = await adminFetch<Summary>("/api/analytics/summary");
      } catch {
        s = null;
      }

      // 2) listings (admin=1)
      const propsResp = await adminFetch<any>("/api/properties?admin=1");
      const props: PropertyLite[] = Array.isArray(propsResp) ? propsResp : propsResp?.items || [];
      setListings(Array.isArray(props) ? props : []);

      // 3) users (admin)
      let u: UserLite[] = [];
      try {
        const usersResp = await adminFetch<any>("/api/admin/users");
        u = Array.isArray(usersResp) ? usersResp : usersResp?.items || [];
      } catch {
        u = [];
      }
      setUsers(Array.isArray(u) ? u : []);

      // If analytics missing, compute a solid summary
      if (!s) {
        const byStatus: Record<ListingStatus, number> = {
          DRAFT: 0,
          PUBLISHED: 0,
          UNPUBLISHED: 0,
          ARCHIVED: 0,
        };
        let featured = 0;
        for (const p of props) {
          byStatus[p.status] = (byStatus[p.status] || 0) + 1;
          if (p.featured) featured += 1;
        }

        const totalUsers = u.length;
        const banned = u.filter((x) => x.isBanned).length;
        const active = totalUsers - banned;

        const roles: Record<string, number> = {};
        for (const x of u) roles[x.role] = (roles[x.role] || 0) + 1;

        s = {
          users: { total: totalUsers, active, banned, roles },
          listings: { total: props.length, byStatus, featured },
          payments: { totalAmountKes: 0, count: 0 },
          subscriptions: { active: 0, expired: 0 },
          audit: { last24h: 0 },
          messages: { threads: 0, unread: 0 },
        };
      }

      setSummary(s);
    } finally {
      setLoading(false);
    }
  }

  const derived = useMemo(() => {
    const s = summary;

    const recentListings = [...listings]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);

    const needle = search.trim().toLowerCase();
    let filtered = listings;

    if (needle) {
      filtered = filtered.filter((p) => {
        const t = `${p.title} ${p.location ?? ""} ${p.county ?? ""} ${p.lister?.email ?? ""}`.toLowerCase();
        return t.includes(needle);
      });
    }
    if (statusChip !== "ALL") filtered = filtered.filter((p) => p.status === statusChip);

    const needsAttention = listings.filter((p) => p.status !== "PUBLISHED").length;
    const drafts = listings.filter((p) => p.status === "DRAFT").length;
    const unpublished = listings.filter((p) => p.status === "UNPUBLISHED").length;
    const archived = listings.filter((p) => p.status === "ARCHIVED").length;

    const topCounties = (() => {
      const m = new Map<string, number>();
      for (const p of listings) {
        const c = p.county ?? "Unknown";
        m.set(c, (m.get(c) || 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    })();

    const rolesTop = (() => {
      const r = s?.users?.roles || {};
      return Object.entries(r).sort((a, b) => (b[1] || 0) - (a[1] || 0)).slice(0, 8);
    })();

    return {
      s,
      recentListings,
      filteredPreview: filtered.slice(0, 10),
      needsAttention,
      drafts,
      unpublished,
      archived,
      topCounties,
      rolesTop,
    };
  }, [summary, listings, search, statusChip]);

  const s = derived.s;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-brand-blue" />
            <h1 className="text-2xl font-bold text-brand-black">Super Admin Overview</h1>
          </div>
          <p className="text-sm text-brand-black/60 mt-1">
            A control tower for Rentals Kenya — snapshots, quick actions, and what needs attention.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Link href="/dashboard/super/reports">
            <Button className="bg-brand-blue text-white hover:bg-brand-sky">
              <FileDown className="h-4 w-4" />
              Reports
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Users"
          value={loading ? "—" : fmtNum(s?.users?.total || 0)}
          sub={loading ? "" : `${fmtNum(s?.users?.active || 0)} active • ${fmtNum(s?.users?.banned || 0)} banned`}
          icon={<Users className="h-5 w-5 text-brand-blue" />}
          accent="blue"
          href="/dashboard/super/users"
        />

        <StatCard
          title="Listings"
          value={loading ? "—" : fmtNum(s?.listings?.total || 0)}
          sub={
            loading
              ? ""
              : `${fmtNum(s?.listings?.byStatus?.PUBLISHED || 0)} published • ${fmtNum(s?.listings?.featured || 0)} featured`
          }
          icon={<Building2 className="h-5 w-5 text-brand-blue" />}
          accent="blue"
          href="/dashboard/super/listings"
        />

        <StatCard
          title="Needs attention"
          value={loading ? "—" : fmtNum(derived.needsAttention)}
          sub={loading ? "" : `${fmtNum(derived.drafts)} drafts • ${fmtNum(derived.unpublished)} unpublished`}
          icon={<Flag className="h-5 w-5 text-brand-red" />}
          accent="red"
          href="/dashboard/super/listings"
        />

        <StatCard
          title="Revenue"
          value={loading ? "—" : fmtKes(s?.payments?.totalAmountKes || 0)}
          sub={loading ? "" : `${fmtNum(s?.payments?.count || 0)} payments`}
          icon={<HandCoins className="h-5 w-5 text-brand-sky" />}
          accent="sky"
          href="/dashboard/super/payments"
        />

        <StatCard
          title="Subscriptions"
          value={loading ? "—" : fmtNum(s?.subscriptions?.active || 0)}
          sub={loading ? "" : `${fmtNum(s?.subscriptions?.expired || 0)} expired`}
          icon={<Package className="h-5 w-5 text-brand-black" />}
          accent="black"
          href="/dashboard/super/subscriptions"
        />

        <StatCard
          title="Audit (24h)"
          value={loading ? "—" : fmtNum(s?.audit?.last24h || 0)}
          sub={loading ? "" : "admin actions logged"}
          icon={<ListChecks className="h-5 w-5 text-brand-black" />}
          accent="black"
          href="/dashboard/super/audit"
        />
      </div>

      {/* Quick actions row */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <QuickLink
          href="/dashboard/super/listings"
          title="Moderate listings"
          desc="Review drafts/unpublished, feature, archive, and edit details."
          icon={<Building2 className="h-5 w-5 text-brand-blue" />}
          badge="Listings"
        />
        <QuickLink
          href="/dashboard/super/users"
          title="Manage users"
          desc="Roles, ban/unban, and super tools."
          icon={<Users className="h-5 w-5 text-brand-blue" />}
          badge="Users"
        />
        <QuickLink
          href="/dashboard/super/payments"
          title="Payments"
          desc="Track transactions and reconcile subscription activations."
          icon={<CreditCard className="h-5 w-5 text-brand-blue" />}
          badge="Money"
        />
        <QuickLink
          href="/dashboard/super/audit"
          title="Audit log"
          desc="Filter admin events and export for compliance."
          icon={<ShieldCheck className="h-5 w-5 text-brand-blue" />}
          badge="Logs"
        />
      </div>

      {/* Panels */}
      <Card className="shadow-soft rounded-xl2 border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-brand-black">Dashboard panels</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-3 w-full bg-brand-gray rounded-xl2 p-1">
              <TabsTrigger
                value="highlights"
                className="rounded-lg data-[state=active]:bg-brand-blue data-[state=active]:text-white"
              >
                Highlights
              </TabsTrigger>
              <TabsTrigger
                value="ops"
                className="rounded-lg data-[state=active]:bg-brand-blue data-[state=active]:text-white"
              >
                Ops
              </TabsTrigger>
              <TabsTrigger
                value="insights"
                className="rounded-lg data-[state=active]:bg-brand-blue data-[state=active]:text-white"
              >
                Insights
              </TabsTrigger>
            </TabsList>

            {/* Highlights */}
            <TabsContent value="highlights" className="mt-4 space-y-4">
              <div className="grid gap-3 lg:grid-cols-3">
                <MiniBars
                  title="Listings by status"
                  items={[
                    { label: "Published", value: s?.listings?.byStatus?.PUBLISHED || 0, pill: "blue" },
                    { label: "Unpublished", value: s?.listings?.byStatus?.UNPUBLISHED || 0, pill: "gray" },
                    { label: "Draft", value: s?.listings?.byStatus?.DRAFT || 0, pill: "yellow" },
                    { label: "Archived", value: s?.listings?.byStatus?.ARCHIVED || 0, pill: "red" },
                  ]}
                />

                <Card className="rounded-xl2 border border-border shadow-soft">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-brand-black">Top counties</div>
                      <Building2 className="h-5 w-5 text-brand-black/50" />
                    </div>
                    <div className="mt-3 space-y-2">
                      {derived.topCounties.map(([c, n]) => (
                        <div key={c} className="flex items-center justify-between text-sm">
                          <span className="text-brand-black/80 truncate">{c}</span>
                          <Badge className="bg-brand-gray text-brand-black rounded-full">{fmtNum(n)}</Badge>
                        </div>
                      ))}
                      {!derived.topCounties.length && (
                        <div className="text-sm text-brand-black/60">No data yet.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-xl2 border border-border shadow-soft">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-brand-black">Quick signals</div>
                      <Activity className="h-5 w-5 text-brand-black/50" />
                    </div>

                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-brand-black/70">
                          <Star className="h-4 w-4 text-yellow-500" />
                          Featured listings
                        </div>
                        <Badge className="bg-yellow-500 text-white rounded-full">{fmtNum(s?.listings?.featured || 0)}</Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-brand-black/70">
                          <MessagesSquare className="h-4 w-4 text-brand-blue" />
                          Unread (optional)
                        </div>
                        <Badge className="bg-brand-gray text-brand-black rounded-full">
                          {fmtNum(s?.messages?.unread || 0)}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-brand-black/70">
                          <Bell className="h-4 w-4 text-brand-blue" />
                          Expiring soon (optional)
                        </div>
                        <Badge className="bg-brand-gray text-brand-black rounded-full">
                          {fmtNum(s?.subscriptions?.expiringSoon || 0)}
                        </Badge>
                      </div>

                      <Link href="/dashboard/super/reports">
                        <Button className="w-full bg-brand-blue text-white hover:bg-brand-sky">
                          Open Reports Hub
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center justify-between">
                <div className="font-semibold text-brand-black">Recent listings</div>
                <Link href="/dashboard/super/listings">
                  <Button
                    variant="outline"
                    className="border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white"
                  >
                    Open listings
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="rounded-xl2 border border-border overflow-hidden bg-brand-white shadow-soft">
                <div className="grid grid-cols-12 bg-brand-gray px-4 py-2 text-xs font-semibold text-brand-black">
                  <div className="col-span-5">Title</div>
                  <div className="col-span-3">Location</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2 text-right">Created</div>
                </div>

                <div className="divide-y">
                  {derived.recentListings.map((p) => (
                    <div
                      key={p.id}
                      className="grid grid-cols-12 px-4 py-3 text-sm hover:bg-brand-gray/60 transition"
                    >
                      <div className="col-span-5 truncate text-brand-black font-medium">{p.title}</div>
                      <div className="col-span-3 truncate text-brand-black/70">
                        {(p.location ?? "—") + (p.county ? ` • ${p.county}` : "")}
                      </div>
                      <div className="col-span-2">
                        <Badge
                          className={
                            p.status === "PUBLISHED"
                              ? "bg-brand-blue text-white rounded-full"
                              : p.status === "ARCHIVED"
                              ? "bg-brand-red text-white rounded-full"
                              : p.status === "DRAFT"
                              ? "bg-yellow-500 text-white rounded-full"
                              : "bg-brand-gray text-brand-black rounded-full"
                          }
                        >
                          {p.status}
                        </Badge>
                      </div>
                      <div className="col-span-2 text-right text-brand-black/60">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}

                  {!derived.recentListings.length && (
                    <div className="px-4 py-8 text-center text-brand-black/60">No listings yet.</div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Ops */}
            <TabsContent value="ops" className="mt-4 space-y-4">
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <div className="relative w-full md:w-1/2">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Quick search listings (title / county / lister email)…"
                    className="pl-10 focus:ring-2 focus:ring-brand-sky focus:border-brand-blue"
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-brand-black/40" />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`text-xs px-3 py-1 rounded-full border transition ${
                      statusChip === "ALL" ? "bg-brand-blue text-white" : "bg-brand-gray text-brand-black hover:bg-brand-gray/70"
                    }`}
                    onClick={() => setStatusChip("ALL")}
                  >
                    ALL
                  </button>
                  {(["PUBLISHED", "UNPUBLISHED", "DRAFT", "ARCHIVED"] as ListingStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`text-xs px-3 py-1 rounded-full border transition ${
                        statusChip === st ? "bg-brand-blue text-white" : "bg-brand-gray text-brand-black hover:bg-brand-gray/70"
                      }`}
                      onClick={() => setStatusChip(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <Card className="rounded-xl2 border border-border shadow-soft">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-brand-black">Listings preview</div>
                      <Link href="/dashboard/super/listings">
                        <Button className="bg-brand-blue text-white hover:bg-brand-sky" size="sm">
                          Open manager
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                    <div className="mt-3 space-y-2">
                      {derived.filteredPreview.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <div className="truncate text-brand-black font-medium">{p.title}</div>
                            <div className="truncate text-brand-black/60 text-xs">
                              {(p.location ?? "—") + (p.county ? ` • ${p.county}` : "")}
                              {p.lister?.email ? ` • ${p.lister.email}` : ""}
                            </div>
                          </div>
                          <Badge
                            className={
                              p.status === "PUBLISHED"
                                ? "bg-brand-blue text-white rounded-full"
                                : p.status === "ARCHIVED"
                                ? "bg-brand-red text-white rounded-full"
                                : p.status === "DRAFT"
                                ? "bg-yellow-500 text-white rounded-full"
                                : "bg-brand-gray text-brand-black rounded-full"
                            }
                          >
                            {p.status}
                          </Badge>
                        </div>
                      ))}
                      {!derived.filteredPreview.length && (
                        <div className="text-sm text-brand-black/60">Nothing matches your filters.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-xl2 border border-border shadow-soft">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-brand-black">Suggested next actions</div>
                      <ListChecks className="h-5 w-5 text-brand-black/50" />
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-brand-black/70">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5">•</span>
                        <div>
                          Prioritize <b>Draft</b> → <b>Unpublished</b> (QA) → <b>Published</b> (live).
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5">•</span>
                        <div>
                          Keep <b>Archived</b> as “do not show” storage; restore only after verification.
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5">•</span>
                        <div>
                          Use <b>Reports</b> for exports (CSV/JSON) with filters first.
                        </div>
                      </div>

                      <div className="pt-2 grid gap-2 md:grid-cols-2">
                        <Link href="/dashboard/super/access">
                          <Button
                            variant="outline"
                            className="w-full border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white"
                            size="sm"
                          >
                            RBAC & Access
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>

                        <Link href="/dashboard/super/settings">
                          <Button className="w-full bg-brand-blue text-white hover:bg-brand-sky" size="sm">
                            Settings
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Insights */}
            <TabsContent value="insights" className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <MiniBars
                  title="Users by role"
                  items={derived.rolesTop.map(([role, count]) => ({
                    label: role,
                    value: Number(count) || 0,
                    pill: role.includes("SUPER") ? "red" : "gray",
                  }))}
                />

                <Card className="rounded-xl2 border border-border shadow-soft">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-brand-black">Security & access</div>
                      <ShieldCheck className="h-5 w-5 text-brand-blue" />
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-brand-black/70">
                      <div className="flex items-center justify-between">
                        <span>Overview requires</span>
                        <Badge className="bg-brand-gray text-brand-black rounded-full">VIEW_ANALYTICS</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Reports requires</span>
                        <Badge className="bg-brand-gray text-brand-black rounded-full">EXPORT_DATA</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Audit requires</span>
                        <Badge className="bg-brand-gray text-brand-black rounded-full">VIEW_SYSTEM_LOGS</Badge>
                      </div>

                      <div className="pt-2">
                        <Link href="/dashboard/super/access">
                          <Button
                            variant="outline"
                            className="w-full border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white"
                          >
                            Verify permissions
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-xl2 border border-border shadow-soft">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-brand-black">Data readiness</div>
                      <Badge className="bg-brand-blue text-white rounded-full">Best-effort</Badge>
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-brand-black/70">
                      <div className="flex items-center justify-between">
                        <span>Listings loaded</span>
                        <Badge className="bg-brand-gray text-brand-black rounded-full">{listings.length ? "OK" : "—"}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Users loaded</span>
                        <Badge className="bg-brand-gray text-brand-black rounded-full">{users.length ? "OK" : "—"}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Analytics summary</span>
                        <Badge className="bg-brand-gray text-brand-black rounded-full">
                          {summary ? "Optional" : "Not wired"}
                        </Badge>
                      </div>

                      <div className="pt-2 text-xs text-brand-black/60">
                        This page stays useful even while backend analytics evolves (so the dashboard doesn’t turn into a
                        motivational quote generator).
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <QuickLink
                  href="/dashboard/messages"
                  title="Messages hub"
                  desc="Inbox, conversations, and support threads."
                  icon={<MessagesSquare className="h-5 w-5 text-brand-blue" />}
                  badge="Comms"
                />
                <QuickLink
                  href="/dashboard/messages/broadcasts"
                  title="Broadcasts"
                  desc="Announcements, notifications, and campaigns."
                  icon={<Bell className="h-5 w-5 text-brand-blue" />}
                  badge="Notify"
                />
                <QuickLink
                  href="/dashboard/super/plans"
                  title="Plans"
                  desc="Subscription plan catalog and toggles."
                  icon={<Package className="h-5 w-5 text-brand-blue" />}
                  badge="Plans"
                />
                <QuickLink
                  href="/dashboard/super/payments"
                  title="Payments overview"
                  desc="Track transactions and statuses."
                  icon={<HandCoins className="h-5 w-5 text-brand-blue" />}
                  badge="KES"
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Footer hint */}
      <div className="text-xs text-brand-black/50">
        Tip: clicking on cards and links takes you to respective reports for more information.
      </div>
    </section>
  );
}