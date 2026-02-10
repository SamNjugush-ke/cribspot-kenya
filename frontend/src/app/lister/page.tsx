// frontend/src/app/lister/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiPost, apiPatch } from "@/lib/api";

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

type Prop = {
  id: string;
  title: string;
  description: string;
  location: string;
  county?: string;
  area?: string;
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  units: any[];
  images: { id?: string; url: string }[];
  updatedAt?: string;
};

async function createDraft(payload: Partial<Prop>) {
  const res = await apiPost<Prop>("/api/properties", payload);
  if (!res.ok || !res.data) throw new Error((res.data as any)?.message || `Draft create failed (${res.status})`);
  return res.data;
}

async function updateDraft(id: string, payload: Partial<Prop>) {
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
export default function ListerPage() {
  return (
    <Suspense fallback={<ListerSkeleton />}>
      <ListingFlowInner />
    </Suspense>
  );
}

function ListingFlowInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const existingId = sp.get("id");

  const [drafts, setDrafts] = useState<Prop[]>([]);
  const [step, setStep] = useState(1);
  const [property, setProperty] = useState<Prop | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [county, setCounty] = useState("");
  const [area, setArea] = useState("");

  const [units, setUnits] = useState<any[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await apiGet<{ items: Prop[] }>("/api/properties/mine?status=DRAFT");
      if (res.ok && res.data?.items) setDrafts(res.data.items);
    })();
  }, []);

  useEffect(() => {
    if (!existingId) return;
    (async () => {
      setError(null);
      setMsg(null);

      const res = await apiGet<Prop>(`/api/properties/${existingId}`);
      if (!res.ok || !res.data) return;

      const p = res.data;
      setProperty(p);
      setTitle(p.title || "");
      setDescription(p.description || "");
      setLocation(p.location || "");
      setCounty(p.county || "");
      setArea(p.area || "");
      setUnits(p.units || []);
      setImageUrls((p.images || []).map((i) => i.url));
      setStep(2);
    })();
  }, [existingId]);

  const saveDraft = async () => {
    setLoading(true);
    setError(null);
    setMsg(null);

    try {
      const payload = { title, description, location, county, area, status: "DRAFT" as const };
      const p = property ? await updateDraft(property.id, payload) : await createDraft(payload);
      setProperty(p);
      setMsg(property ? "Draft saved." : "Draft created.");
    } catch (e: any) {
      setError(e?.message || "Failed to save draft");
    } finally {
      setLoading(false);
    }
  };

  const saveUnits = async () => {
    if (!property) return setError("Save draft first.");
    setLoading(true);
    setError(null);
    setMsg(null);

    try {
      const p = await updateDraft(property.id, { units });
      setProperty(p);
      setMsg("Units saved.");
    } catch (e: any) {
      setError(e?.message || "Failed to save units");
    } finally {
      setLoading(false);
    }
  };

  const publish = async () => {
    if (!property) return;
    setLoading(true);
    setConfirmOpen(false);
    setError(null);
    setMsg(null);

    try {
      const p = await publishListing(property.id);
      setProperty(p);
      router.replace(`/properties/${property.id}`);
    } catch (e: any) {
      setError(e?.message || "Failed to publish (quota?)");
    } finally {
      setLoading(false);
    }
  };

  const canSaveDraft = title.trim().length > 0 && location.trim().length > 0;

  return (
    <section className="py-6 space-y-4">
      <h1 className="text-2xl font-bold">List Property</h1>

      {/* Draft list */}
      {drafts.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold mb-2">Your Drafts</h2>
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.id} className="flex justify-between items-center border-b pb-2">
                <span>
                  {d.title || "(Untitled)"} — {d.location || "No location"}
                </span>
                <Button size="sm" variant="outline" onClick={() => router.push(`/lister/list?id=${d.id}`)}>
                  ✏️ Edit
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Step 1 — Basic Info */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Step 1 — Basic Info</h2>
          <div className="text-sm text-gray-600">Status: {property?.status || "DRAFT"}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., 2BR Apartment in Westlands" />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Estate or street" />
          </div>
          <div>
            <Label>County</Label>
            <Input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="e.g., Nairobi" />
          </div>
          <div>
            <Label>Area</Label>
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g., Westlands" />
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <Button onClick={saveDraft} disabled={!canSaveDraft || loading}>
            {loading ? "Saving…" : "Save Draft"}
          </Button>
          {property && (
            <Button className="bg-brand-sky" onClick={() => setStep(2)}>
              Next: Units
            </Button>
          )}
        </div>
      </div>

      {/* Step 2 — Units */}
      {property && step >= 2 && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold mb-3">Step 2 — Units</h2>
          <UnitEditor value={units} onChange={setUnits} />
          <div className="mt-3 flex gap-2">
            <Button onClick={saveUnits} disabled={loading}>
              {loading ? "Saving…" : "Save Units"}
            </Button>
            <Button className="bg-brand-sky" onClick={() => setStep(3)}>
              Next: Images
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Images */}
      {property && step >= 3 && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold mb-3">Step 3 — Images</h2>
          <ImageUploader propertyId={property.id} images={imageUrls} onChange={setImageUrls} />
          <div className="mt-3">
            <Button className="bg-brand-sky" onClick={() => setStep(4)}>
              Next: Review
            </Button>
          </div>
        </div>
      )}

      {/* Step 4 — Review */}
      {property && step >= 4 && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold mb-3">Step 4 — Review & Publish</h2>
          <ul className="list-disc pl-6 text-sm">
            <li>
              <b>Title:</b> {title}
            </li>
            <li>
              <b>Location:</b> {location} {county ? `— ${county}` : ""}{area ? `, ${area}` : ""}
            </li>
            <li>
              <b>Units:</b> {units.length}
            </li>
            <li>
              <b>Images:</b> {imageUrls.length}
            </li>
          </ul>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => setConfirmOpen(true)} className="bg-brand-blue">
              Publish
            </Button>
            <Button variant="outline" onClick={() => router.push(`/properties/${property.id}`)}>
              Preview
            </Button>
          </div>
        </div>
      )}

      {/* Publish confirm */}
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
              {loading ? "Publishing…" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {msg && <p className="text-green-600">{msg}</p>}
      {error && <p className="text-red-600">{error}</p>}
    </section>
  );
}

function ListerSkeleton() {
  return (
    <section className="py-6 space-y-4">
      <h1 className="text-2xl font-bold">List Property</h1>
      <div className="rounded-xl border bg-white p-4">
        <div className="h-5 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
          <div className="md:col-span-2 h-24 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    </section>
  );
}