'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ImageUploader, { type ImageItem } from '@/components/listing/ImageUploader';
import { AMENITIES, KENYA_ADMIN } from '@/lib/constants';

import {
  AlertTriangle,
  Bath,
  BedDouble,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';

type Unit = {
  id?: string;
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
  area?: string | null;
  createdAt: string;
  updatedAt?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  featured?: boolean;
  consumedSlot?: boolean;
  images: { id?: string; url: string }[];
  units: Unit[];
  amenities?: { amenity: { id?: string; name: string } }[];
};

type UsageResponse = {
  usedListings?: number;
  remainingListings?: number;
  totalListings?: number;
  usedFeatured?: number;
  remainingFeatured?: number;
  totalFeatured?: number;
  activeCount?: number;
  listings?: { used: number; remaining: number; total: number };
  featured?: { used: number; remaining: number; total: number };
};

type PublishValidation = {
  ok: boolean;
  missing: string[];
};

type AdminMap = Record<string, { constituencies: Record<string, { wards: string[] }> }>;
const ADMIN: AdminMap = KENYA_ADMIN as unknown as AdminMap;

const DEFAULT_UNIT: Unit = {
  bedrooms: 1,
  bathrooms: 1,
  rent: 0,
  type: 'Apartment',
  available: 1,
  count: 1,
  rented: 0,
  status: 'AVAILABLE',
};

function fmtKES(n: number) {
  try {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  } catch {
    return String(n);
  }
}

function trim(v: unknown) {
  return typeof v === 'string' ? v.trim() : '';
}

function toNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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

  return { listings, featured, activeCount: u.activeCount ?? 0 };
}

function propertyMissingFields(p: Partial<Property>): string[] {
  const missing: string[] = [];

  if (!trim(p.title)) missing.push('title');
  if (!trim(p.location)) missing.push('location');
  if (!trim(p.description)) missing.push('description');
  if (!trim(p.county)) missing.push('county');
  if (!trim(p.constituency)) missing.push('constituency');
  if (!trim(p.ward)) missing.push('ward');

  const units = Array.isArray(p.units) ? p.units : [];
  if (!units.length) {
    missing.push('unit details');
  } else {
    const invalidUnit = units.some((u) => {
      return !trim(u.type) || toNumber(u.bedrooms) < 1 || toNumber(u.bathrooms) < 1 || toNumber(u.rent) < 1 || toNumber(u.available) < 1;
    });
    if (invalidUnit) missing.push('complete unit details');
  }

  const images = Array.isArray(p.images) ? p.images.filter((img) => trim(img?.url)) : [];
  if (!images.length) missing.push('at least one image');

  return missing;
}

function validatePropertyForPublish(p: Partial<Property>): PublishValidation {
  const missing = propertyMissingFields(p);
  return { ok: missing.length === 0, missing };
}

function newUnit(): Unit {
  return { ...DEFAULT_UNIT };
}

function buildCountyOptions(current: string) {
  const options = Object.keys(ADMIN).sort();
  return current && !options.includes(current) ? [current, ...options] : options;
}

function buildConstituencyOptions(county: string, current: string) {
  const options = county ? Object.keys(ADMIN[county]?.constituencies || {}).sort() : [];
  return current && !options.includes(current) ? [current, ...options] : options;
}

