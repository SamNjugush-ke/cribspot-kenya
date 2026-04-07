'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiDelete, apiGet, apiPost, apiPut, API_BASE } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Eye,
  FileEdit,
  Copy,
  Trash2,
  RotateCcw,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Filter,
  X,
  ShieldAlert,
  Shapes,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type Role = 'RENTER' | 'LISTER' | 'EDITOR' | 'ADMIN' | 'SUPER_ADMIN' | 'AGENT';

type Me = {
  id: string;
  name?: string | null;
  role: Role;
};

type BlogListItem = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImage?: string | null;
  published: boolean;
  publishedAt?: string | null;
  authorUser?: { id: string; name: string | null };

  seoTitle?: string | null;
  seoDesc?: string | null;
  seoKeywords?: string | null;
  canonicalUrl?: string | null;
  ogImage?: string | null;

  deletedAt?: string | null;
};

type BlogListResponse = {
  items: BlogListItem[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
};

type SelectItem = { id: string; name: string };

function fmtDate(d?: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '—';
  }
}

function resolveUrl(u?: string | null) {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  return `${API_BASE}${u}`;
}

function normalizeRole(r: any): Role | '' {
  return typeof r === 'string' ? (r.toUpperCase() as any) : '';
}

function hasSeo(b: BlogListItem) {
  const okTitle = !!(b.seoTitle && b.seoTitle.trim().length >= 5);
  const okDesc = !!(b.seoDesc && b.seoDesc.trim().length >= 30);
  return okTitle && okDesc;
}

