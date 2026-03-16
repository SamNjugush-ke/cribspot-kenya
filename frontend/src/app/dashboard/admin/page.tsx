"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/auth/Guard";
import { apiGet } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  BookOpen,
  Building2,
  CreditCard,
  ExternalLink,
  FilePlus2,
  LayoutDashboard,
  MessageSquare,
  RefreshCw,
  Receipt,
  Settings,
  ShieldBan,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";

type Summary = {
  users?: { total?: number; active?: number; banned?: number; roles?: Record<string, number> };
  listings?: { total?: number; featured?: number; byStatus?: Record<string, number> };
  payments?: { count?: number; totalAmountKes?: number; byStatus?: Record<string, number> };
  subscriptions?: { active?: number; expired?: number; expiringSoon?: number };
  audit?: { last24h?: number };
  messages?: { threads?: number; unread?: number };
};

type UserRow = {
  id: string;
  name?: string | null;
  email: string;
  role: string;
  isBanned?: boolean;
  createdAt?: string;
};

type ListingRow = {
  id: string;
  title: string;
  location: string;
  county?: string | null;
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  featured?: boolean;
  updatedAt?: string;
  createdAt?: string;
  images?: { url: string }[];
  lister?: { name?: string | null; email?: string | null };
};

type BlogItem = {
  id: string;
  title: string;
  published: boolean;
  updatedAt?: string;
  publishedAt?: string | null;
};

function fmtNum(v?: number) {
  if (typeof v !== "number") return "—";
  return v.toLocaleString();
}

function fmtKES(v?: number) {
  if (typeof v !== "number") return "—";
  return `KES ${v.toLocaleString()}`;
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return "—";
  }
}

