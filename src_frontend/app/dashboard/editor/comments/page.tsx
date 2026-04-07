'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiDelete, API_BASE } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Role = 'RENTER' | 'LISTER' | 'EDITOR' | 'ADMIN' | 'SUPER_ADMIN';

type Me = { id: string; role: Role };

type CommentItem = {
  id: string;
  content: string;
  createdAt: string;
  isApproved?: boolean;
  hiddenAt?: string | null;
  user?: { id: string; name: string; email?: string | null } | null;
  blog?: { id: string; title: string } | null;
  blogId?: string;
  userId?: string;
};

type ListResponse = {
  items: CommentItem[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
};

const normalizeRole = (r: any) => (typeof r === 'string' ? r.toUpperCase() : '');

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('rk_token') || '';
}

async function apiPatch<T>(path: string, body: any): Promise<{ ok: boolean; json: T | null }> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {}
  return { ok: res.ok, json };
}

function statusLabel(c: CommentItem) {
  const hidden = !!c.hiddenAt;
  const approved = !!c.isApproved;
  if (hidden) return { text: 'Hidden', className: 'bg-gray-100 text-gray-800 border-gray-200' };
  if (approved) return { text: 'Approved', className: 'bg-green-50 text-green-800 border-green-200' };
  return { text: 'Pending', className: 'bg-yellow-50 text-yellow-800 border-yellow-200' };
}

