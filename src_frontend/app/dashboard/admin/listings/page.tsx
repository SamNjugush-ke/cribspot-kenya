"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Guard from "@/components/auth/Guard";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AMENITIES, KENYA_ADMIN } from "@/lib/constants";
import {
  Eye,
  Loader2,
  Pencil,
  Search,
  Sparkles,
  Star,
  StarOff,
  Trash2,
  UploadCloud,
} from "lucide-react";

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

type ImageItem = { id?: string; url: string };

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
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  featured?: boolean;
  consumedSlot?: boolean;
  images: ImageItem[];
  units: Unit[];
  amenities?: { amenity: { id?: string; name: string } }[];
  lister?: { id?: string; name?: string | null; email?: string | null };
};

type AdminMap = Record<string, { constituencies: Record<string, { wards: string[] }> }>;
const ADMIN: AdminMap = KENYA_ADMIN as unknown as AdminMap;

const DEFAULT_UNIT: Unit = {
  bedrooms: 1,
  bathrooms: 1,
  rent: 0,
  type: "Apartment",
  available: 1,
  count: 1,
  rented: 0,
  status: "AVAILABLE",
};

function fmtDate(v?: string) {
  if (!v) return "—";
  try { return new Date(v).toLocaleString(); } catch { return "—"; }
}