function buildWardOptions(county: string, constituency: string, current: string) {
  const options = county && constituency ? (ADMIN[county]?.constituencies?.[constituency]?.wards || []).filter(Boolean).sort() : [];
  return current && !options.includes(current) ? [current, ...options] : options;
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

  const [editing, setEditing] = useState<Property | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editingTab, setEditingTab] = useState('basic');
  const [imagesBusy, setImagesBusy] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    location: '',
    county: '',
    constituency: '',
    ward: '',
    description: '',
    featured: false,
    amenities: [] as string[],
    units: [newUnit()] as Unit[],
    images: [] as ImageItem[],
  });

  const [deleting, setDeleting] = useState<Property | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [publishTarget, setPublishTarget] = useState<Property | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);

  const [unpublishTarget, setUnpublishTarget] = useState<Property | null>(null);
  const [unpublishBusy, setUnpublishBusy] = useState(false);

  const [quotaTarget, setQuotaTarget] = useState<Property | null>(null);
  const [incompleteTarget, setIncompleteTarget] = useState<{ property: Property; missing: string[] } | null>(null);

  const usageNorm = useMemo(() => usagePick(usage), [usage]);

  async function fetchUsage() {
    const res = await apiGet<UsageResponse>('/subscription/usage', { cache: 'no-store' as any });
    if (res.ok) setUsage(res.data);
  }

  async function fetchListings() {
    setLoading(true);
    const res = await apiGet<{ items: Property[]; total: number }>(
      '/properties/mine',
      { params: { page, limit, t: Date.now() }, cache: 'no-store' as any }
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

  const pages = Math.max(1, Math.ceil(total / limit));
  const countyOptions = useMemo(() => buildCountyOptions(editForm.county), [editForm.county]);
  const constituencyOptions = useMemo(
    () => buildConstituencyOptions(editForm.county, editForm.constituency),
    [editForm.county, editForm.constituency]
  );
  const wardOptions = useMemo(
    () => buildWardOptions(editForm.county, editForm.constituency, editForm.ward),
    [editForm.county, editForm.constituency, editForm.ward]
  );

  function resetEditForm() {
    setEditForm({
      title: '',
      location: '',
      county: '',
      constituency: '',
      ward: '',
      description: '',
      featured: false,
      amenities: [],
      units: [newUnit()],
      images: [],
    });
    setEditingTab('basic');
    setImagesBusy(false);
  }

  function hydrateEditForm(p: Property) {
    setEditForm({
      title: p.title || '',
      location: p.location || '',
      county: p.county || '',
      constituency: p.constituency || '',
      ward: p.ward || '',
      description: p.description || '',
      featured: !!p.featured,
      amenities: (p.amenities || []).map((a) => a.amenity?.name).filter(Boolean as any),
      units: (p.units || []).length
        ? p.units.map((u) => ({
            id: u.id,
            type: u.type || 'Apartment',
            bedrooms: toNumber(u.bedrooms, 1),
            bathrooms: toNumber(u.bathrooms, 1),
            rent: toNumber(u.rent, 0),
            available: Math.max(1, toNumber(u.available, 1)),
            count: Math.max(1, toNumber(u.count ?? u.available ?? 1, 1)),
            rented: Math.max(0, toNumber(u.rented, 0)),
            status: u.status || 'AVAILABLE',
          }))
        : [newUnit()],
      images: (p.images || []).map((img) => ({ id: img.id, url: img.url })).filter((img) => !!img.url),
    });
  }

  async function openEdit(p: Property) {
    setEditBusy(true);
    resetEditForm();
    setEditing(p);
    try {
      const res = await apiGet<Property>(`/properties/${p.id}/details`, { cache: 'no-store' as any });
      const full = res.ok && res.data?.id ? res.data : p;
      setEditing(full);
      hydrateEditForm(full);
    } catch {
      hydrateEditForm(p);
    } finally {
      setEditBusy(false);
    }
  }

  function closeEdit() {
    setEditing(null);
    resetEditForm();
    setEditBusy(false);
  }

  function updateEditField<K extends keyof typeof editForm>(key: K, value: (typeof editForm)[K]) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateUnit(index: number, patch: Partial<Unit>) {
    setEditForm((prev) => ({
      ...prev,
      units: prev.units.map((u, i) => (i === index ? { ...u, ...patch } : u)),
    }));
  }

  function addUnit() {
    setEditForm((prev) => ({ ...prev, units: [...prev.units, newUnit()] }));
  }

  function removeUnit(index: number) {
    setEditForm((prev) => ({
      ...prev,
      units: prev.units.length <= 1 ? [newUnit()] : prev.units.filter((_, i) => i !== index),
    }));
  }

  function toggleAmenity(name: string) {
    setEditForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(name)
        ? prev.amenities.filter((a) => a !== name)
        : [...prev.amenities, name],
    }));
  }

  async function saveChanges() {
    if (!editing) return;

    const payload = {
      title: editForm.title.trim(),
      location: editForm.location.trim(),
      description: editForm.description.trim(),
      county: editForm.county.trim() || null,
      constituency: editForm.constituency.trim() || null,
      ward: editForm.ward.trim() || null,
      featured: !!editForm.featured,
      amenities: editForm.amenities,
      units: editForm.units.map((u) => ({
        type: u.type.trim(),
        bedrooms: Math.max(0, toNumber(u.bedrooms, 0)),
        bathrooms: Math.max(0, toNumber(u.bathrooms, 0)),
        rent: Math.max(0, Math.round(toNumber(u.rent, 0))),
        available: Math.max(0, toNumber(u.available, 0)),
        count: Math.max(1, toNumber(u.count ?? u.available ?? 1, 1)),
        rented: Math.max(0, toNumber(u.rented, 0)),
        status: trim(u.status) || 'AVAILABLE',
      })),
    };

    setEditBusy(true);
    const res = await apiPatch<Property>(`/properties/${editing.id}`, payload);
    setEditBusy(false);

    if (!res.ok || !res.data?.id) {
      toast.error(res.error || 'Failed to save changes');
      return;
    }

    toast.success('Property updated successfully');
    closeEdit();
    fetchListings();
    fetchUsage();
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
    fetchListings();
    fetchUsage();
  }

  async function handlePublishClick(p: Property) {
    const validation = validatePropertyForPublish(p);
    if (!validation.ok) {
      setIncompleteTarget({ property: p, missing: validation.missing });
      return;
    }

    const latestUsage = await apiGet<UsageResponse>('/subscription/usage', { cache: 'no-store' as any });
    const nextUsage = latestUsage.ok ? latestUsage.data : usage;
    if (latestUsage.ok) setUsage(nextUsage);

    const norm = usagePick(nextUsage || null);
    if (!norm?.activeCount || (norm.listings?.remaining ?? 0) <= 0) {
      setQuotaTarget(p);
      return;
    }

    setPublishTarget(p);
  }

  async function confirmPublish() {
    if (!publishTarget) return;

    setPublishBusy(true);
    const res = await apiPatch<any>(`/properties/${publishTarget.id}/publish`, {});
    setPublishBusy(false);

    if (!res.ok) {
      if (res.status === 402) {
        setPublishTarget(null);
        setQuotaTarget(publishTarget);
        return;
      }
      if (res.status === 400) {
        setPublishTarget(null);
        setIncompleteTarget({ property: publishTarget, missing: (res.data as any)?.missing || propertyMissingFields(publishTarget) });
        return;
      }
      toast.error(res.error || 'Failed to publish listing');
      return;
    }

    toast.success('Listing published successfully');
    setPublishTarget(null);
    fetchListings();
    fetchUsage();
  }

  async function confirmUnpublish() {
    if (!unpublishTarget) return;

    setUnpublishBusy(true);
    const res = await apiPatch(`/properties/${unpublishTarget.id}/status`, { newStatus: 'UNPUBLISHED' });
    setUnpublishBusy(false);

    if (!res.ok) {
      toast.error(res.error || 'Failed to unpublish listing');
      return;
    }

    toast.success('Listing unpublished');
    setUnpublishTarget(null);
    fetchListings();
    fetchUsage();
  }

  async function toggleFeatured(p: Property) {
    const next = !p.featured;
    const res = await apiPatch(`/properties/${p.id}`, { featured: next });
    if (!res.ok) {
      toast.error(res.error || 'Failed to update featured status');
      return;
    }

    toast.success(next ? 'Listing marked as featured' : 'Listing unfeatured');
    fetchListings();
    fetchUsage();
  }

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
                <td colSpan={5} className="p-6 text-center text-gray-600">Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-600">No listings found.</td>
              </tr>
            ) : (
              filtered.map((p) => {
                const unit0 = p.units?.[0];
                const canView = p.status === 'PUBLISHED';

                return (
                  <tr key={p.id} className="border-t align-top">
                    <td className="p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.images?.[0]?.url || '/placeholder.webp'} alt={p.title} className="h-16 w-24 object-cover rounded" />
                    </td>

                    <td className="p-3">
                      <div className="font-medium">{p.title || '(Untitled)'}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {p.location}
                        {p.county ? ` • ${p.county}` : ''}
                        {p.constituency ? `, ${p.constituency}` : ''}
                        {p.ward ? `, ${p.ward}` : ''}
                      </div>

                      <div className="flex gap-3 text-xs text-gray-700 mt-2 flex-wrap">
                        {unit0 ? (
                          <>
                            <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" />{unit0.bedrooms}</span>
                            <span className="flex items-center gap-1"><Bath className="h-4 w-4" />{unit0.bathrooms}</span>
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
                      {unit0?.rent ? <span className="font-semibold">{fmtKES(unit0.rent)}</span> : <span className="text-gray-600">—</span>}
                    </td>

                    <td className="p-3">
                      <div className="flex justify-end gap-2 flex-wrap">
                        {canView ? (
                          <Link href={`/properties/${p.id}`} target="_blank">
                            <Button size="icon" variant="outline" className="text-brand-blue" title="View live">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        ) : (
                          <Button size="icon" variant="outline" className="text-gray-400 cursor-not-allowed" title="Only published listings can be viewed" disabled>
                            <EyeOff className="h-4 w-4" />
                          </Button>
                        )}

                        {p.status !== 'PUBLISHED' ? (
                          <Button variant="outline" className="text-green-700" onClick={() => handlePublishClick(p)} title="Publish">
                            Publish
                          </Button>
                        ) : (
                          <Button variant="outline" className="text-orange-700" onClick={() => setUnpublishTarget(p)} title="Unpublish">
                            Unpublish
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          className={p.featured ? 'text-gray-700' : 'text-yellow-700'}
                          onClick={() => toggleFeatured(p)}
                          title={p.featured ? 'Unfeature' : 'Feature'}
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          {p.featured ? 'Unfeature' : 'Feature'}
                        </Button>

                        <Button size="icon" variant="outline" className="text-green-700" onClick={() => openEdit(p)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button size="icon" variant="outline" className="text-red-600" onClick={() => setDeleting(p)} title="Delete">
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

      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-sm">
        <div>Page <b>{page}</b> of <b>{pages}</b> • Total <b>{total}</b></div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && closeEdit()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Property</DialogTitle>
            <DialogDescription>
              This editor now loads the full listing data and lets the lister update basic info, units, amenities, featured flag, and images.
            </DialogDescription>
          </DialogHeader>

          {!editing || editBusy ? (
            <div className="py-10 flex items-center justify-center text-gray-600 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading property details…
            </div>
          ) : (
            <Tabs value={editingTab} onValueChange={setEditingTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="units">Unit & Amenities</TabsTrigger>
                <TabsTrigger value="images">Images</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 pt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label>Title</Label>
                    <Input value={editForm.title} onChange={(e) => updateEditField('title', e.target.value)} />
                  </div>

                  <div>
                    <Label>Neighborhood / Estate / Locality</Label>
                    <Input value={editForm.location} onChange={(e) => updateEditField('location', e.target.value)} />
                  </div>

                  <div>
                    <Label>County</Label>
                    <select
                      className="w-full border rounded px-3 py-2"
                      value={editForm.county}
                      onChange={(e) => {
                        updateEditField('county', e.target.value);
                        updateEditField('constituency', '');
                        updateEditField('ward', '');
                      }}
                    >
                      <option value="">Select county</option>
                      {countyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <Label>Constituency</Label>
                    <select
                      className="w-full border rounded px-3 py-2"
                      value={editForm.constituency}
                      onChange={(e) => {
                        updateEditField('constituency', e.target.value);
                        updateEditField('ward', '');
                      }}
                    >
                      <option value="">Select constituency</option>
                      {constituencyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <Label>Ward</Label>
                    <select className="w-full border rounded px-3 py-2" value={editForm.ward} onChange={(e) => updateEditField('ward', e.target.value)}>
                      <option value="">Select ward</option>
                      {wardOptions.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={editForm.featured}
                        onChange={(e) => updateEditField('featured', e.target.checked)}
                      />
                      Mark this listing as featured
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <Label>Description</Label>
                    <Textarea value={editForm.description} onChange={(e) => updateEditField('description', e.target.value)} rows={5} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="units" className="space-y-5 pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Units</h3>
                    <p className="text-sm text-gray-600">Update the unit rows and the amenity checklist below.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={addUnit}>Add Unit Row</Button>
                </div>

                <div className="space-y-4">
                  {editForm.units.map((unit, index) => (
                    <div key={unit.id || index} className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">Unit {index + 1}</div>
                        <Button type="button" variant="outline" size="sm" onClick={() => removeUnit(index)} disabled={editForm.units.length <= 1}>
                          Remove
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label>Type</Label>
                          <Input value={unit.type} onChange={(e) => updateUnit(index, { type: e.target.value })} />
                        </div>
                        <div>
                          <Label>Bedrooms</Label>
                          <Input type="number" min={0} value={unit.bedrooms} onChange={(e) => updateUnit(index, { bedrooms: Number(e.target.value) })} />
                        </div>
                        <div>
                          <Label>Bathrooms</Label>
                          <Input type="number" min={0} value={unit.bathrooms} onChange={(e) => updateUnit(index, { bathrooms: Number(e.target.value) })} />
                        </div>
                        <div>
                          <Label>Price (KES)</Label>
                          <Input type="number" min={0} value={unit.rent} onChange={(e) => updateUnit(index, { rent: Number(e.target.value) })} />
                        </div>
                        <div>
                          <Label>Available</Label>
                          <Input type="number" min={0} value={unit.available ?? 0} onChange={(e) => updateUnit(index, { available: Number(e.target.value) })} />
                        </div>
                        <div>
                          <Label>Total Count</Label>
                          <Input type="number" min={1} value={unit.count ?? 1} onChange={(e) => updateUnit(index, { count: Number(e.target.value) })} />
                        </div>
                        <div>
                          <Label>Rented</Label>
                          <Input type="number" min={0} value={unit.rented ?? 0} onChange={(e) => updateUnit(index, { rented: Number(e.target.value) })} />
                        </div>
                        <div>
                          <Label>Status</Label>
                          <Input value={unit.status ?? 'AVAILABLE'} onChange={(e) => updateUnit(index, { status: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="font-semibold">Amenities</h3>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {AMENITIES.map((amenity) => {
                      const active = editForm.amenities.includes(amenity);
                      return (
                        <button
                          key={amenity}
                          type="button"
                          onClick={() => toggleAmenity(amenity)}
                          className={`rounded-lg border px-3 py-2 text-left text-sm ${active ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-gray-200 bg-white text-gray-700'}`}
                        >
                          {amenity}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="images" className="space-y-3 pt-3">
                {editing?.id ? (
                  <ImageUploader
                    propertyId={editing.id}
                    images={editForm.images}
                    onChange={(items) => updateEditField('images', items)}
                    onBusyChange={setImagesBusy}
                  />
                ) : null}
                <p className="text-xs text-gray-600">
                  Image changes are saved immediately when you add or remove them. Save Changes will keep the rest of the property data in sync.
                </p>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={closeEdit} disabled={editBusy}>Cancel</Button>
            <Button onClick={saveChanges} disabled={editBusy || imagesBusy} className="bg-green-600 text-white">
              {editBusy ? 'Saving…' : imagesBusy ? 'Wait for image upload…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete listing?</DialogTitle>
            <DialogDescription>
              <span className="block">You are about to permanently delete <b>{deleting?.title || 'this listing'}</b>.</span>
              <span className="block mt-2">This removes the property record together with its units, amenities, favorites, boosts, and uploaded images.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deleteBusy}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!publishTarget} onOpenChange={(v) => !v && setPublishTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish listing?</DialogTitle>
            <DialogDescription>
              You are about to publish <b>{publishTarget?.title || 'this listing'}</b>. This will consume 1 listing slot.
              {usageNorm?.listings ? ` Remaining after publish: ${Math.max(0, usageNorm.listings.remaining - 1)}.` : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishTarget(null)} disabled={publishBusy}>Cancel</Button>
            <Button className="bg-green-600 text-white" onClick={confirmPublish} disabled={publishBusy}>
              {publishBusy ? 'Publishing…' : 'Confirm Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!unpublishTarget} onOpenChange={(v) => !v && setUnpublishTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unpublish listing?</DialogTitle>
            <DialogDescription>
              <span className="block">You are about to unpublish <b>{trim(unpublishTarget?.title).slice(0, 60) || 'this listing'}</b>.</span>
              <span className="block mt-2">The publishing slot already consumed will not be refunded, and publishing this listing again will consume a fresh slot.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnpublishTarget(null)} disabled={unpublishBusy}>Cancel</Button>
            <Button className="bg-orange-600 text-white" onClick={confirmUnpublish} disabled={unpublishBusy}>
              {unpublishBusy ? 'Unpublishing…' : 'Confirm Unpublish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!quotaTarget} onOpenChange={(v) => !v && setQuotaTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No slots available</DialogTitle>
            <DialogDescription>
              This account does not currently have a free listing slot for <b>{quotaTarget?.title || 'this property'}</b>. Buy or extend a package from Billing, then come back and publish.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Publishing only succeeds when there is an active package and at least one remaining listing slot.</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotaTarget(null)}>Close</Button>
            <Button asChild className="bg-brand-blue text-white hover:bg-black">
              <Link href="/dashboard/lister/billing">Go to Billing</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!incompleteTarget} onOpenChange={(v) => !v && setIncompleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete the listing first</DialogTitle>
            <DialogDescription>
              <span className="block"><b>{incompleteTarget?.property.title || 'This draft'}</b> cannot be published yet.</span>
              <span className="block mt-2">Missing items: {(incompleteTarget?.missing || []).join(', ')}.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 flex gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Open the full listing form, complete all required steps, save, then publish again.</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncompleteTarget(null)}>Close</Button>
            <Button asChild className="bg-brand-blue text-white hover:bg-black">
              <Link href={`/dashboard/lister/list?id=${incompleteTarget?.property.id || ''}`}>Go to Listing Form</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