export default function EditorCommentsPage() {
  const [me, setMe] = useState<Me | null>(null);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CommentItem[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [status, setStatus] = useState<'pending' | 'approved' | 'hidden' | 'all'>('pending');
  const [q, setQ] = useState('');
  const [blogId, setBlogId] = useState('');

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const isAdmin = useMemo(() => {
    const r = normalizeRole(me?.role);
    return r === 'ADMIN' || r === 'SUPER_ADMIN';
  }, [me]);

  const canModerate = useMemo(() => {
    const r = normalizeRole(me?.role);
    return r === 'EDITOR' || r === 'ADMIN' || r === 'SUPER_ADMIN';
  }, [me]);

  const loadMe = async () => {
    const res = await apiGet<Me | null>('/api/auth/me');
    if (res.ok && res.json) {
      setMe({ ...res.json, role: normalizeRole((res.json as any).role) as Role });
    } else {
      setMe(null);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiGet<ListResponse | null>('/api/blogs/comments', {
        params: {
          status,
          q: q.trim() || undefined,
          blogId: blogId.trim() || undefined,
          page: String(page),
          perPage: String(perPage),
        },
      } as any);

      if (!res.ok || !res.json) {
        throw new Error((res as any)?.json?.message || 'Failed to load comments');
      }

      setItems(res.json.items || []);
      setTotalPages(res.json.pagination?.totalPages || 1);
      setTotal(res.json.pagination?.total || 0);
      setSelectedIds([]); // reset selection after load
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load comments');
      setItems([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMe();
  }, []);

  // Load when filters change (debounced for q)
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      void load();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q, blogId, perPage]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllOnPage = () => {
    setSelectedIds(items.map((x) => x.id));
  };

  const clearSelection = () => setSelectedIds([]);

  const updateOne = async (commentId: string, payload: { isApproved?: boolean; hidden?: boolean }) => {
    const res = await apiPatch<CommentItem>(`/api/blogs/comments/${commentId}`, payload);
    if (!res.ok) throw new Error((res.json as any)?.message || 'Update failed');
  };

  const deleteOne = async (commentId: string) => {
    const res = await apiDelete(`/api/blogs/comments/${commentId}`);
    if (!res.ok) throw new Error((res as any)?.json?.message || 'Delete failed');
  };

  const actApprove = async (id: string) => {
    try {
      await updateOne(id, { isApproved: true, hidden: false });
      toast.success('Approved');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Approve failed');
    }
  };

  const actHide = async (id: string) => {
    try {
      await updateOne(id, { hidden: true });
      toast.success('Hidden');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Hide failed');
    }
  };

  const actUnhide = async (id: string) => {
    try {
      await updateOne(id, { hidden: false });
      toast.success('Unhidden');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Unhide failed');
    }
  };

  const actDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm('Delete this comment permanently?')) return;
    try {
      await deleteOne(id);
      toast.success('Deleted');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    }
  };

  const bulkUpdate = async (payload: { isApproved?: boolean; hidden?: boolean }) => {
    if (selectedIds.length === 0) return toast.message('No comments selected');
    try {
      await Promise.all(selectedIds.map((id) => updateOne(id, payload)));
      toast.success('Bulk action complete');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Bulk action failed');
    }
  };

  if (!canModerate) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-2">Comments</h1>
        <div className="rounded-lg border bg-red-50 p-4 text-sm text-red-700">
          You do not have permission to moderate comments.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold">Comments</h1>
          <p className="text-sm text-gray-600">
            Moderate pending comments, approve them for public display, or hide/remove problematic ones.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-1">Status</div>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="hidden">Hidden</option>
            <option value="all">All</option>
          </select>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-600 mb-1">Search</div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Comment, user, blog title…" />
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-600 mb-1">Blog ID (optional)</div>
          <Input value={blogId} onChange={(e) => setBlogId(e.target.value)} placeholder="cmg0wuyvg000..." />
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-600 mb-1">Per page</div>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={perPage}
            onChange={(e) => setPerPage(parseInt(e.target.value, 10))}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Bulk actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="text-sm text-gray-600">
          Total: <span className="font-semibold text-gray-900">{total}</span> • Page {page} of {totalPages}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={selectAllOnPage} disabled={items.length === 0}>
            Select page
          </Button>
          <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedIds.length === 0}>
            Clear
          </Button>
          <Button size="sm" onClick={() => void bulkUpdate({ isApproved: true, hidden: false })} disabled={selectedIds.length === 0}>
            Bulk approve
          </Button>
          <Button variant="outline" size="sm" onClick={() => void bulkUpdate({ hidden: true })} disabled={selectedIds.length === 0}>
            Bulk hide
          </Button>
          <Button variant="outline" size="sm" onClick={() => void bulkUpdate({ hidden: false })} disabled={selectedIds.length === 0}>
            Bulk unhide
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="grid grid-cols-12 gap-2 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
          <div className="col-span-1">Sel</div>
          <div className="col-span-3">Blog</div>
          <div className="col-span-2">User</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-gray-600">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-gray-600">No comments found for your filters.</div>
        ) : (
          items.map((c) => {
            const s = statusLabel(c);
            const expandedRow = !!expanded[c.id];
            const blog = c.blog || { id: c.blogId || '', title: '(Unknown blog)' };
            const user = c.user || { id: c.userId || '', name: '(Unknown user)' };

            return (
              <div key={c.id} className="border-t">
                <div className="grid grid-cols-12 gap-2 px-3 py-3 items-center">
                  <div className="col-span-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="h-4 w-4"
                    />
                  </div>

                  <div className="col-span-3">
                    <div className="text-sm font-medium truncate">{blog.title}</div>
                    <div className="text-xs text-gray-500 truncate">{blog.id}</div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-sm truncate">{user.name}</div>
                    {user.email ? <div className="text-xs text-gray-500 truncate">{user.email}</div> : null}
                  </div>

                  <div className="col-span-1">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${s.className}`}>{s.text}</span>
                  </div>

                  <div className="col-span-2">
                    <div className="text-sm">{new Date(c.createdAt).toLocaleString()}</div>
                  </div>

                  <div className="col-span-3 flex justify-end gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpanded((p) => ({ ...p, [c.id]: !expandedRow }))}
                    >
                      {expandedRow ? 'Hide text' : 'View text'}
                    </Button>

                    <Link href={`/blog/${blog.id}`} target="_blank" className="inline-flex">
                      <Button size="sm" variant="outline">View blog</Button>
                    </Link>

                    <Link href={`/dashboard/editor/blog-editor?id=${blog.id}`} className="inline-flex">
                      <Button size="sm" variant="outline">Open editor</Button>
                    </Link>

                    {!c.isApproved && !c.hiddenAt && (
                      <Button size="sm" onClick={() => void actApprove(c.id)}>Approve</Button>
                    )}

                    {!c.hiddenAt ? (
                      <Button size="sm" variant="outline" onClick={() => void actHide(c.id)}>
                        Hide
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => void actUnhide(c.id)}>
                        Unhide
                      </Button>
                    )}

                    {isAdmin && (
                      <Button size="sm" variant="destructive" onClick={() => void actDelete(c.id)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                {expandedRow && (
                  <div className="px-3 pb-4">
                    <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap">
                      {c.content}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-600">
          Selected: <span className="font-semibold text-gray-900">{selectedIds.length}</span>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Prev
          </Button>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
