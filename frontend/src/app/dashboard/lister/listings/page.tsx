'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiDelete, apiGet, apiPatch } from '@/lib/api';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  Eye,
  Pencil,
  Trash2,
  Search,
  BedDouble,
  Bath,
  Sparkles,
  UploadCloud,
  EyeOff,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type Unit = {
  id: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
  type: string;
  available?: number;
  count?: number;
  rented?: number;
  status?: string;
};

type Property = {
  id: string;
  title: string;
  description?: string | null;
  location: string;
  county?: string | null;
  constituency?: string | null;
  ward?: string | null;
  createdAt: string;
  updatedAt?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  featured?: boolean;
  images: { url: string }[];
  units: Unit[];
  amenities?: { amenity: { name: string } }[];
};

type UsageResponse = {
  usedListings?: number;
  remainingListings?: number;
  totalListings?: number;

  usedFeatured?: number;
  remainingFeatured?: number;
  totalFeatured?: number;

  // some builds return nested structures; keep flexible
  listings?: { used: number; remaining: number; total: number };
  featured?: { used: number; remaining: number; total: number };
};

function fmtKES(n: number) {
  try {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  } catch {
    return String(n);
  }
}

function usagePick(u: UsageResponse | null) {
  if (!u) return null;

  const listings =
    u.listings ||
    (u.totalListings !== undefined
      ? {
          used: u.usedListings ?? 0,
          remaining: u.remainingListings ?? 0,
          total: u.totalListings ?? 0,
        }
      : null);

  const featured =
    u.featured ||
    (u.totalFeatured !== undefined
      ? {
          used: u.usedFeatured ?? 0,
          remaining: u.remainingFeatured ?? 0,
          total: u.totalFeatured ?? 0,
        }
      : null);

  return { listings, featured };
}