export default function BlogListPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<BlogListItem[]>([]);
  const [pagination, setPagination] = useState<BlogListResponse['pagination']>({
    page: 1,
    perPage: 25,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // URL state
  const q = sp.get('q') || '';
  const status = (sp.get('status') || 'all') as 'all' | 'published' | 'draft' | 'trash';
  const seo = (sp.get('seo') || 'all') as 'all' | 'complete' | 'missing';
  const categoryId = sp.get('categoryId') || '';
  const page = Math.max(parseInt(sp.get('page') || '1', 10) || 1, 1);

  // category dropdown
  const [catOpen, setCatOpen] = useState(false);
  const [catQuery, setCatQuery] = useState('');
  const [catOptions, setCatOptions] = useState<SelectItem[]>([]);
  const [catLoading, setCatLoading] = useState(false);

  const canSeeDrafts = useMemo(() => {
    const r = normalizeRole(me?.role);
    return r === 'EDITOR' || r === 'ADMIN' || r === 'SUPER_ADMIN';
  }, [me]);

  const canPublish = useMemo(() => {
    const r = normalizeRole(me?.role);
    return r === 'EDITOR' || r === 'ADMIN' || r === 'SUPER_ADMIN';
  }, [me]);

  const canModerateTrash = useMemo(() => {
    const r = normalizeRole(me?.role);
    return r === 'ADMIN' || r === 'SUPER_ADMIN';
  }, [me]);

  const setQuery = (next: Record<string, string | number | undefined | null>) => {
    const params = new URLSearchParams(sp.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') params.delete(k);
      else params.set(k, String(v));
    });
    router.push(`/dashboard/editor/blogs?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push('/dashboard/editor/blogs');
  };

  const loadCategories = async (query: string) => {
    setCatLoading(true);
    try {
      const trimmed = (query || '').trim();
      const endpoint = trimmed
        ? `/api/blogs/categories?q=${encodeURIComponent(trimmed)}`
        : `/api/blogs/categories/all`;

      const res = await apiGet<SelectItem[] | null>(endpoint);
      setCatOptions(res.json || []);
    } finally {
      setCatLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setErr(null);

    try {
      const meRes = await apiGet<Me>('/api/auth/me');
      if (!meRes.json) throw new Error('Failed to load profile');
      const role = normalizeRole(meRes.json.role) as Role;
      setMe({ ...meRes.json, role });

      // listBlogs supports: search, page, perPage, sort, status, categoryId, includeUnpublished
  const params: Record<string, string> = {
    page: String(page),
    perPage: '25',
    sort: 'newest',
    search: q,
  };

  // Only send status when it’s a real backend filter
  if (status && status !== 'all') {
    params.status = status; // published | draft | trash
  }


      if (categoryId) params.categoryId = categoryId;

      if (role === 'EDITOR' || role === 'ADMIN' || role === 'SUPER_ADMIN') {
        params.includeUnpublished = '1';
      }

      const res = await apiGet<BlogListResponse>('/api/blogs', { params } as any);
      const list = Array.isArray(res.json?.items) ? res.json!.items : [];

      // SEO filter client-side
      const filtered =
        seo === 'all'
          ? list
          : seo === 'complete'
          ? list.filter(hasSeo)
          : list.filter((b) => !hasSeo(b));

      setItems(filtered);
      setPagination(res.json?.pagination || { page: 1, perPage: 25, total: 0, totalPages: 1 });
    } catch (e: any) {
      setItems([]);
      setErr(e?.message || 'Failed to load blogs');
      setPagination({ page: 1, perPage: 25, total: 0, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, seo, categoryId, page]);

  useEffect(() => {
    if (!catOpen) return;
    const t = setTimeout(() => void loadCategories(catQuery), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catOpen, catQuery]);

  const onDuplicate = async (id: string) => {
    setBusyId(id);
    try {
      const res = await apiPost(`/api/blogs/${id}/duplicate`, {});
      if (!res.ok) throw new Error('Duplicate failed');
      toast.success('Duplicated (draft copy created)');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to duplicate');
    } finally {
      setBusyId(null);
    }
  };

  const onTogglePublish = async (b: BlogListItem) => {
    if (!canPublish) return;
    if (b.deletedAt) return;

    setBusyId(b.id);
    try {
      const res = await apiPut(`/api/blogs/${b.id}`, { published: !b.published });
      if (!res.ok) throw new Error('Update failed');
      toast.success(b.published ? 'Moved to draft' : 'Published');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update');
    } finally {
      setBusyId(null);
    }
  };

  const onTrash = async (b: BlogListItem) => {
    if (!canModerateTrash) return;

    const ok = window.confirm('Move this post to Trash?');
    if (!ok) return;

    setBusyId(b.id);
    try {
      const res = await apiPost(`/api/blogs/${b.id}/trash`, {});
      if (!res.ok) throw new Error('Trash failed');
      toast.success('Moved to Trash');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to trash');
    } finally {
      setBusyId(null);
    }
  };

  const onRestore = async (b: BlogListItem) => {
    if (!canModerateTrash) return;

    setBusyId(b.id);
    try {
      const res = await apiPost(`/api/blogs/${b.id}/restore`, {});
      if (!res.ok) throw new Error('Restore failed');
      toast.success('Restored');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to restore');
    } finally {
      setBusyId(null);
    }
  };

  const onHardDelete = async (b: BlogListItem) => {
    if (!canModerateTrash) return;

    const ok = window.confirm('Permanently delete this post? This cannot be undone.');
    if (!ok) return;

    setBusyId(b.id);
    try {
      const res = await apiDelete(`/api/blogs/${b.id}`, { params: { hard: '1' } as any } as any);
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Deleted permanently');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete');
    } finally {
      setBusyId(null);
    }
  };

  const filtersActive = !!(q || categoryId || (status && status !== 'all') || (seo && seo !== 'all'));

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold">Blog Posts</h1>
          <p className="text-sm text-gray-600">
            Power table for Property Advice (drafts, publish toggle, categories, SEO, trash).
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => router.push('/dashboard/editor/blog-editor')}
            className="bg-[#004AAD] text-white hover:opacity-95"
          >
            + New post
          </Button>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border bg-white p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-600" />
          <div className="text-sm font-medium">Filters</div>

          {filtersActive && (
            <button
              onClick={clearFilters}
              className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-gray-50"
              title="Clear all filters"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-5">
            <div className="relative">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
              <Input
                value={q}
                onChange={(e) => setQuery({ q: e.target.value, page: 1 })}
                placeholder="Search title/excerpt/content…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <select
              value={status}
              onChange={(e) => setQuery({ status: e.target.value, page: 1 })}
              className="h-10 w-full rounded-md border px-3 text-sm bg-white"
            >
              <option value="all">All</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
              <option value="trash">Trash</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={seo}
              onChange={(e) => setQuery({ seo: e.target.value, page: 1 })}
              className="h-10 w-full rounded-md border px-3 text-sm bg-white"
              title="SEO completeness based on seoTitle + seoDesc"
            >
              <option value="all">SEO: All</option>
              <option value="complete">SEO: Complete</option>
              <option value="missing">SEO: Missing</option>
            </select>
          </div>

          {/* ✅ Category type-to-filter dropdown */}
          <div className="lg:col-span-3 relative">
            <button
              type="button"
              onClick={() => setCatOpen((v) => !v)}
              className="h-10 w-full rounded-md border px-3 text-sm bg-white text-left flex items-center gap-2"
              title="Filter by category"
            >
              <Shapes className="h-4 w-4 text-gray-500" />
              <span className="text-xs text-gray-500">Category:</span>
              <span className="text-sm">{categoryId ? 'Selected' : 'Any'}</span>
            </button>

            {catOpen && (
              <div className="absolute z-30 mt-2 w-full rounded-lg border bg-white shadow p-2">
                <Input
                  value={catQuery}
                  onChange={(e) => setCatQuery(e.target.value)}
                  placeholder="Type to filter categories…"
                />

                <div className="mt-2 max-h-56 overflow-auto">
                  <button
                    className="w-full text-left px-2 py-2 rounded hover:bg-gray-50 text-sm"
                    onClick={() => {
                      setQuery({ categoryId: '', page: 1 });
                      setCatOpen(false);
                      setCatQuery('');
                    }}
                  >
                    All categories
                  </button>

                  {catLoading ? (
                    <div className="px-2 py-2 text-sm text-gray-500">Loading…</div>
                  ) : (
                    catOptions.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-2 py-2 rounded hover:bg-gray-50 text-sm"
                        onClick={() => {
                          setQuery({ categoryId: c.id, page: 1 });
                          setCatOpen(false);
                          setCatQuery('');
                        }}
                      >
                        {c.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
          {!canSeeDrafts && (
            <>
              <ShieldAlert className="h-3.5 w-3.5" />
              Drafts/Trash may be hidden by role permissions.
            </>
          )}
          <span className="ml-auto">{pagination.total ? `${pagination.total} posts` : ''}</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="hidden md:grid grid-cols-12 px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-50 border-b">
          <div className="col-span-6">Post</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">SEO</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-gray-600">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No posts found.</div>
        ) : (
          <div className="divide-y">
            {items.map((b) => {
              const busy = busyId === b.id;
              const trashed = !!b.deletedAt;
              const seoOk = hasSeo(b);

              const statusLabel = trashed ? 'Trash' : b.published ? 'Published' : 'Draft';

              const statusPill =
                trashed
                  ? 'bg-gray-50 text-gray-700 border-gray-200'
                  : b.published
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200';

              return (
                <div key={b.id} className="px-4 py-4 md:py-3">
                  {/* Desktop */}
                  <div className="hidden md:grid grid-cols-12 items-center gap-3">
                    <div className="col-span-6 flex items-center gap-3 min-w-0">
                      {b.coverImage ? (
                        <img
                          src={resolveUrl(b.coverImage)}
                          alt=""
                          className="h-10 w-14 rounded-md object-cover border"
                        />
                      ) : (
                        <div className="h-10 w-14 rounded-md border bg-gray-50" />
                      )}

                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 line-clamp-1">{b.title}</div>
                        <div className="text-xs text-gray-500 line-clamp-1">
                          {b.authorUser?.name ? `By ${b.authorUser.name}` : '—'} •{' '}
                          {b.slug ? b.slug : '—'} • {b.published ? fmtDate(b.publishedAt) : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <span
                        className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium border ${statusPill}`}
                      >
                        {statusLabel}
                        {!trashed && canPublish && (
                          <button
                            disabled={busy}
                            onClick={() => onTogglePublish(b)}
                            className="ml-1 inline-flex items-center"
                            title={b.published ? 'Unpublish (move to draft)' : 'Publish'}
                          >
                            {b.published ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span
                        className={[
                          'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border',
                          seoOk
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-red-50 text-red-700 border-red-200',
                        ].join(' ')}
                        title={seoOk ? 'SEO title + description set' : 'Missing SEO title/description'}
                      >
                        {seoOk ? 'SEO OK' : 'SEO Missing'}
                      </span>
                    </div>

                    <div className="col-span-2 flex justify-end gap-2">
                      <Link
                        href={`/dashboard/editor/preview/${b.id}`}
                        className="h-9 w-9 inline-flex items-center justify-center rounded-lg border hover:bg-gray-50"
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>

                      {!trashed && (
                        <Link
                          href={`/dashboard/editor/blog-editor?id=${b.id}`}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border hover:bg-gray-50"
                          title="Edit"
                        >
                          <FileEdit className="h-4 w-4" />
                        </Link>
                      )}

                      {!trashed && (
                        <button
                          disabled={busy}
                          onClick={() => onDuplicate(b.id)}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                          title="Duplicate (creates draft copy)"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      )}

                      {!trashed ? (
                        <button
                          disabled={busy || !canModerateTrash}
                          onClick={() => onTrash(b)}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border hover:bg-red-50 disabled:opacity-40"
                          title={canModerateTrash ? 'Move to Trash' : 'Admin only'}
                        >
                          <Trash2 className="h-4 w-4 text-red-700" />
                        </button>
                      ) : (
                        <>
                          <button
                            disabled={busy || !canModerateTrash}
                            onClick={() => onRestore(b)}
                            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border hover:bg-gray-50 disabled:opacity-40"
                            title={canModerateTrash ? 'Restore' : 'Admin only'}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                          <button
                            disabled={busy || !canModerateTrash}
                            onClick={() => onHardDelete(b)}
                            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border hover:bg-red-50 disabled:opacity-40"
                            title={canModerateTrash ? 'Delete permanently' : 'Admin only'}
                          >
                            <Trash2 className="h-4 w-4 text-red-700" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="md:hidden flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {b.coverImage ? (
                          <img
                            src={resolveUrl(b.coverImage)}
                            alt=""
                            className="h-10 w-14 rounded-md object-cover border"
                          />
                        ) : (
                          <div className="h-10 w-14 rounded-md border bg-gray-50" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 line-clamp-1">{b.title}</div>
                          <div className="text-xs text-gray-500 line-clamp-1">
                            {b.authorUser?.name ? `By ${b.authorUser.name}` : '—'} •{' '}
                            {b.published ? fmtDate(b.publishedAt) : '—'}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <Link
                          href={`/dashboard/editor/preview/${b.id}`}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border hover:bg-gray-50"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>

                        {!trashed && (
                          <Link
                            href={`/dashboard/editor/blog-editor?id=${b.id}`}
                            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border hover:bg-gray-50"
                            title="Edit"
                          >
                            <FileEdit className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusPill}`}
                      >
                        {statusLabel}
                      </span>

                      {!trashed && canPublish && (
                        <button
                          disabled={busy}
                          onClick={() => onTogglePublish(b)}
                          className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                          title={b.published ? 'Unpublish (move to draft)' : 'Publish'}
                        >
                          {b.published ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                          {b.published ? 'Unpublish' : 'Publish'}
                        </button>
                      )}
                    </div>

                    {busy && (
                      <div className="text-xs text-gray-500 inline-flex items-center gap-2">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Working…
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ Proper pagination using backend pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Page {pagination.page} of {pagination.totalPages}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={pagination.page <= 1}
            onClick={() => setQuery({ page: pagination.page - 1 })}
          >
            <ChevronLeft className="h-4 w-4 mr-2" /> Prev
          </Button>

          <Button
            variant="outline"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setQuery({ page: pagination.page + 1 })}
          >
            Next <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}