function trim(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function toNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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

export default function AdminListingsPage() {
  return (
    <Guard allowed={["ADMIN", "SUPER_ADMIN"]}>
      <AdminListingsInner />
    </Guard>
  );
}

function AdminListingsInner() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PUBLISHED" | "UNPUBLISHED" | "DRAFT" | "FEATURED">("ALL");

  const [editing, setEditing] = useState<Property | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editingTab, setEditingTab] = useState("basic");
  const [editForm, setEditForm] = useState({
    title: "",
    location: "",
    county: "",
    constituency: "",
    ward: "",
    area: "",
    description: "",
    featured: false,
    amenities: [] as string[],
    units: [newUnit()] as Unit[],
    images: [] as ImageItem[],
  });
  const [imagesBusy, setImagesBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<any>("/properties", { params: { limit: 200 } as any });
      const arr: Property[] = Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data)
        ? res.data
        : [];
      setItems(arr);
    } catch (e: any) {
      setItems([]);
      setErr(e?.message || "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const displayed = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((p) => {
      const text = `${p.title} ${p.location} ${p.county ?? ""} ${p.constituency ?? ""} ${p.ward ?? ""} ${p.lister?.name ?? ""} ${p.lister?.email ?? ""}`.toLowerCase();
      const okSearch = !needle || text.includes(needle);
      const okStatus = statusFilter === "ALL"
        ? true
        : statusFilter === "FEATURED"
        ? !!p.featured
        : p.status === statusFilter;
      return okSearch && okStatus;
    }).sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  }, [items, search, statusFilter]);

  function openEdit(p: Property) {
    setEditing(p);
    setEditingTab("basic");
    setEditForm({
      title: p.title || "",
      location: p.location || "",
      county: p.county || "",
      constituency: p.constituency || "",
      ward: p.ward || "",
      area: p.area || "",
      description: p.description || "",
      featured: !!p.featured,
      amenities: Array.isArray(p.amenities) ? p.amenities.map((a) => a.amenity?.name).filter(Boolean) as string[] : [],
      units: Array.isArray(p.units) && p.units.length ? p.units.map((u) => ({ ...u })) : [newUnit()],
      images: Array.isArray(p.images) ? p.images.map((img) => ({ ...img })) : [],
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setEditBusy(true);
    try {
      const res = await apiPatch(`/admin/properties/${editing.id}`, {
        title: editForm.title,
        location: editForm.location,
        county: editForm.county || null,
        constituency: editForm.constituency || null,
        ward: editForm.ward || null,
        area: editForm.area || null,
        description: editForm.description,
        featured: editForm.featured,
        amenities: editForm.amenities,
        units: editForm.units,
        images: editForm.images,
      });
      if (!res.ok) throw new Error((res.data as any)?.message || res.error || "Failed to save listing");
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to save listing");
    } finally {
      setEditBusy(false);
    }
  }

  async function toggleFeatured(p: Property) {
    const res = await apiPatch(`/admin/properties/${p.id}`, { featured: !p.featured });
    if (!res.ok) return alert((res.data as any)?.message || res.error || "Failed to update featured state");
    await load();
  }

  function askDelete(p: Property) {
    setDeleteTarget(p);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const res = await apiDelete(`/admin/properties/${deleteTarget.id}`, {});
      if (!res.ok) throw new Error((res.data as any)?.message || res.error || "Failed to delete property");
      setDeleteOpen(false);
      setDeleteTarget(null);
      if (editing?.id === deleteTarget.id) setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to delete property");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function uploadImages(files: FileList | null) {
    if (!editing || !files?.length) return;
    setImagesBusy(true);
    try {
      const uploaded: ImageItem[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const token = typeof window !== "undefined" ? localStorage.getItem("rk_token") : null;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/admin/properties/${editing.id}/images`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: fd,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || `Upload failed (${res.status})`);
        uploaded.push({ id: json.id, url: json.url });
      }
      setEditForm((prev) => ({ ...prev, images: [...prev.images, ...uploaded] }));
    } catch (e: any) {
      alert(e?.message || "Failed to upload images");
    } finally {
      setImagesBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeImage(img: ImageItem) {
    if (!editing) return;
    if (!img.id) {
      setEditForm((prev) => ({ ...prev, images: prev.images.filter((x) => x.url !== img.url) }));
      return;
    }
    const res = await apiDelete(`/admin/properties/${editing.id}/images/${img.id}`);
    if (!res.ok) return alert((res.data as any)?.message || res.error || "Failed to remove image");
    setEditForm((prev) => ({ ...prev, images: prev.images.filter((x) => x.id !== img.id) }));
  }

  const counts = useMemo(() => ({
    total: items.length,
    published: items.filter((p) => p.status === "PUBLISHED").length,
    drafts: items.filter((p) => p.status === "DRAFT").length,
    featured: items.filter((p) => p.featured).length,
  }), [items]);

  return (
    <section className="space-y-5">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Listings</h1>
            <p className="text-sm text-muted-foreground mt-1">Preview, edit, delete, feature, and generally keep the marketplace looking less like chaos and more like product.</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Refresh</Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border p-4"><div className="text-sm text-muted-foreground">Total listings</div><div className="mt-1 text-3xl font-bold">{counts.total}</div></div>
          <div className="rounded-2xl border p-4"><div className="text-sm text-muted-foreground">Published</div><div className="mt-1 text-3xl font-bold">{counts.published}</div></div>
          <div className="rounded-2xl border p-4"><div className="text-sm text-muted-foreground">Drafts</div><div className="mt-1 text-3xl font-bold">{counts.drafts}</div></div>
          <div className="rounded-2xl border p-4"><div className="text-sm text-muted-foreground">Featured</div><div className="mt-1 text-3xl font-bold">{counts.featured}</div></div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search title, location, lister..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="border rounded-xl px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="ALL">All statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="UNPUBLISHED">Unpublished</option>
            <option value="DRAFT">Draft</option>
            <option value="FEATURED">Featured</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {displayed.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-3xl border bg-white shadow-sm ring-1 ring-black/5">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.images?.[0]?.url || "/placeholder.jpg"} alt={p.title} className="h-52 w-full object-cover bg-slate-100" />
              <div className="absolute left-3 top-3 flex gap-2">
                <Badge variant="secondary">{p.status}</Badge>
                {p.featured ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Featured</Badge> : null}
              </div>
            </div>
            <div className="p-4">
              <div className="line-clamp-1 text-lg font-semibold">{p.title}</div>
              <div className="mt-1 line-clamp-1 text-sm text-muted-foreground">{p.location}{p.county ? `, ${p.county}` : ""}</div>
              <div className="mt-3 text-sm text-muted-foreground">
                <div>Lister: {p.lister?.name || "—"}</div>
                <div>{p.lister?.email || "—"}</div>
                <div>Updated: {fmtDate(p.updatedAt || p.createdAt)}</div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/properties/${p.id}`} target="_blank"><Eye className="mr-2 h-4 w-4" /> Preview</Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
                <Button size="sm" variant="outline" onClick={() => toggleFeatured(p)}>
                  {p.featured ? <StarOff className="mr-2 h-4 w-4" /> : <Star className="mr-2 h-4 w-4" />}
                  {p.featured ? "Unfeature" : "Feature"}
                </Button>
                <Button size="sm" variant="outline" className="border-red-300 text-red-700" onClick={() => askDelete(p)}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && !displayed.length ? <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No listings match the current filters.</div> : null}
      {err ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div> : null}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit listing</DialogTitle>
            <DialogDescription>Admins can review and update the same core sections listers use.</DialogDescription>
          </DialogHeader>

          <Tabs value={editingTab} onValueChange={setEditingTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="units">Unit & Amenities</TabsTrigger>
              <TabsTrigger value="images">Images</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Title</Label>
                  <Input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={editForm.location} onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))} />
                </div>
                <div>
                  <Label>County</Label>
                  <select className="w-full rounded-xl border px-3 py-2" value={editForm.county} onChange={(e) => setEditForm((p) => ({ ...p, county: e.target.value, constituency: "", ward: "" }))}>
                    <option value="">Select county</option>
                    {buildCountyOptions(editForm.county).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Constituency</Label>
                  <select className="w-full rounded-xl border px-3 py-2" value={editForm.constituency} onChange={(e) => setEditForm((p) => ({ ...p, constituency: e.target.value, ward: "" }))}>
                    <option value="">Select constituency</option>
                    {buildConstituencyOptions(editForm.county, editForm.constituency).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Ward</Label>
                  <select className="w-full rounded-xl border px-3 py-2" value={editForm.ward} onChange={(e) => setEditForm((p) => ({ ...p, ward: e.target.value }))}>
                    <option value="">Select ward</option>
                    {buildWardOptions(editForm.county, editForm.constituency, editForm.ward).map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Area / estate</Label>
                  <Input value={editForm.area} onChange={(e) => setEditForm((p) => ({ ...p, area: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea rows={6} value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.featured} onChange={(e) => setEditForm((p) => ({ ...p, featured: e.target.checked }))} />
                Feature this listing
              </label>
            </TabsContent>

            <TabsContent value="units" className="space-y-4 pt-4">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <Label className="text-base font-semibold">Units</Label>
                  <Button variant="outline" type="button" onClick={() => setEditForm((p) => ({ ...p, units: [...p.units, newUnit()] }))}>Add unit</Button>
                </div>
                <div className="space-y-3">
                  {editForm.units.map((unit, idx) => (
                    <div key={idx} className="rounded-2xl border p-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div><Label>Type</Label><Input value={unit.type} onChange={(e) => setEditForm((p) => ({ ...p, units: p.units.map((u, i) => i === idx ? { ...u, type: e.target.value } : u) }))} /></div>
                        <div><Label>Bedrooms</Label><Input type="number" value={unit.bedrooms} onChange={(e) => setEditForm((p) => ({ ...p, units: p.units.map((u, i) => i === idx ? { ...u, bedrooms: toNumber(e.target.value) } : u) }))} /></div>
                        <div><Label>Bathrooms</Label><Input type="number" value={unit.bathrooms} onChange={(e) => setEditForm((p) => ({ ...p, units: p.units.map((u, i) => i === idx ? { ...u, bathrooms: toNumber(e.target.value) } : u) }))} /></div>
                        <div><Label>Rent</Label><Input type="number" value={unit.rent} onChange={(e) => setEditForm((p) => ({ ...p, units: p.units.map((u, i) => i === idx ? { ...u, rent: toNumber(e.target.value) } : u) }))} /></div>
                        <div><Label>Available</Label><Input type="number" value={unit.available ?? 0} onChange={(e) => setEditForm((p) => ({ ...p, units: p.units.map((u, i) => i === idx ? { ...u, available: toNumber(e.target.value) } : u) }))} /></div>
                        <div><Label>Total count</Label><Input type="number" value={unit.count ?? 1} onChange={(e) => setEditForm((p) => ({ ...p, units: p.units.map((u, i) => i === idx ? { ...u, count: toNumber(e.target.value, 1) } : u) }))} /></div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button variant="outline" className="border-red-300 text-red-700" type="button" onClick={() => setEditForm((p) => ({ ...p, units: p.units.filter((_, i) => i !== idx) || [newUnit()] }))}>Remove unit</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold">Amenities</Label>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {AMENITIES.map((name) => {
                    const checked = editForm.amenities.includes(name);
                    return (
                      <label key={name} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setEditForm((p) => ({
                            ...p,
                            amenities: e.target.checked ? [...p.amenities, name] : p.amenities.filter((x) => x !== name),
                          }))}
                        />
                        {name}
                      </label>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="images" className="space-y-4 pt-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <Label className="text-base font-semibold">Images</Label>
                  <p className="text-sm text-muted-foreground mt-1">Upload fresh images or remove existing ones.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadImages(e.target.files)} />
                  <Button variant="outline" type="button" onClick={() => fileRef.current?.click()} disabled={imagesBusy}>
                    {imagesBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />} Upload images
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {editForm.images.map((img) => (
                  <div key={img.id || img.url} className="overflow-hidden rounded-2xl border bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="Listing" className="h-40 w-full object-cover" />
                    <div className="p-3">
                      <Button variant="outline" className="w-full border-red-300 text-red-700" type="button" onClick={() => removeImage(img)}>Remove</Button>
                    </div>
                  </div>
                ))}
                {!editForm.images.length ? <div className="col-span-full rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No images on this listing yet.</div> : null}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={editBusy}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editBusy} className="bg-slate-900 hover:bg-slate-800">
              {editBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete property</DialogTitle>
            <DialogDescription>
              This will permanently delete the listing and all related units, images, favorites, boosts, and amenity links.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border bg-slate-50 p-4 text-sm">
            <div className="font-medium">{deleteTarget?.title}</div>
            <div className="text-muted-foreground">{deleteTarget?.location}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Delete property
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
