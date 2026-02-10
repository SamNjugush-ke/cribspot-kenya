// frontend/src/app/lister/list/page.tsx
"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import UnitEditor from "@/components/listing/UnitEditor";
import ImageUploader from "@/components/listing/ImageUploader";
import { MinusCircle, PlusCircle, Trash2 } from "lucide-react";
import { AMENITIES, KENYA_ADMIN } from "@/lib/constants";

type Unit = {
  id?: string;
  bedrooms: number;
  bathrooms: number;
  rent: number;
  available: number;
  type: string;
};

type Prop = {
  id: string;
  title: string;
  description: string;
  location: string;
  county?: string | null;
  constituency?: string | null;
  ward?: string | null;
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  units: Unit[];
  images: { id?: string; url: string }[];
  amenities?: { amenity: { id: string; name: string } }[];
  updatedAt?: string;
};

type DraftPayload = Partial<{
  title: string;
  description: string;
  location: string;
  county: string | null;
  constituency: string | null;
  ward: string | null;
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  units: Unit[];
  images: { id?: string; url: string }[];
  amenities: string[];
}>;

type AdminMap = Record<string, { constituencies: Record<string, { wards: string[] }> }>;
const ADMIN: AdminMap = KENYA_ADMIN as unknown as AdminMap;

async function createDraft(payload: DraftPayload) {
  const res = await apiPost<Prop>("/api/properties", payload);
  if (!res.ok || !res.data) throw new Error((res.data as any)?.message || `Draft create failed (${res.status})`);
  return res.data;
}

async function updateDraft(id: string, payload: DraftPayload) {
  const res = await apiPatch<Prop>(`/api/properties/${id}`, payload);
  if (!res.ok || !res.data) throw new Error((res.data as any)?.message || `Draft save failed (${res.status})`);
  return res.data;
}

async function publishListing(id: string) {
  const res = await apiPatch<Prop>(`/api/properties/${id}/publish`, {});
  if (!res.ok || !res.data) throw new Error((res.data as any)?.message || `Publish failed (${res.status})`);
  return res.data;
}

/**
 * Next.js App Router: useSearchParams() must be under a Suspense boundary.
 */
export default function ListerListPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ListingFlowInner />
    </Suspense>
  );
}

function ListingFlowInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const existingId = sp.get("id");

  const [drafts, setDrafts] = useState<Prop[]>([]);
  const [property, setProperty] = useState<Prop | null>(null);

  const [open1, setOpen1] = useState(true);
  const [open2, setOpen2] = useState(false);
  const [open3, setOpen3] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [county, setCounty] = useState("");
  const [constituency, setConstituency] = useState("");
  const [ward, setWard] = useState("");
  const [description, setDescription] = useState("");

  const [units, setUnits] = useState<Unit[]>([]);
  const [amenityNames, setAmenityNames] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadDrafts = useCallback(async () => {
    const res = await apiGet<{ items: Prop[] }>("/api/properties/mine?status=DRAFT");
    if (res.ok && res.data?.items) setDrafts(res.data.items);
  }, []);
  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  useEffect(() => {
    if (!existingId) return;
    (async () => {
      const res = await apiGet<Prop>(`/api/properties/${existingId}`);
      if (!res.ok || !res.data) return;

      const p = res.data;
      setProperty(p);

      setTitle(p.title || "");
      setLocation(p.location || "");
      setCounty(p.county || "");
      setConstituency(p.constituency || "");
      setWard(p.ward || "");
      setDescription(p.description || "");

      setUnits(p.units || []);
      setImageUrls((p.images || []).map((i) => i.url));
      setAmenityNames((p.amenities || []).map((a) => a.amenity?.name).filter(Boolean as any));

      setOpen1(true);
      setOpen2(true);
      setOpen3(false);
      setShowReview(false);
      setMsg(null);
      setError(null);
    })();
  }, [existingId]);

  const countyOptions = useMemo(() => Object.keys(ADMIN).sort(), []);
  const constituencyOptions = useMemo(
    () => (county ? Object.keys(ADMIN[county]?.constituencies || {}).sort() : []),
    [county]
  );
  const wardOptions = useMemo(
    () => (county && constituency ? (ADMIN[county]?.constituencies[constituency]?.wards || []).slice().sort() : []),
    [county, constituency]
  );

  const step1Valid =
    !!title.trim() &&
    !!location.trim() &&
    !!county &&
    !!constituency &&
    !!ward &&
    !!description.trim();

  const step2Valid = units.length > 0 && units.every((u) => u.type && u.rent >= 0);
  const step3Valid = imageUrls.length > 0;
  const canReview = step1Valid && step2Valid && step3Valid;

  // debounced autosave
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchAutoSave = useCallback(
    (patch: DraftPayload) => {
      if (!property) return;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        try {
          const updated = await updateDraft(property.id, patch);
          setProperty(updated);
          setMsg("Saved");
        } catch (e: any) {
          setError(e?.message || "Auto-save failed");
        }
      }, 600);
    },
    [property]
  );

  const nextFromStep1 = async () => {
    setMsg(null);
    setError(null);
    if (!step1Valid) return setError("Fill all Step 1 fields.");

    try {
      setLoading(true);
      if (!property) {
        const p = await createDraft({
          title,
          location,
          description,
          county,
          constituency,
          ward,
          status: "DRAFT",
          amenities: amenityNames,
        });
        setProperty(p);
        setMsg("Draft created.");
      } else {
        await updateDraft(property.id, { title, location, description, county, constituency, ward, amenities: amenityNames });
        setMsg("Saved.");
      }
      setOpen1(false);
      setOpen2(true);
    } catch (e: any) {
      setError(e?.message || "Failed to create/update draft");
    } finally {
      setLoading(false);
    }
  };

  const nextFromStep2 = async () => {
    setMsg(null);
    setError(null);
    if (!property) return setError("Create draft first.");
    if (!step2Valid) return setError("Complete units.");

    try {
      setLoading(true);
      const updated = await updateDraft(property.id, { units, amenities: amenityNames });
      setProperty(updated);
      setOpen2(false);
      setOpen3(true);
      setMsg("Units saved.");
    } catch (e: any) {
      setError(e?.message || "Failed to save units");
    } finally {
      setLoading(false);
    }
  };

  const goReview = () => {
    setMsg(null);
    setError(null);
    if (!canReview) return setError("Complete Steps 1–3.");
    setOpen1(false);
    setOpen2(false);
    setOpen3(false);
    setShowReview(true);
  };

  const publish = async () => {
    if (!property) return;
    setLoading(true);
    setConfirmOpen(false);
    setMsg(null);
    setError(null);

    try {
      await publishListing(property.id);
      router.replace(`/properties/${property.id}`);
    } catch (e: any) {
      setError(e?.message || "Failed to publish");
    } finally {
      setLoading(false);
    }
  };

  const discardDraft = async (id: string) => {
    if (!confirm("Discard this draft?")) return;

    const res = await apiDelete(`/api/properties/${id}`);
    if (res.ok) {
      if (property?.id === id) {
        setProperty(null);
        setTitle("");
        setLocation("");
        setCounty("");
        setConstituency("");
        setWard("");
        setDescription("");
        setUnits([]);
        setImageUrls([]);
        setAmenityNames([]);
        setOpen1(true);
        setOpen2(false);
        setOpen3(false);
        setShowReview(false);
        router.replace("/lister/list");
      }
      loadDrafts();
    }
  };

  return (
    <section className="py-6 space-y-4">
      <h1 className="text-2xl font-bold">List Property</h1>

      {/* Drafts */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Your Drafts</h2>
          <Button className="bg-brand-blue text-white hover:bg-black" size="sm" onClick={loadDrafts}>
            Refresh
          </Button>
        </div>

        {drafts.length === 0 ? (
          <p className="text-sm text-gray-600 mt-2">No drafts yet. Start below.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {drafts.map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium">{d.title || "(Untitled)"}</span>
                  <span className="text-gray-600"> — {d.location || "No location"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => router.push(`/lister/list?id=${d.id}`)}>
                    ✏️ Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => discardDraft(d.id)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Discard
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* STEP 1 */}
      <div className="rounded-xl border bg-white">
        <button
          type="button"
          onClick={() => setOpen1((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <span className="font-semibold">Step 1 — Basic Info</span>
          {open1 ? <MinusCircle className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
        </button>

        {open1 && (
          <div className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="2BR Apartment in Westlands" />
              </div>

              <div>
                <Label>Neighbourhood/Estate/Village/Locality *</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Garden Estate, Roysambu" />
              </div>

              <div>
                <Label>County *</Label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={county}
                  onChange={(e) => {
                    setCounty(e.target.value);
                    setConstituency("");
                    setWard("");
                    setMsg(null);
                    setError(null);
                  }}
                >
                  <option value="">Select county</option>
                  {countyOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Constituency *</Label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={constituency}
                  onChange={(e) => {
                    setConstituency(e.target.value);
                    setWard("");
                    setMsg(null);
                    setError(null);
                  }}
                  disabled={!county}
                >
                  <option value="">Select constituency</option>
                  {constituencyOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Ward *</Label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={ward}
                  onChange={(e) => {
                    setWard(e.target.value);
                    setMsg(null);
                    setError(null);
                  }}
                  disabled={!constituency}
                >
                  <option value="">Select ward</option>
                  {wardOptions.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <Label>Description *</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            <Button className="bg-brand-blue" onClick={nextFromStep1} disabled={loading}>
              {loading ? "Working…" : "Next: Units"}
            </Button>
          </div>
        )}
      </div>

      {/* STEP 2 */}
      <div className="rounded-xl border bg-white">
        <button
          type="button"
          onClick={() => setOpen2((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3"
          disabled={!property}
        >
          <span className="font-semibold">Step 2 — Units & Amenities</span>
          {open2 ? <MinusCircle className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
        </button>

        {open2 && property && (
          <div className="px-4 pb-4 space-y-4">
            <UnitEditor value={units} onChange={(v) => setUnits(v)} />

            <div>
              <Label>Amenities</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {AMENITIES.map((a) => (
                  <label key={a} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={amenityNames.includes(a)}
                      onChange={(e) => {
                        const next = e.target.checked ? [...amenityNames, a] : amenityNames.filter((x) => x !== a);
                        setAmenityNames(next);
                        touchAutoSave({ amenities: next });
                      }}
                    />
                    {a}
                  </label>
                ))}
              </div>
            </div>

            <Button className="bg-brand-blue" onClick={nextFromStep2} disabled={loading}>
              {loading ? "Saving…" : "Next: Images"}
            </Button>
          </div>
        )}
      </div>

      {/* STEP 3 */}
      <div className="rounded-xl border bg-white">
        <button
          type="button"
          onClick={() => setOpen3((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3"
          disabled={!property}
        >
          <span className="font-semibold">Step 3 — Images</span>
          {open3 ? <MinusCircle className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
        </button>

        {open3 && property && (
          <div className="px-4 pb-4 space-y-3">
            <ImageUploader propertyId={property.id} images={imageUrls} onChange={(urls) => setImageUrls(urls)} />
            <Button variant="outline" onClick={goReview} disabled={!canReview}>
              Review
            </Button>
          </div>
        )}
      </div>

      {/* REVIEW */}
      {showReview && property && (
        <div className="rounded-xl border bg-brand p-4">
          <h2 className="font-semibold mb-3">Review & Submit</h2>
          <ul className="list-disc pl-6 text-sm">
            <li>
              <b>Title:</b> {title}
            </li>
            <li>
              <b>Location:</b> {location} — {county}, {constituency}, {ward}
            </li>
            <li>
              <b>Units:</b> {units.length}
            </li>
            <li>
              <b>Images:</b> {imageUrls.length}
            </li>
            <li>
              <b>Amenities:</b> {amenityNames.join(", ")}
            </li>
          </ul>

          <div className="mt-3 flex gap-2">
            <Button onClick={() => setConfirmOpen(true)} className="bg-brand-blue">
              Submit
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowReview(false);
                setOpen3(true);
              }}
            >
              Back
            </Button>
          </div>
        </div>
      )}

      {/* Confirm publish */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm publish</DialogTitle>
            <DialogDescription>Publishing will consume 1 slot from your subscription quota.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={publish} className="bg-brand-blue" disabled={loading}>
              {loading ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {msg && <p className="text-green-600">{msg}</p>}
      {error && <p className="text-red-600">{error}</p>}
    </section>
  );
}

function PageSkeleton() {
  return (
    <section className="py-6 space-y-4">
      <h1 className="text-2xl font-bold">List Property</h1>
      <div className="rounded-xl border bg-white p-4">
        <div className="h-5 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <div className="h-5 w-56 bg-gray-100 rounded animate-pulse" />
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
          <div className="md:col-span-2 h-24 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    </section>
  );
}