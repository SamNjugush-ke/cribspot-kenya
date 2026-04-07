"use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/auth/Guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import ReasonConfirmModal from "@/components/super/ReasonConfirmModal";
import { adminFetch } from "@/lib/adminFetch";
import {
  Eye,
  Pencil,
  Star,
  StarOff,
  BedDouble,
  Bath,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Link as LinkIcon,
} from "lucide-react";

type ListingStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";

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

type Img = {
  id?: string;
  url: string;
};

type AmenityRow = { amenity: { id: string; name: string } };

type Property = {
  id: string;
  title: string;
  description?: string | null;
  location: string | null;
  county: string | null;
  constituency?: string | null;
  ward?: string | null;
  area?: string | null;
  status: ListingStatus;
  featured: boolean;
  createdAt: string;
  images?: Img[];
  units?: Unit[];
  amenities?: AmenityRow[];
  lister?: { id: string; name: string | null; email: string; phone?: string | null };
};

type Amenity = { id: string; name: string };

const STATUSES: ListingStatus[] = ["PUBLISHED", "UNPUBLISHED", "DRAFT", "ARCHIVED"];

function statusPillClass(active: boolean) {
  return active ? "bg-brand-blue text-white" : "bg-gray-100 text-gray-800 hover:bg-gray-200";
}

function normalizeAmenityNamesFromProperty(p?: Property | null): string[] {
  const rows = p?.amenities ?? [];
  return rows.map((r) => r.amenity.name);
}

function summarizeUnits(p: Property) {
  const u0 = p.units?.[0];
  const bedrooms = u0?.bedrooms ?? null;
  const bathrooms = u0?.bathrooms ?? null;
  const rents = (p.units ?? []).map((u) => Number(u.rent) || 0).filter((n) => n > 0);
  const minRent = rents.length ? Math.min(...rents) : null;
  return { bedrooms, bathrooms, minRent };
}

export default function ListingsPage() {
  return (
    <Guard allowed={["SUPER_ADMIN"]}>
      <ListingsInner />
    </Guard>
  );
}