export default function MyListingsPage() {
  const [items, setItems] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);

  const [usage, setUsage] = useState<UsageResponse | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Published' | 'Unpublished' | 'Drafts' | 'Featured'>('All');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [loading, setLoading] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<Property | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState<string>(''); // free text numeric-ish
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deleting, setDeleting] = useState<Property | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const usageNorm = useMemo(() => usagePick(usage), [usage]);

  async function fetchUsage() {
    const res = await apiGet<UsageResponse>('/subscription/usage');
    if (res.ok) setUsage(res.data);
  }

  async function fetchListings() {
    setLoading(true);
    const res = await apiGet<{ items: Property[]; total: number; page?: number; pages?: number; limit?: number }>(
      '/properties/mine',
      { params: { page, limit } }
    );

    setLoading(false);

    if (!res.ok) {
      toast.error(res.error || 'Failed to load listings');
      return;
    }

    setItems(res.data?.items || []);
    setTotal(res.data?.total || 0);
  }

  useEffect(() => {
    fetchListings();
    fetchUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const filtered = useMemo(() => {
    let data = [...items];

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter((p) => (p.title || '').toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q));
    }

    if (statusFilter !== 'All') {
      data = data.filter((p) => {
        if (statusFilter === 'Featured') return !!p.featured;
        if (statusFilter === 'Drafts') return p.status === 'DRAFT';
        if (statusFilter === 'Published') return p.status === 'PUBLISHED';
        if (statusFilter === 'Unpublished') return p.status === 'UNPUBLISHED';
        return true;
      });
    }

    return data;
  }, [items, search, statusFilter]);

  function openEdit(p: Property) {
    setEditing(p);
    setEditTitle(p.title || '');
    setEditLocation(p.location || '');
    setEditDescription(p.description || '');
    setEditPrice(p.units?.[0]?.rent ? String(p.units[0].rent) : '');
  }

  function normalizePriceToNumber(s: string) {
    // allow "16,000", "16000", "16,000.00" -> 16000
    const cleaned = (s || '').replace(/,/g, '').trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  async function saveChanges() {
    if (!editing) return;

    setSaving(true);

    const payload: any = {
      title: editTitle.trim(),
      location: editLocation.trim(),
      description: editDescription.trim(),
    };

    // Only allow price (units) edits when NOT published, because backend forbids changing units for published.
    if (editing.status !== 'PUBLISHED') {
      const n = normalizePriceToNumber(editPrice);
      const nextRent = n ?? editing.units?.[0]?.rent ?? 0;

      payload.units = (editing.units || []).map((u) => ({
        ...u,
        rent: nextRent,
      }));
    }

    const res = await apiPatch(`/properties/${editing.id}`, payload);

    setSaving(false);

    if (!res.ok) {
      toast.error(res.error || 'Failed to save changes');
      return;
    }

    toast.success('Changes saved');
    setEditing(null);
    fetchListings();
  }

  async function confirmDelete() {
    if (!deleting) return;

    setDeleteBusy(true);
    const res = await apiDelete(`/properties/${deleting.id}`);
    setDeleteBusy(false);

    if (!res.ok) {
      toast.error(res.error || 'Failed to delete property');
      return;
    }

    toast.success('Property deleted');
    setDeleting(null);
    // refresh list + usage (images/listings counts)
    fetchListings();
    fetchUsage();
  }

  async function changeStatus(p: Property, newStatus: 'PUBLISHED' | 'UNPUBLISHED') {
    // Publish uses /:id/publish (consumes quota if not consumedSlot)
    // Unpublish uses /:id/status
    if (newStatus === 'PUBLISHED') {
      const remaining = usageNorm?.listings?.remaining;
      const msg =
        remaining !== undefined
          ? `Publishing will consume 1 listing slot. Remaining after: ${Math.max(0, remaining - 1)}`
          : 'Publishing will consume 1 listing slot.';
      toast.message(msg);

      const res = await apiPatch(`/properties/${p.id}/publish`, {});
      if (!res.ok) {
        toast.error(res.error || 'Failed to publish');
        return;
      }
      toast.success('Published');
    } else {
      const res = await apiPatch(`/properties/${p.id}/status`, { newStatus });
      if (!res.ok) {
        toast.error(res.error || 'Failed to unpublish');
        return;
      }
      toast.success('Unpublished (quota is not refunded)');
    }

    fetchListings();
    fetchUsage();
  }

  async function toggleFeatured(p: Property) {
    const next = !p.featured;

    // Your backend only consumes featured quota when publishing a listing while featured.
    // So we communicate clearly:
    if (next) {
      const remaining = usageNorm?.featured?.remaining;
      toast.message(
        remaining !== undefined
          ? `Marked as Featured. If you publish while featured, it will consume 1 featured slot (${remaining} remaining now).`
          : 'Marked as Featured. If you publish while featured, it will consume 1 featured slot.'
      );
    } else {
      toast.message('Unfeatured. Note: featured quota is not refunded once consumed.');
    }

    const res = await apiPatch(`/properties/${p.id}`, { featured: next });
    if (!res.ok) {
      toast.error(res.error || 'Failed to update featured status');
      return;
    }

    fetchListings();
    fetchUsage();
  }

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <section className="p-4 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Listings</h1>
          {usageNorm?.listings && usageNorm?.featured && (
            <p className="text-sm text-gray-600 mt-1">
              Listings: <b>{usageNorm.listings.remaining}</b> remaining / {usageNorm.listings.total} • Featured:{' '}
              <b>{usageNorm.featured.remaining}</b> remaining / {usageNorm.featured.total}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/lister/list" className="inline-flex">
            <Button className="bg-brand-blue text-white hover:bg-black">
              <UploadCloud className="h-4 w-4 mr-2" />
              Add New Listing
            </Button>
          </Link>
          <Button variant="outline" onClick={() => { fetchListings(); fetchUsage(); }}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-1/2">
          <Input
            placeholder="Search by title or location"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
          <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
          >
            <option value="All">All</option>
            <option value="Published">Published</option>
            <option value="Unpublished">Unpublished</option>
            <option value="Featured">Featured</option>
            <option value="Drafts">Drafts</option>
          </select>

          <select
            className="border rounded px-3 py-2 text-sm w-full sm:w-auto"
            value={limit}
            onChange={(e) => {
              setPage(1);
              setLimit(Number(e.target.value));
            }}
          >
            <option value={10}>10</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Listings */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Photo</th>
              <th className="p-3">Property</th>
              <th className="p-3">Status</th>
              <th className="p-3">Price (KES)</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-600">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-600">
                  No listings found.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const unit0 = p.units?.[0];
                const canView = p.status === 'PUBLISHED';

                return (
                  <tr key={p.id} className="border-t align-top">
                    <td className="p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.images?.[0]?.url || '/placeholder.webp'}
                        alt={p.title}
                        className="h-16 w-24 object-cover rounded"
                      />
                    </td>

                    <td className="p-3">
                      <div className="font-medium">{p.title || '(Untitled)'}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {p.location}
                        {p.county ? ` • ${p.county}` : ''}
                        {p.constituency ? `, ${p.constituency}` : ''}
                        {p.ward ? `, ${p.ward}` : ''}
                      </div>

                      <div className="flex gap-3 text-xs text-gray-700 mt-2">
                        {unit0 ? (
                          <>
                            <span className="flex items-center gap-1">
                              <BedDouble className="h-4 w-4" />
                              {unit0.bedrooms}
                            </span>
                            <span className="flex items-center gap-1">
                              <Bath className="h-4 w-4" />
                              {unit0.bathrooms}
                            </span>
                            <span className="text-gray-600">{unit0.type}</span>
                          </>
                        ) : (
                          <span className="text-red-700">No unit details</span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 space-y-1">
                      <Badge className="bg-brand-blue text-white">{p.status}</Badge>
                      {p.featured && <Badge className="bg-yellow-500 text-white">Featured</Badge>}
                    </td>

                    <td className="p-3">
                      {unit0?.rent ? (
                        <span className="font-semibold">{fmtKES(unit0.rent)}</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="flex justify-end gap-2 flex-wrap">
                        {/* View (only published) */}
                        {canView ? (
                          <Link href={`/properties/${p.id}`} target="_blank">
                            <Button size="icon" variant="outline" className="text-brand-blue" title="View live">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        ) : (
                          <Button
                            size="icon"
                            variant="outline"
                            className="text-gray-400 cursor-not-allowed"
                            title="Only published listings can be viewed"
                            disabled
                          >
                            <EyeOff className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Publish / Unpublish quick actions */}
                        {p.status !== 'PUBLISHED' ? (
                          <Button
                            variant="outline"
                            className="text-green-700"
                            onClick={() => changeStatus(p, 'PUBLISHED')}
                            title="Publish"
                          >
                            Publish
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="text-orange-700"
                            onClick={() => changeStatus(p, 'UNPUBLISHED')}
                            title="Unpublish"
                          >
                            Unpublish
                          </Button>
                        )}

                        {/* Feature toggle (visible without Edit) */}
                        <Button
                          variant="outline"
                          className={p.featured ? 'text-gray-700' : 'text-yellow-700'}
                          onClick={() => toggleFeatured(p)}
                          title={p.featured ? 'Unfeature' : 'Feature'}
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          {p.featured ? 'Unfeature' : 'Feature'}
                        </Button>

                        {/* Edit */}
                        <Button
                          size="icon"
                          variant="outline"
                          className="text-green-700"
                          onClick={() => openEdit(p)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        {/* Delete */}
                        <Button
                          size="icon"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => setDeleting(p)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-sm">
        <div>
          Page <b>{page}</b> of <b>{pages}</b> • Total <b>{total}</b>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Prev
          </Button>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Property</DialogTitle>
            <DialogDescription>
              Published listings can’t change unit details (including Price) or images.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>

              <div>
                <Label>Location</Label>
                <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>

              <div>
                <Label>Price (KES)</Label>
                <Input
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder="e.g. 16,000"
                  disabled={editing.status === 'PUBLISHED'}
                />
                {editing.status === 'PUBLISHED' && (
                  <p className="text-xs text-gray-600 mt-1">
                    Price is part of unit details and can’t be changed once published.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveChanges} disabled={saving} className="bg-green-600 text-white">
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete listing?</DialogTitle>
            <DialogDescription>
              This will permanently delete the listing and its uploaded images.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}