function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
  href,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
}) {
  const body = (
    <Card className="border-0 shadow-sm ring-1 ring-black/5 bg-white/90 backdrop-blur">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
            <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
            {hint ? <div className="mt-1 text-sm text-muted-foreground">{hint}</div> : null}
          </div>
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!href) return body;
  return (
    <Link href={href} className="block transition hover:-translate-y-0.5">
      {body}
    </Link>
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
  const [users, setUsers] = useState<UserRow[]>([]);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [summaryRes, usersRes, listingsRes, blogsRes] = await Promise.all([
        apiGet<any>("/analytics/summary"),
        apiGet<any>("/admin/users"),
        apiGet<any>("/properties", { params: { limit: 8 } as any }),
        apiGet<any>("/api/blogs", { params: { includeUnpublished: 1, page: 1, perPage: 6, sort: "newest" } as any }),
      ]);

      setData((summaryRes.data as any) || (summaryRes.json as any) || null);

      const userItems = Array.isArray(usersRes.data)
        ? usersRes.data
        : Array.isArray((usersRes.data as any)?.items)
        ? (usersRes.data as any).items
        : [];
      setUsers(userItems);

      const listingItems = Array.isArray((listingsRes.data as any)?.items)
        ? (listingsRes.data as any).items
        : Array.isArray(listingsRes.data)
        ? (listingsRes.data as any)
        : [];
      setListings(listingItems);

      const blogItems = Array.isArray((blogsRes.data as any)?.items)
        ? (blogsRes.data as any).items
        : [];
      setBlogs(blogItems);

      if (!summaryRes.ok && !usersRes.ok && !listingsRes.ok) {
        throw new Error(summaryRes.error || usersRes.error || listingsRes.error || "Failed to load dashboard");
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load dashboard");
      setData(null);
      setUsers([]);
      setListings([]);
      setBlogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const listingByStatus = data?.listings?.byStatus || {};
  const usersByRole = data?.users?.roles || {};
  const paymentByStatus = data?.payments?.byStatus || {};

  const recentUsers = useMemo(() => users.slice(0, 5), [users]);
  const recentListings = useMemo(() => listings.slice(0, 6), [listings]);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-sky-800 text-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
              <Sparkles className="mr-2 h-3.5 w-3.5" /> Admin workspace
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="mt-2 text-sm text-slate-200">
              Read-only visibility where it matters, quick links where action is needed.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" asChild>
              <Link href="/dashboard/admin/listings">Review listings</Link>
            </Button>
            <Button variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10" onClick={load} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total listings" value={fmtNum(data?.listings?.total)} hint={`${fmtNum(data?.listings?.featured)} featured`} icon={Building2} href="/dashboard/admin/listings" />
        <MetricCard title="Managed users" value={fmtNum(data?.users?.total)} hint={`${fmtNum(data?.users?.banned)} banned`} icon={Users} href="/dashboard/admin/users" />
        <MetricCard title="Active subscriptions" value={fmtNum(data?.subscriptions?.active)} hint={`${fmtNum(data?.subscriptions?.expiringSoon)} expiring soon`} icon={Receipt} href="/dashboard/admin/subscriptions" />
        <MetricCard title="Payments total" value={fmtKES(data?.payments?.totalAmountKes)} hint={`${fmtNum(data?.payments?.count)} payments logged`} icon={CreditCard} href="/dashboard/admin/payments" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Quick actions</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Jump straight into the pages admins use most.</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                { href: "/dashboard/admin/listings", label: "Listings", icon: Building2, desc: "Edit, delete, feature, preview" },
                { href: "/dashboard/admin/users", label: "Users", icon: ShieldBan, desc: "Ban and review non-admin accounts" },
                { href: "/dashboard/admin/subscriptions", label: "Subscriptions", icon: Receipt, desc: "Remaining quotas and exports" },
                { href: "/dashboard/admin/blogs", label: "All blog posts", icon: BookOpen, desc: "Drafts, published posts and more" },
                { href: "/dashboard/admin/blog-editor", label: "Write a blog post", icon: FilePlus2, desc: "Reuse the full editor experience" },
                { href: "/dashboard/admin/reports", label: "Reports & exports", icon: BarChart3, desc: "CSV/JSON exports for ops" },
                { href: "/dashboard/admin/categories", label: "Categories", icon: Tags, desc: "Manage blog taxonomy" },
                { href: "/dashboard/admin/settings", label: "Settings", icon: Settings, desc: "Review system-level settings" },
                { href: "/dashboard/messages", label: "Messages", icon: MessageSquare, desc: "Inbox, broadcasts and support" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="group rounded-2xl border bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-xl bg-slate-100 p-3 text-slate-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-slate-700" />
                    </div>
                    <div className="mt-4 font-semibold text-slate-900">{item.label}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{item.desc}</div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader>
            <CardTitle>Live snapshot</CardTitle>
            <p className="text-sm text-muted-foreground">Tiny but useful numbers.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span>Published listings</span><Badge variant="secondary">{fmtNum(listingByStatus.PUBLISHED)}</Badge></div>
            <div className="flex items-center justify-between"><span>Draft listings</span><Badge variant="secondary">{fmtNum(listingByStatus.DRAFT)}</Badge></div>
            <div className="flex items-center justify-between"><span>Unpublished listings</span><Badge variant="secondary">{fmtNum(listingByStatus.UNPUBLISHED)}</Badge></div>
            <div className="flex items-center justify-between"><span>Listers</span><Badge variant="outline">{fmtNum(usersByRole.LISTER)}</Badge></div>
            <div className="flex items-center justify-between"><span>Renters</span><Badge variant="outline">{fmtNum(usersByRole.RENTER)}</Badge></div>
            <div className="flex items-center justify-between"><span>Editors</span><Badge variant="outline">{fmtNum(usersByRole.EDITOR)}</Badge></div>
            <div className="flex items-center justify-between"><span>Successful payments</span><Badge variant="outline">{fmtNum(paymentByStatus.SUCCESS)}</Badge></div>
            <div className="flex items-center justify-between"><span>Audit events, last 24h</span><Badge variant="outline">{fmtNum(data?.audit?.last24h)}</Badge></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 border-0 shadow-sm ring-1 ring-black/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent listings</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">A visual pulse-check of the latest property activity.</p>
            </div>
            <Button variant="outline" asChild><Link href="/dashboard/admin/listings">Open listings</Link></Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recentListings.length ? recentListings.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-2xl border bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.images?.[0]?.url || "/placeholder.jpg"} alt={item.title} className="h-36 w-full object-cover bg-slate-100" />
                  <div className="p-4">
                    <div className="line-clamp-1 font-semibold">{item.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground line-clamp-1">{item.location}{item.county ? `, ${item.county}` : ""}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary">{item.status}</Badge>
                      {item.featured ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Featured</Badge> : null}
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">Updated {fmtDate(item.updatedAt || item.createdAt)}</div>
                  </div>
                </div>
              )) : <div className="col-span-full rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No recent listings available.</div>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm ring-1 ring-black/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Newest users</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Only non-admin accounts are shown here.</p>
              </div>
              <Button variant="outline" asChild><Link href="/dashboard/admin/users">Open users</Link></Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentUsers.length ? recentUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-2xl border p-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{user.name || "Unnamed user"}</div>
                    <div className="truncate text-sm text-muted-foreground">{user.email}</div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{user.role}</Badge>
                    <div className="mt-1 text-xs text-muted-foreground">{fmtDate(user.createdAt)}</div>
                  </div>
                </div>
              )) : <div className="text-sm text-muted-foreground">No recent users available.</div>}
            </CardContent>
          </Card>

          
        </div>
      </div>

      {err ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div> : null}
    </section>
  );
}