function ListingsInner() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [q, setQ] = useState("");
  const [county, setCounty] = useState("ALL");
  const [status, setStatus] = useState<"ALL" | ListingStatus>("ALL");
  const [featured, setFeatured] = useState<"ALL" | "YES" | "NO">("ALL");

  // sort
  const [sort, setSort] = useState<{ field: "createdAt" | "title"; dir: "asc" | "desc" }>({
    field: "createdAt",
    dir: "desc",
  });

  // edit modal
  const [editing, setEditing] = useState<Property | null>(null);
  const [editTab, setEditTab] = useState<"basics" | "units" | "images" | "amenities">("basics");
  const [dirty, setDirty] = useState(false);

  // edit draft (full)
  const [draft, setDraft] = useState<Partial<Property>>({});
  const [draftUnits, setDraftUnits] = useState<Unit[]>([]);
  const [draftImages, setDraftImages] = useState<Img[]>([]);
  const [allAmenities, setAllAmenities] = useState<Amenity[]>([]);
  const [selectedAmenityNames, setSelectedAmenityNames] = useState<string[]>([]);
  const [newAmenityName, setNewAmenityName] = useState("");

  // confirm modal (ONLY for audited actions)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmAction, setConfirmAction] = useState<null | ((reason: string) => Promise<void>)>(null);

  useEffect(() => {
    load();
    loadAmenities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      setLoading(true);
      // list endpoint (admin=1 returns all statuses)
      const data = await adminFetch<any>(`/api/properties?admin=1`);
      setItems(data?.items || data || []);
    } finally {
      setLoading(false);
    }
  }

  async function loadAmenities() {
    try {
      const data = await adminFetch<Amenity[]>(`/api/amenities`);
      setAllAmenities(Array.isArray(data) ? data : []);
    } catch {
      setAllAmenities([]);
    }
  }

  function confirmModeration(title: string, action: (reason: string) => Promise<void>) {
    setConfirmTitle(title);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  }

  async function adminPatchProperty(id: string, payload: any) {
    return await adminFetch(`/api/admin/properties/${id}`, { method: "PATCH", json: payload });
  }

  async function fetchAdminDetails(id: string): Promise<Property> {
    // Public details includes units/images/amenities regardless of status
    // (If you later lock it down, create /api/admin/properties/:id/details)
    return await adminFetch<Property>(`/api/properties/${id}/details`);
  }

  const displayed = useMemo(() => {
    let out = [...items];

    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter((p) => {
        const text = `${p.title} ${p.location ?? ""} ${p.county ?? ""}`.toLowerCase();
        return text.includes(needle);
      });
    }

    if (county !== "ALL") out = out.filter((p) => (p.county ?? "") === county);
    if (status !== "ALL") out = out.filter((p) => p.status === status);
    if (featured !== "ALL") out = out.filter((p) => (featured === "YES" ? p.featured : !p.featured));

    out.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.field === "title") return dir * a.title.localeCompare(b.title);
      return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

    return out;
  }, [items, q, county, status, featured, sort]);

  async function openEdit(p: Property) {
    const full = await fetchAdminDetails(p.id);
    setEditing(full);

    setDraft({
      id: full.id,
      title: full.title,
      location: full.location ?? "",
      county: full.county ?? "",
      constituency: full.constituency ?? "",
      ward: full.ward ?? "",
      area: full.area ?? "",
      description: full.description ?? "",
      status: full.status,
      featured: full.featured,
    });

    setDraftUnits((full.units ?? []).map((u) => ({ ...u })));
    setDraftImages((full.images ?? []).map((img) => ({ ...img })));
    setSelectedAmenityNames(normalizeAmenityNamesFromProperty(full));

    setEditTab("basics");
    setDirty(false);
  }

  function setStatusInline(p: Property, next: ListingStatus) {
    if (p.status === next) return;
    confirmModeration(`Set status → ${next}`, async (reason) => {
      await adminPatchProperty(p.id, { status: next, reason });
      await load();
    });
  }

  function quickTogglePublish(p: Property) {
    const next: ListingStatus =
      p.status === "PUBLISHED" ? "UNPUBLISHED" : p.status === "UNPUBLISHED" ? "PUBLISHED" : "UNPUBLISHED";

    confirmModeration(`Quick toggle → ${next}`, async (reason) => {
      await adminPatchProperty(p.id, { status: next, reason });
      await load();
    });
  }

  async function saveAll(reason: string) {
    if (!editing) return;

    const payload = {
      title: draft.title,
      location: draft.location,
      county: draft.county,
      constituency: draft.constituency,
      ward: draft.ward,
      area: draft.area,
      description: draft.description,
      status: draft.status,
      featured: !!draft.featured,

      units: draftUnits,
      images: draftImages,
      amenities: selectedAmenityNames,

      reason,
    };

    await adminPatchProperty(editing.id, payload);

    setEditing(null);
    setDirty(false);
    await load();
  }

  async function toggleFeaturedInline(p: Property) {
    confirmModeration(`${p.featured ? "Unfeature" : "Feature"} listing`, async (reason) => {
      await adminPatchProperty(p.id, { featured: !p.featured, reason });
      await load();
    });
  }

  async function createAmenityInline() {
    const name = newAmenityName.trim();
    if (!name) return;

    confirmModeration(`Create amenity: ${name}`, async (_reason) => {
      await adminFetch(`/api/amenities`, { method: "POST", json: { name } });
      setNewAmenityName("");
      await loadAmenities();
    });
  }

  const counties = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.county).filter(Boolean))) as string[];
  }, [items]);

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Listings</h1>
          <p className="text-sm opacity-70">Super Admin: view & edit everything (audited on change).</p>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSort({ field: "createdAt", dir: sort.dir })}>
            Sort: Created
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSort({ field: "title", dir: sort.dir })}>
            Sort: Title
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSort((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }))}
          >
            Dir: {sort.dir.toUpperCase()}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="relative w-full md:w-1/2">
          <Input
            placeholder="Search title/location/county…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pr-10"
          />
          <span className="absolute right-3 top-2.5 opacity-50">⌕</span>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <select value={county} onChange={(e) => setCounty(e.target.value)} className="border rounded px-3 py-2 text-sm">
            <option value="ALL">All Counties</option>
            {counties.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="border rounded px-3 py-2 text-sm">
            <option value="ALL">All Status</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="UNPUBLISHED">UNPUBLISHED</option>
            <option value="DRAFT">DRAFT</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>

          <select value={featured} onChange={(e) => setFeatured(e.target.value as any)} className="border rounded px-3 py-2 text-sm">
            <option value="ALL">All</option>
            <option value="YES">Featured: Yes</option>
            <option value="NO">Featured: No</option>
          </select>

          <Button size="sm" variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="space-y-3">
          {displayed.map((p) => {
            const hero = p.images?.[0]?.url || "/placeholder.webp";
            const { bedrooms, bathrooms, minRent } = summarizeUnits(p);
            const amenityNames = (p.amenities ?? []).slice(0, 5).map((a) => a.amenity.name);
            const moreAmenityCount = Math.max(0, (p.amenities ?? []).length - amenityNames.length);

            return (
              <div key={p.id} className="rounded-2xl border bg-white p-3 md:p-4 shadow-sm">
                <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                  {/* thumb */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={hero}
                    alt={p.title}
                    className="h-24 w-full md:h-24 md:w-36 object-cover rounded-xl border"
                  />

                  {/* info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-base md:text-lg truncate">{p.title}</div>
                        <div className="text-sm opacity-70 truncate">
                          {(p.location ?? "—") + (p.county ? ` • ${p.county}` : "")}
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs opacity-80 mt-2">
                          {bedrooms !== null && (
                            <span className="flex items-center gap-1">
                              <BedDouble className="h-4 w-4" />
                              {bedrooms} beds
                            </span>
                          )}
                          {bathrooms !== null && (
                            <span className="flex items-center gap-1">
                              <Bath className="h-4 w-4" />
                              {bathrooms} baths
                            </span>
                          )}
                          <span className="opacity-80">Added: {new Date(p.createdAt).toLocaleDateString()}</span>
                          {minRent !== null && <span className="font-medium">From KES {minRent.toLocaleString()}</span>}
                        </div>

                        {/* amenities preview */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {amenityNames.map((n) => (
                            <Badge key={n} variant="secondary" className="rounded-full">
                              {n}
                            </Badge>
                          ))}
                          {moreAmenityCount > 0 && (
                            <Badge variant="secondary" className="rounded-full">
                              +{moreAmenityCount} more
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* actions */}
                      <div className="flex flex-wrap gap-2 justify-end">
                        {/* VIEW: no reason prompt, open property page */}
                        <a href={`/properties/${p.id}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline">
                            <Eye className="w-4 h-4" /> View
                          </Button>
                        </a>

                        {/* EDIT: no reason prompt on open */}
                        <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                          <Pencil className="w-4 h-4" /> Edit
                        </Button>

                        {/* featured (audited) */}
                        <Button size="sm" variant="outline" onClick={() => toggleFeaturedInline(p)}>
                          {p.featured ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                          {p.featured ? "Unfeature" : "Feature"}
                        </Button>
                      </div>
                    </div>

                    {/* status area (explicit chips) */}
                    <div className="mt-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs opacity-70 mr-1">Status:</span>
                        {STATUSES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className={`text-xs px-3 py-1 rounded-full border transition ${statusPillClass(p.status === s)}`}
                            onClick={() => setStatusInline(p, s)}
                            title={`Set status to ${s}`}
                          >
                            {s}
                          </button>
                        ))}

                        {p.featured && <Badge className="bg-yellow-500 text-white rounded-full">Featured</Badge>}
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => quickTogglePublish(p)}>
                          Quick: {p.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                        </Button>
                      </div>

                      <div className="ml-auto text-xs opacity-70">
                        Lister: {p.lister?.email ?? "—"}
                        {p.lister?.phone ? ` • ${p.lister.phone}` : ""}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {!displayed.length && (
            <div className="rounded-xl border bg-white p-6 text-center text-gray-500">
              No listings match your query.
            </div>
          )}
        </div>
      )}

      {/* Edit modal */}
      <Dialog open={!!editing} onOpenChange={(o) => (!o ? setEditing(null) : null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Edit Listing (Super Admin)</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <Tabs value={editTab} onValueChange={(v) => setEditTab(v as any)}>
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="basics">Basics</TabsTrigger>
                  <TabsTrigger value="units">Units</TabsTrigger>
                  <TabsTrigger value="images">Images</TabsTrigger>
                  <TabsTrigger value="amenities">Amenities</TabsTrigger>
                </TabsList>

                {/* BASICS */}
                <TabsContent value="basics" className="space-y-3 max-h-[55vh] overflow-auto pr-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      placeholder="Title"
                      value={String(draft.title ?? "")}
                      onChange={(e) => {
                        setDraft((d) => ({ ...d, title: e.target.value }));
                        setDirty(true);
                      }}
                    />
                    <Input
                      placeholder="Location"
                      value={String(draft.location ?? "")}
                      onChange={(e) => {
                        setDraft((d) => ({ ...d, location: e.target.value }));
                        setDirty(true);
                      }}
                    />
                    <Input
                      placeholder="County"
                      value={String(draft.county ?? "")}
                      onChange={(e) => {
                        setDraft((d) => ({ ...d, county: e.target.value }));
                        setDirty(true);
                      }}
                    />
                    <Input
                      placeholder="Constituency"
                      value={String(draft.constituency ?? "")}
                      onChange={(e) => {
                        setDraft((d) => ({ ...d, constituency: e.target.value }));
                        setDirty(true);
                      }}
                    />
                    <Input
                      placeholder="Ward"
                      value={String(draft.ward ?? "")}
                      onChange={(e) => {
                        setDraft((d) => ({ ...d, ward: e.target.value }));
                        setDirty(true);
                      }}
                    />
                    <Input
                      placeholder="Area"
                      value={String(draft.area ?? "")}
                      onChange={(e) => {
                        setDraft((d) => ({ ...d, area: e.target.value }));
                        setDirty(true);
                      }}
                    />
                  </div>

                  <Textarea
                    placeholder="Description"
                    value={String(draft.description ?? "")}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, description: e.target.value }));
                      setDirty(true);
                    }}
                    className="min-h-[140px]"
                  />

                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm opacity-70 mr-1">Status:</span>
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`text-xs px-3 py-1 rounded-full border transition ${statusPillClass(draft.status === s)}`}
                        onClick={() => {
                          setDraft((d) => ({ ...d, status: s }));
                          setDirty(true);
                        }}
                      >
                        {s}
                      </button>
                    ))}

                    <label className="ml-auto flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!draft.featured}
                        onChange={(e) => {
                          setDraft((d) => ({ ...d, featured: e.target.checked }));
                          setDirty(true);
                        }}
                      />
                      Featured
                    </label>
                  </div>
                </TabsContent>

                {/* UNITS */}
                <TabsContent value="units" className="space-y-3 max-h-[55vh] overflow-auto pr-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm opacity-70">Add/edit multiple units. Saves as replace-all.</div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDraftUnits((u) => [
                          ...u,
                          {
                            bedrooms: 0,
                            bathrooms: 0,
                            rent: 0,
                            type: "Apartment",
                            available: 0,
                            count: 1,
                            rented: 0,
                            status: "AVAILABLE",
                          },
                        ]);
                        setDirty(true);
                      }}
                    >
                      <Plus className="w-4 h-4" /> Add unit
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {draftUnits.map((u, idx) => (
                      <div key={idx} className="rounded-xl border p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">Unit #{idx + 1}</div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            onClick={() => {
                              setDraftUnits((arr) => arr.filter((_, i) => i !== idx));
                              setDirty(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" /> Remove
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                          <Input
                            type="number"
                            placeholder="Bedrooms"
                            value={u.bedrooms}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              setDraftUnits((arr) => arr.map((x, i) => (i === idx ? { ...x, bedrooms: v } : x)));
                              setDirty(true);
                            }}
                          />
                          <Input
                            type="number"
                            placeholder="Bathrooms"
                            value={u.bathrooms}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              setDraftUnits((arr) => arr.map((x, i) => (i === idx ? { ...x, bathrooms: v } : x)));
                              setDirty(true);
                            }}
                          />
                          <Input
                            type="number"
                            placeholder="Rent (KES)"
                            value={u.rent}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              setDraftUnits((arr) => arr.map((x, i) => (i === idx ? { ...x, rent: v } : x)));
                              setDirty(true);
                            }}
                          />
                          <Input
                            placeholder="Type (e.g. Apartment)"
                            value={u.type}
                            onChange={(e) => {
                              const v = e.target.value;
                              setDraftUnits((arr) => arr.map((x, i) => (i === idx ? { ...x, type: v } : x)));
                              setDirty(true);
                            }}
                          />

                          <Input
                            type="number"
                            placeholder="Count"
                            value={u.count ?? 1}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 1;
                              setDraftUnits((arr) => arr.map((x, i) => (i === idx ? { ...x, count: v } : x)));
                              setDirty(true);
                            }}
                          />
                          <Input
                            type="number"
                            placeholder="Available"
                            value={u.available ?? 0}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              setDraftUnits((arr) => arr.map((x, i) => (i === idx ? { ...x, available: v } : x)));
                              setDirty(true);
                            }}
                          />
                          <Input
                            type="number"
                            placeholder="Rented"
                            value={u.rented ?? 0}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 0;
                              setDraftUnits((arr) => arr.map((x, i) => (i === idx ? { ...x, rented: v } : x)));
                              setDirty(true);
                            }}
                          />
                          <Input
                            placeholder="Status (e.g. AVAILABLE)"
                            value={u.status ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setDraftUnits((arr) => arr.map((x, i) => (i === idx ? { ...x, status: v } : x)));
                              setDirty(true);
                            }}
                          />
                        </div>
                      </div>
                    ))}

                    {!draftUnits.length && <div className="text-sm opacity-70 rounded-xl border p-4">No units.</div>}
                  </div>
                </TabsContent>

                {/* IMAGES */}
                <TabsContent value="images" className="space-y-3 max-h-[55vh] overflow-auto pr-1">
                  <div className="text-sm opacity-70">
                    Thumbnail is the <b>first</b> image. Reorder to set a new thumbnail.
                  </div>

                  <AddImageByUrl
                    onAdd={(url) => {
                      setDraftImages((imgs) => [...imgs, { url }]);
                      setDirty(true);
                    }}
                  />

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {draftImages.map((img, idx) => (
                      <div key={img.id ?? `${img.url}-${idx}`} className="rounded-xl border p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt="img" className="h-24 w-full object-cover rounded-lg border" />

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="text-xs opacity-70">{idx === 0 ? "Thumbnail" : `#${idx + 1}`}</div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              disabled={idx === 0}
                              onClick={() => {
                                setDraftImages((arr) => {
                                  const a = [...arr];
                                  const [x] = a.splice(idx, 1);
                                  a.splice(idx - 1, 0, x);
                                  return a;
                                });
                                setDirty(true);
                              }}
                            >
                              <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              disabled={idx === draftImages.length - 1}
                              onClick={() => {
                                setDraftImages((arr) => {
                                  const a = [...arr];
                                  const [x] = a.splice(idx, 1);
                                  a.splice(idx + 1, 0, x);
                                  return a;
                                });
                                setDirty(true);
                              }}
                            >
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="text-red-600"
                              onClick={() => {
                                setDraftImages((arr) => arr.filter((_, i) => i !== idx));
                                setDirty(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-2">
                          <Input
                            value={img.url}
                            onChange={(e) => {
                              const v = e.target.value;
                              setDraftImages((arr) => arr.map((x, i) => (i === idx ? { ...x, url: v } : x)));
                              setDirty(true);
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {!draftImages.length && <div className="text-sm opacity-70 rounded-xl border p-4">No images.</div>}
                </TabsContent>

                {/* AMENITIES */}
                <TabsContent value="amenities" className="space-y-3 max-h-[55vh] overflow-auto pr-1">
                  <div className="flex flex-col md:flex-row gap-2 md:items-center">
                    <Input
                      placeholder="Create new amenity (e.g. Borehole)"
                      value={newAmenityName}
                      onChange={(e) => setNewAmenityName(e.target.value)}
                    />
                    <Button size="sm" variant="outline" onClick={createAmenityInline}>
                      <Plus className="w-4 h-4" /> Create
                    </Button>
                  </div>

                  <div className="rounded-xl border p-3">
                    <div className="text-sm font-medium mb-2">Select amenities</div>
                    <div className="flex flex-wrap gap-2">
                      {allAmenities.map((a) => {
                        const active = selectedAmenityNames.includes(a.name);
                        return (
                          <button
                            key={a.id}
                            type="button"
                            className={`text-xs px-3 py-1 rounded-full border transition ${
                              active ? "bg-brand-blue text-white" : "bg-gray-100 hover:bg-gray-200"
                            }`}
                            onClick={() => {
                              setSelectedAmenityNames((prev) =>
                                prev.includes(a.name) ? prev.filter((x) => x !== a.name) : [...prev, a.name]
                              );
                              setDirty(true);
                            }}
                          >
                            {a.name}
                          </button>
                        );
                      })}
                    </div>

                    {!allAmenities.length && <div className="text-sm opacity-70">No amenities loaded.</div>}
                  </div>
                </TabsContent>
              </Tabs>

              {/* footer */}
              <div className="flex items-center justify-between gap-2 pt-2">
                <div className="text-xs opacity-70">Reason required only when saving (audited).</div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(null)}>
                    Close
                  </Button>

                  <Button
                    className="bg-brand-blue text-white"
                    disabled={!dirty}
                    onClick={() =>
                      confirmModeration("Save listing changes", async (reason) => {
                        await saveAll(reason);
                      })
                    }
                  >
                    Save (requires reason)
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reason modal */}
      <ReasonConfirmModal
        open={confirmOpen}
        title={confirmTitle}
        confirmText="Apply"
        onClose={() => setConfirmOpen(false)}
        onConfirm={async (reason) => {
          setConfirmOpen(false);
          if (!confirmAction) return;
          await confirmAction(reason);
        }}
      />
    </section>
  );
}

function AddImageByUrl({ onAdd }: { onAdd: (url: string) => void }) {
  const [url, setUrl] = useState("");

  return (
    <div className="flex flex-col md:flex-row gap-2 w-full">
      <div className="relative flex-1">
        <Input
          placeholder="Add image URL (https://...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="pl-10"
        />
        <LinkIcon className="absolute left-3 top-2.5 h-5 w-5 opacity-50" />
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const v = url.trim();
          if (!v) return;
          onAdd(v);
          setUrl("");
        }}
      >
        <Plus className="w-4 h-4" /> Add
      </Button>
    </div>
  );
}
