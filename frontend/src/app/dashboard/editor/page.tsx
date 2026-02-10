// frontend/src/app/dashboard/editor/page.tsx
'use client';

import Guard from '@/components/auth/Guard';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPut } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Plus,
  FileText,
  MessageSquareWarning,
  Image as ImageIcon,
  Eye,
  Pencil,
  RefreshCw,
  CheckCircle2,
  CircleDashed,
  ArrowRight,
  Sparkles,
  BadgeCheck,
  TriangleAlert,
  Search,
  Clock,
  ListChecks,
  Settings2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

type Role = 'RENTER' | 'LISTER' | 'EDITOR' | 'ADMIN' | 'SUPER_ADMIN' | 'AGENT';
type Me = { id: string; name?: string | null; role: Role };

type BlogListItem = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImage?: string | null;
  published: boolean;
  publishedAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  authorUser?: { id: string; name: string | null };
  seoTitle?: string | null;
  seoDesc?: string | null;
  seoKeywords?: string | null;
  ogImage?: string | null;
};

type BlogListResponse = {
  items: BlogListItem[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
};

type CommentListItem = {
  id: string;
  content: string;
  isApproved: boolean;
  hiddenAt?: string | null;
  createdAt: string;
  user?: { id: string; name?: string | null; email?: string | null };
  blog?: { id: string; title: string };
};

type CommentListResponse = {
  items: CommentListItem[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
};

const BRAND = '#004AAD';

function fmtDate(d?: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '—';
  }
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function Bar({
  value,
  label,
  tone = 'brand',
}: {
  value: number;
  label?: string;
  tone?: 'brand' | 'green' | 'amber' | 'red';
}) {
  const pct = clampPct(value);
  const color =
    tone === 'green'
      ? 'bg-green-600'
      : tone === 'amber'
      ? 'bg-amber-600'
      : tone === 'red'
      ? 'bg-red-600'
      : `bg-[${BRAND}]`;

  // Tailwind doesn't parse dynamic bracket color reliably for classes; use inline style for brand.
  const style =
    tone === 'brand' ? { width: `${pct}%`, backgroundColor: BRAND } : { width: `${pct}%` };

  return (
    <div className="w-full">
      {label ? <div className="mb-1 text-xs text-gray-600">{label}</div> : null}
      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-2 rounded-full ${tone === 'brand' ? '' : color}`} style={style} />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  hint,
  actionHref,
  actionLabel,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  hint?: React.ReactNode;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">{title}</div>
        <div className="text-gray-500">{icon}</div>
      </div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{value}</div>
      {hint ? <div className="mt-2 text-xs text-gray-600">{hint}</div> : null}
      {actionHref && actionLabel ? (
        <div className="mt-3">
          <Link
            href={actionHref}
            className="text-sm text-[var(--brand)] hover:underline inline-flex items-center gap-1"
            style={{ color: BRAND }}
          >
            {actionLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Pill({
  children,
  tone = 'gray',
}: {
  children: React.ReactNode;
  tone?: 'gray' | 'green' | 'amber' | 'red' | 'blue';
}) {
  const cls =
    tone === 'green'
      ? 'bg-green-50 text-green-700 border-green-200'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : tone === 'red'
      ? 'bg-red-50 text-red-700 border-red-200'
      : tone === 'blue'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-gray-50 text-gray-700 border-gray-200';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${cls}`}>
      {children}
    </span>
  );
}

function seoOk(b: BlogListItem) {
  const okTitle = !!(b.seoTitle && b.seoTitle.trim().length >= 5);
  const okDesc = !!(b.seoDesc && b.seoDesc.trim().length >= 30);
  return okTitle && okDesc;
}

async function fetchBlogCount(params: Record<string, string>) {
  const res = await apiGet<BlogListResponse>('/api/blogs', {
    params: { perPage: '1', page: '1', sort: 'newest', ...params },
  } as any);
  const total = res.json?.pagination?.total;
  return typeof total === 'number' ? total : 0;
}

async function fetchCommentCount(params: Record<string, string>) {
  const res = await apiGet<CommentListResponse>('/api/blogs/comments', {
    params: { perPage: '1', page: '1', ...params },
  } as any);
  const total = res.json?.pagination?.total;
  return typeof total === 'number' ? total : 0;
}

export default function EditorHome() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // counts
  const [postsTotal, setPostsTotal] = useState(0);
  const [publishedCount, setPublishedCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);

  const [pendingComments, setPendingComments] = useState(0);
  const [approvedComments, setApprovedComments] = useState(0);
  const [hiddenComments, setHiddenComments] = useState(0);

  // lists
  const [recent, setRecent] = useState<BlogListItem[]>([]);
  const [pendingList, setPendingList] = useState<CommentListItem[]>([]);

  // attention metrics (computed from recent sample)
  const [missingSeoCount, setMissingSeoCount] = useState(0);
  const [missingCoverCount, setMissingCoverCount] = useState(0);
  const [draftsNeedingWork, setDraftsNeedingWork] = useState<BlogListItem[]>([]);
  const [seoFixList, setSeoFixList] = useState<BlogListItem[]>([]);

  // quick find
  const [quickFind, setQuickFind] = useState('');

  const publishRate = useMemo(() => {
    const denom = Math.max(1, postsTotal);
    return (publishedCount / denom) * 100;
  }, [publishedCount, postsTotal]);

  const draftRate = useMemo(() => {
    const denom = Math.max(1, postsTotal);
    return (draftCount / denom) * 100;
  }, [draftCount, postsTotal]);

  const filteredRecent = useMemo(() => {
    const q = quickFind.trim().toLowerCase();
    if (!q) return recent;
    return recent.filter((b) => (b.title || '').toLowerCase().includes(q) || (b.slug || '').toLowerCase().includes(q));
  }, [recent, quickFind]);

  const canPublish = useMemo(() => {
    const r = (me?.role || '').toUpperCase();
    return r === 'EDITOR' || r === 'ADMIN' || r === 'SUPER_ADMIN';
  }, [me]);

  const togglePublish = async (b: BlogListItem) => {
    if (!canPublish) return;
    try {
      const res = await apiPut(`/api/blogs/${b.id}`, { published: !b.published });
      if (!res.ok) throw new Error('Failed');
      toast.success(b.published ? 'Moved to draft' : 'Published');
      await load();
    } catch {
      toast.error('Could not update publish status');
    }
  };

  const load = async () => {
    setLoading(true);
    setErr(null);

    try {
      const meRes = await apiGet<Me>('/api/auth/me');
      if (!meRes.json) throw new Error('Failed to load profile');
      setMe(meRes.json);

      const includeUnpublished = '1';

      const [
        total,
        published,
        draft,
        cPending,
        cApproved,
        cHidden,
        recentRes,
        pendingRes,
      ] = await Promise.all([
        fetchBlogCount({ includeUnpublished, status: 'all' }),
        fetchBlogCount({ includeUnpublished, status: 'published' }),
        fetchBlogCount({ includeUnpublished, status: 'draft' }),
        fetchCommentCount({ status: 'pending' }),
        fetchCommentCount({ status: 'approved' }),
        fetchCommentCount({ status: 'hidden' }),
        apiGet<BlogListResponse>('/api/blogs', {
          params: {
            includeUnpublished,
            perPage: '20',
            page: '1',
            sort: 'newest',
            status: 'all',
          },
        } as any),
        apiGet<CommentListResponse>('/api/blogs/comments', {
          params: { status: 'pending', perPage: '6', page: '1' },
        } as any),
      ]);

      const rec = Array.isArray(recentRes.json?.items) ? recentRes.json!.items : [];
      const pend = Array.isArray(pendingRes.json?.items) ? pendingRes.json!.items : [];

      setPostsTotal(total);
      setPublishedCount(published);
      setDraftCount(draft);

      setPendingComments(cPending);
      setApprovedComments(cApproved);
      setHiddenComments(cHidden);

      setRecent(rec);
      setPendingList(pend);

      // “Attention” computations based on recent sample (good enough for dashboard)
      const missingSeo = rec.filter((b) => !seoOk(b)).length;
      const missingCover = rec.filter((b) => !b.coverImage).length;

      setMissingSeoCount(missingSeo);
      setMissingCoverCount(missingCover);

      // Top drafts to continue writing: newest drafts first
      const drafts = rec.filter((b) => !b.published).slice(0, 5);
      setDraftsNeedingWork(drafts);

      // Top SEO fixes: prioritize published posts missing SEO, then drafts missing SEO
      const seoFix = [
        ...rec.filter((b) => b.published && !seoOk(b)),
        ...rec.filter((b) => !b.published && !seoOk(b)),
      ].slice(0, 6);
      setSeoFixList(seoFix);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Guard allowed={['EDITOR', 'ADMIN', 'SUPER_ADMIN'] as any}>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${BRAND}15` }}
                >
                  <Sparkles className="h-5 w-5" style={{ color: BRAND }} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Editor Overview</h1>
                  <p className="text-sm text-gray-600">
                    Blogs, moderation, SEO hygiene — and quick actions.
                  </p>
                </div>
              </div>

              {me ? (
                <div className="mt-2 text-xs text-gray-500">
                  Signed in as{' '}
                  <span className="font-medium text-gray-700">
                    {me.name || me.id}
                  </span>{' '}
                  ({me.role})
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/editor/blog-editor">
                <Button className="text-white" style={{ backgroundColor: BRAND }}>
                  <Plus className="h-4 w-4 mr-2" /> New post
                </Button>
              </Link>

              <Link href="/dashboard/editor/blogs">
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" /> Manage posts
                </Button>
              </Link>

              <Link href="/dashboard/editor/comments">
                <Button variant="outline">
                  <MessageSquareWarning className="h-4 w-4 mr-2" /> Comments
                </Button>
              </Link>

              <Link href="/dashboard/editor/media">
                <Button variant="outline">
                  <ImageIcon className="h-4 w-4 mr-2" /> Media
                </Button>
              </Link>

              <Button variant="outline" onClick={load} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Quick search */}
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
              <Input
                value={quickFind}
                onChange={(e) => setQuickFind(e.target.value)}
                placeholder="Quick find a recent post by title/slug…"
                className="pl-9"
              />
            </div>

            <div className="rounded-xl border bg-gray-50 px-4 py-3 text-sm text-gray-700 flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <BadgeCheck className="h-4 w-4" style={{ color: BRAND }} />
                Publish rate
              </span>
              <span className="font-semibold">{loading ? '—' : `${Math.round(publishRate)}%`}</span>
            </div>
          </div>
        </div>

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        {/* KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Total posts"
            value={loading ? '—' : postsTotal}
            icon={<FileText className="h-4 w-4" />}
            hint={
              <div className="mt-2 space-y-2">
                <Bar value={publishRate} label={`Published: ${publishedCount}`} tone="green" />
                <Bar value={draftRate} label={`Drafts: ${draftCount}`} tone="amber" />
              </div>
            }
            actionHref="/dashboard/editor/blogs"
            actionLabel="Open posts table"
          />

          <StatCard
            title="Pending comments"
            value={loading ? '—' : pendingComments}
            icon={<MessageSquareWarning className="h-4 w-4" />}
            hint={
              <>
                Approved: <span className="font-medium text-gray-800">{approvedComments}</span> • Hidden:{' '}
                <span className="font-medium text-gray-800">{hiddenComments}</span>
              </>
            }
            actionHref="/dashboard/editor/comments"
            actionLabel="Moderate comments"
          />

          <StatCard
            title="SEO needs attention"
            value={loading ? '—' : missingSeoCount}
            icon={<TriangleAlert className="h-4 w-4" />}
            hint={
              <span className="text-xs text-gray-600">
                Count based on your latest 20 posts: missing SEO title/description.
              </span>
            }
            actionHref="/dashboard/editor/blogs?seo=missing"
            actionLabel="Filter missing SEO"
          />

          <StatCard
            title="Missing cover images"
            value={loading ? '—' : missingCoverCount}
            icon={<ImageIcon className="h-4 w-4" />}
            hint={<span className="text-xs text-gray-600">Based on your latest 20 posts.</span>}
            actionHref="/dashboard/editor/media"
            actionLabel="Open media library"
          />
        </div>

        {/* Attention panel */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Continue writing</h2>
                <p className="text-sm text-gray-600">
                  Your newest drafts — jump back in and finish strong.
                </p>
              </div>
              <Link href="/dashboard/editor/blogs?status=draft" className="text-sm hover:underline" style={{ color: BRAND }}>
                View drafts
              </Link>
            </div>

            {loading ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : draftsNeedingWork.length === 0 ? (
              <div className="text-sm text-gray-600">
                No drafts found. (Either you’re incredibly productive or suspiciously efficient.)
              </div>
            ) : (
              <div className="divide-y">
                {draftsNeedingWork.map((b) => (
                  <div key={b.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900 line-clamp-1">{b.title}</div>
                        <Pill tone="amber">
                          <Clock className="h-3 w-3" /> Draft
                        </Pill>
                        {!seoOk(b) ? (
                          <Pill tone="red">
                            <TriangleAlert className="h-3 w-3" /> SEO
                          </Pill>
                        ) : (
                          <Pill tone="green">
                            <CheckCircle2 className="h-3 w-3" /> SEO OK
                          </Pill>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Slug: <span className="font-medium text-gray-700">{b.slug || '—'}</span>
                        {' • '}
                        Updated: {fmtDate(b.updatedAt || b.createdAt || null)}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <Link href={`/dashboard/editor/preview/${b.id}`}>
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-1" /> Preview
                        </Button>
                      </Link>
                      <Link href={`/dashboard/editor/blog-editor?id=${b.id}`}>
                        <Button size="sm" variant="outline">
                          <Pencil className="h-4 w-4 mr-1" /> Edit
                        </Button>
                      </Link>
                      {canPublish ? (
                        <Button
                          size="sm"
                          className="text-white"
                          style={{ backgroundColor: BRAND }}
                          onClick={() => togglePublish(b)}
                          title="Publish now"
                        >
                          <ToggleLeft className="h-4 w-4 mr-1" /> Publish
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">SEO quick fixes</h2>
                <p className="text-sm text-gray-600">Top posts missing SEO basics.</p>
              </div>
              <Link href="/dashboard/editor/blogs?seo=missing" className="text-sm hover:underline" style={{ color: BRAND }}>
                Open filter
              </Link>
            </div>

            {loading ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : seoFixList.length === 0 ? (
              <div className="text-sm text-gray-600">All good. Google can breathe.</div>
            ) : (
              <div className="space-y-3">
                {seoFixList.map((b) => (
                  <div key={b.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 line-clamp-1">{b.title}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {b.published ? (
                            <Pill tone="green">
                              <CheckCircle2 className="h-3 w-3" /> Published
                            </Pill>
                          ) : (
                            <Pill tone="amber">
                              <CircleDashed className="h-3 w-3" /> Draft
                            </Pill>
                          )}
                          <Pill tone="red">
                            <TriangleAlert className="h-3 w-3" /> Missing SEO
                          </Pill>
                          {!b.coverImage ? (
                            <Pill tone="amber">
                              <ImageIcon className="h-3 w-3" /> No cover
                            </Pill>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <Link href={`/dashboard/editor/blog-editor?id=${b.id}`}>
                          <Button size="sm" variant="outline">
                            <Settings2 className="h-4 w-4 mr-1" /> Fix
                          </Button>
                        </Link>
                        {canPublish ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => togglePublish(b)}
                            title={b.published ? 'Unpublish' : 'Publish'}
                          >
                            {b.published ? (
                              <>
                                <ToggleRight className="h-4 w-4 mr-1" /> Unpublish
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="h-4 w-4 mr-1" /> Publish
                              </>
                            )}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent posts + Pending comments */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" style={{ color: BRAND }} />
                <h2 className="text-lg font-semibold text-gray-900">Recent posts</h2>
              </div>
              <Link href="/dashboard/editor/blogs" className="text-sm hover:underline" style={{ color: BRAND }}>
                View all
              </Link>
            </div>

            {loading ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : filteredRecent.length === 0 ? (
              <div className="text-sm text-gray-600">No posts found.</div>
            ) : (
              <div className="divide-y">
                {filteredRecent.slice(0, 10).map((b) => (
                  <div key={b.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900 line-clamp-1">{b.title}</div>
                        {b.published ? (
                          <Pill tone="green">
                            <CheckCircle2 className="h-3 w-3" /> Published
                          </Pill>
                        ) : (
                          <Pill tone="amber">
                            <CircleDashed className="h-3 w-3" /> Draft
                          </Pill>
                        )}
                        {!seoOk(b) ? (
                          <Pill tone="red">
                            <TriangleAlert className="h-3 w-3" /> SEO
                          </Pill>
                        ) : null}
                      </div>

                      <div className="mt-1 text-xs text-gray-500">
                        {b.authorUser?.name ? `By ${b.authorUser.name}` : '—'} •{' '}
                        {b.published ? fmtDate(b.publishedAt) : '—'} • {b.slug || '—'}
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <Link href={`/dashboard/editor/preview/${b.id}`}>
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-1" /> Preview
                        </Button>
                      </Link>
                      <Link href={`/dashboard/editor/blog-editor?id=${b.id}`}>
                        <Button size="sm" variant="outline">
                          <Pencil className="h-4 w-4 mr-1" /> Edit
                        </Button>
                      </Link>
                      {canPublish ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => togglePublish(b)}
                          title={b.published ? 'Unpublish' : 'Publish'}
                        >
                          {b.published ? (
                            <>
                              <ToggleRight className="h-4 w-4 mr-1" /> Unpublish
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="h-4 w-4 mr-1" /> Publish
                            </>
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="h-5 w-5" style={{ color: BRAND }} />
                <h2 className="text-lg font-semibold text-gray-900">Pending comments</h2>
              </div>
              <Link href="/dashboard/editor/comments" className="text-sm hover:underline" style={{ color: BRAND }}>
                Moderate
              </Link>
            </div>

            {loading ? (
              <div className="text-sm text-gray-600">Loading…</div>
            ) : pendingList.length === 0 ? (
              <div className="text-sm text-gray-600">No pending comments</div>
            ) : (
              <div className="divide-y">
                {pendingList.map((c) => (
                  <div key={c.id} className="py-3">
                    <div className="text-sm text-gray-900 line-clamp-2">{c.content}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {c.user?.name || c.user?.email || 'Anonymous'} • {c.blog?.title || '—'} • {fmtDate(c.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Shortcuts */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Shortcuts</div>
              <div className="text-xs text-gray-600">Fast paths to your most-used tools.</div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/dashboard/editor/blog-editor">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" /> New post
              </Button>
            </Link>
            <Link href="/dashboard/editor/blogs">
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" /> Posts table & filters
              </Button>
            </Link>
            <Link href="/dashboard/editor/comments">
              <Button variant="outline">
                <MessageSquareWarning className="h-4 w-4 mr-2" /> Comments moderation
              </Button>
            </Link>
            <Link href="/dashboard/editor/media">
              <Button variant="outline">
                <ImageIcon className="h-4 w-4 mr-2" /> Media library
              </Button>
            </Link>
            <Link href="/blog">
              <Button className="text-white" style={{ backgroundColor: BRAND }}>
                <Eye className="h-4 w-4 mr-2" /> View public blog
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Guard>
  );
}
