"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import ImageUploader, { ImageItem } from "@/components/listing/ImageUploader";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  MinusCircle,
  PlayCircle,
  PlusCircle,
  RefreshCw,
  Trash2,
  Plus,
} from "lucide-react";
import { AMENITIES, KENYA_ADMIN } from "@/lib/constants";

type Unit = {
  id?: string;
  bedrooms: number;
  bathrooms: number;
  rent: number; // backend field name (UI label is "Price")
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
  amenities: string[];
}>;

type Usage = {
  remainingListings: number;
  remainingFeatured: number;
  totalListings: number;
  totalFeatured: number;
  usedPublished: number;
  activeCount: number;
  expiresAtSoonest: string | null;
};

type AdminMap = Record<string, { constituencies: Record<string, { wards: string[] }> }>;
const ADMIN: AdminMap = KENYA_ADMIN as unknown as AdminMap;

function trimOrEmpty(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function clampInt(n: number, min: number) {
  const x = Number.isFinite(n) ? Math.floor(n) : min;
  return Math.max(min, x);
}

function parseMoneyInput(raw: string) {
  const cleaned = (raw ?? "")
    .replace(/\s+/g, "")
    .replace(/,/g, "")
    .replace(/[^0-9.]/g, "");
  if (!cleaned) return { value: 0, cleaned: "" };
  const parts = cleaned.split(".");
  const normalized = parts.length <= 2 ? cleaned : `${parts[0]}.${parts.slice(1).join("")}`;
  const asNum = Number(normalized);
  return { value: Number.isFinite(asNum) ? asNum : 0, cleaned: normalized };
}

function formatKes(n: number) {
  const x = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2 }).format(x);
  } catch {
    return String(x);
  }
}

async function createDraft(payload: DraftPayload) {
  const res = await apiPost<{ property?: Prop } | Prop>("/properties", payload);
  const data: any = res.data;
  const prop: Prop | undefined = data?.property ?? data;
  if (!res.ok || !prop?.id) throw new Error(data?.message || `Draft create failed (${res.status})`);
  return prop;
}

async function updateDraft(id: string, payload: DraftPayload) {
  const res = await apiPatch<Prop>(`/properties/${id}`, payload);
  const data: any = res.data;
  if (!res.ok || !data?.id) throw new Error(data?.message || `Draft save failed (${res.status})`);
  return data as Prop;
}

async function publishListing(id: string) {
  const res = await apiPatch<any>(`/properties/${id}/publish`, {});
  const data: any = res.data;
  const prop: Prop | undefined = data?.property ?? data;
  if (!res.ok || !prop?.id) throw new Error(data?.message || `Publish failed (${res.status})`);
  return { property: prop as Prop, quota: data?.quota ?? null };
}

async function getUsage() {
  const res = await apiGet<Usage>("/subscription/usage", { cache: "no-store" as any });
  if (!res.ok) throw new Error((res.data as any)?.message || `Failed to fetch subscription usage (${res.status})`);
  return res.data as Usage;
}

export default function ListerListPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ListingFlowInner />
    </Suspense>
  );
}

function ListingFlowInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const existingId = sp.get("id");

  const [drafts, setDrafts] = useState<Prop[]>([]);
  const [showAllDrafts, setShowAllDrafts] = useState(false);

  const [property, setProperty] = useState<Prop | null>(null);
  const [continuing, setContinuing] = useState<{ id: string; title: string } | null>(null);

  // step accordion
  const [open1, setOpen1] = useState(true);
  const [open2, setOpen2] = useState(false);
  const [open3, setOpen3] = useState(false);
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);

  // step-local feedback
  const [step1Msg, setStep1Msg] = useState<string | null>(null);
  const [step1Err, setStep1Err] = useState<string | null>(null);
  const [step2Msg, setStep2Msg] = useState<string | null>(null);
  const [step2Err, setStep2Err] = useState<string | null>(null);
  const [step3Msg, setStep3Msg] = useState<string | null>(null);
  const [step3Err, setStep3Err] = useState<string | null>(null);

  // global feedback (publish / quota / delete failures)
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);
  const [globalErr, setGlobalErr] = useState<string | null>(null);

  // form fields
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [county, setCounty] = useState("");
  const [constituency, setConstituency] = useState("");
  const [ward, setWard] = useState("");
  const [description, setDescription] = useState("");

  // single unit editor
  const [unitType, setUnitType] = useState("Apartment");
  const [bedroomsText, setBedroomsText] = useState("1");
  const [bathroomsText, setBathroomsText] = useState("1");
  const [availableText, setAvailableText] = useState("1");
  const [priceText, setPriceText] = useState("");

  const [amenityNames, setAmenityNames] = useState<string[]>([]);

  // IMPORTANT: keep image IDs
  const [images, setImages] = useState<ImageItem[]>([]);
  const [imagesBusy, setImagesBusy] = useState(false);

  // ui state
  const [loading, setLoading] = useState(false);

  // discard confirm
  const [discardId, setDiscardId] = useState<string | null>(null);

  // publish dialogs
  const [publishOpen, setPublishOpen] = useState(false);
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [usage, setUsageState] = useState<Usage | null>(null);

  // publish success dialog (prevents “scroll miss”)
  const [publishedDialog, setPublishedDialog] = useState<{
    open: boolean;
    propertyId?: string;
    message?: string;
  }>({ open: false });

  const propertyIdRef = useRef<string | null>(null);
  const step2AnchorRef = useRef<HTMLDivElement | null>(null);
  const step3AnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    propertyIdRef.current = property?.id || null;
  }, [property?.id]);

  const resetForm = useCallback(
    (alsoClearUrl: boolean) => {
      setProperty(null);
      propertyIdRef.current = null;

      setTitle("");
      setLocation("");
      setCounty("");
      setConstituency("");
      setWard("");
      setDescription("");

      setUnitType("Apartment");
      setBedroomsText("1");
      setBathroomsText("1");
      setAvailableText("1");
      setPriceText("");

      setAmenityNames([]);
      setImages([]);

      setOpen1(true);
      setOpen2(false);
      setOpen3(false);
      setStep1Done(false);
      setStep2Done(false);

      setStep1Msg(null);
      setStep1Err(null);
      setStep2Msg(null);
      setStep2Err(null);
      setStep3Msg(null);
      setStep3Err(null);

      setGlobalMsg(null);
      setGlobalErr(null);

      setContinuing(null);

      if (alsoClearUrl) router.replace(pathname);
    },
    [pathname, router]
  );

  const loadDrafts = useCallback(async () => {
    // cache bust (fix “deleted but still shows” due to browser caching)
    const res = await apiGet<{ items: Prop[] }>("/properties/mine", {
      params: { status: "DRAFT", t: Date.now() },
      cache: "no-store" as any,
    });
    if (res.ok && res.data?.items) setDrafts(res.data.items);
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const ensureDraftIdInUrl = useCallback(
    (id: string) => {
      router.replace(`${pathname}?id=${id}`);
    },
    [pathname, router]
  );

  // Load an existing draft/property if ?id=...
  useEffect(() => {
    if (!existingId) return;

    (async () => {
      setGlobalMsg(null);
      setGlobalErr(null);
      setStep1Msg(null);
      setStep1Err(null);
      setStep2Msg(null);
      setStep2Err(null);
      setStep3Msg(null);
      setStep3Err(null);

      const try1 = await apiGet<Prop>(`/properties/${existingId}/details`, { cache: "no-store" as any });
      const res = try1.ok ? try1 : await apiGet<Prop>(`/properties/${existingId}`, { cache: "no-store" as any });

      if (!res.ok || !res.data?.id) {
        setGlobalErr((res.data as any)?.message || "Failed to load draft");
        return;
      }

      const p = res.data;
      setProperty(p);

      setTitle(trimOrEmpty(p.title));
      setLocation(trimOrEmpty(p.location));
      setCounty(trimOrEmpty(p.county));
      setConstituency(trimOrEmpty(p.constituency));
      setWard(trimOrEmpty(p.ward));
      setDescription(trimOrEmpty(p.description));

      const first = (p.units || [])[0];
      setUnitType(trimOrEmpty(first?.type) || "Apartment");
      setBedroomsText(String(Math.max(1, Number(first?.bedrooms) || 1)));
      setBathroomsText(String(Math.max(1, Number(first?.bathrooms) || 1)));
      setAvailableText(String(Math.max(1, Number(first?.available) || 1)));
      setPriceText(first?.rent ? formatKes(Number(first.rent) || 0) : "");

      setImages((p.images || []).map((i) => ({ id: i.id, url: i.url })).filter((x) => x.url).slice(0, 10));
      setAmenityNames((p.amenities || []).map((a) => a.amenity?.name).filter(Boolean as any));

      // progress gating
      const s1 =
        !!trimOrEmpty(p.title) &&
        !!trimOrEmpty(p.location) &&
        !!trimOrEmpty(p.county) &&
        !!trimOrEmpty(p.constituency) &&
        !!trimOrEmpty(p.ward) &&
        !!trimOrEmpty(p.description);

      const u = first;
      const s2 =
        !!trimOrEmpty(u?.type) &&
        (Number(u?.bedrooms) || 0) >= 1 &&
        (Number(u?.bathrooms) || 0) >= 1 &&
        (Number(u?.available) || 0) >= 1 &&
        (Number(u?.rent) || 0) >= 1;

      setStep1Done(s1);
      setStep2Done(s2);

      // UX: explicitly show we are continuing this draft and auto-open relevant step
      setContinuing({ id: p.id, title: p.title || "(Untitled)" });

      if (!s1) {
        setOpen1(true);
        setOpen2(false);
        setOpen3(false);
      } else if (!s2) {
        setOpen1(false);
        setOpen2(true);
        setOpen3(false);
        setTimeout(() => step2AnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      } else {
        setOpen1(false);
        setOpen2(false);
        setOpen3(true);
        setTimeout(() => step3AnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    })();
  }, [existingId]);

  // Admin options
  const countyOptions = useMemo(() => {
    const keys = Object.keys(ADMIN).sort();
    const cur = trimOrEmpty(county);
    return uniq(cur && !keys.includes(cur) ? [cur, ...keys] : keys);
  }, [county]);

  const constituencyOptions = useMemo(() => {
    const curCounty = trimOrEmpty(county);
    const keys = curCounty ? Object.keys(ADMIN[curCounty]?.constituencies || {}).sort() : [];
    const cur = trimOrEmpty(constituency);
    return uniq(cur && !keys.includes(cur) ? [cur, ...keys] : keys);
  }, [county, constituency]);

  const wardOptions = useMemo(() => {
    const curCounty = trimOrEmpty(county);
    const curConst = trimOrEmpty(constituency);
    const keys =
      curCounty && curConst ? (ADMIN[curCounty]?.constituencies?.[curConst]?.wards || []).slice().sort() : [];
    const cur = trimOrEmpty(ward);
    return uniq(cur && !keys.includes(cur) ? [cur, ...keys] : keys);
  }, [county, constituency, ward]);

  const step1Valid =
    !!title.trim() &&
    !!location.trim() &&
    !!county.trim() &&
    !!constituency.trim() &&
    !!ward.trim() &&
    !!description.trim();

  const unitDerived = useMemo(() => {
    const bedrooms = clampInt(Number(bedroomsText), 1);
    const bathrooms = clampInt(Number(bathroomsText), 1);
    const available = clampInt(Number(availableText), 1);
    const { value: priceNum } = parseMoneyInput(priceText);
    const rent = Math.round(priceNum);
    return {
      type: trimOrEmpty(unitType),
      bedrooms,
      bathrooms,
      available,
      rent,
    } as Unit;
  }, [availableText, bathroomsText, bedroomsText, priceText, unitType]);

  const step2Valid =
    !!trimOrEmpty(unitDerived.type) &&
    unitDerived.bedrooms >= 1 &&
    unitDerived.bathrooms >= 1 &&
    unitDerived.available >= 1 &&
    unitDerived.rent >= 1;

  const step3Valid = images.length >= 1 && images.length <= 10 && !imagesBusy;

  // Debounced autosave (amenities)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchAutoSave = useCallback((patch: DraftPayload) => {
    const pid = propertyIdRef.current;
    if (!pid) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      try {
        if (!propertyIdRef.current) return;
        await updateDraft(pid, patch);
      } catch {
        // silent for autosave
      }
    }, 600);
  }, []);

  const nextFromStep1 = async () => {
    setStep1Msg(null);
    setStep1Err(null);
    setGlobalMsg(null);
    setGlobalErr(null);

    if (!step1Valid) {
      setStep1Err("Fill all Step 1 fields.");
      return;
    }

    try {
      setLoading(true);

      const payload: DraftPayload = {
        title: title.trim(),
        location: location.trim(),
        description: description.trim(),
        county: county.trim(),
        constituency: constituency.trim(),
        ward: ward.trim(),
        status: "DRAFT",
        amenities: amenityNames,
      };

      if (!property?.id) {
        const p = await createDraft(payload);
        setProperty(p);
        ensureDraftIdInUrl(p.id);
        setStep1Msg("Draft created.");
      } else {
        const updated = await updateDraft(property.id, payload);
        setProperty(updated);
        setStep1Msg("Saved.");
      }

      await loadDrafts();
      setStep1Done(true);
      setOpen1(false);
      setOpen2(true);
      setContinuing(null);

      setTimeout(() => step2AnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e: any) {
      setStep1Err(e?.message || "Failed to save Step 1");
    } finally {
      setLoading(false);
    }
  };

  const nextFromStep2 = async () => {
    setStep2Msg(null);
    setStep2Err(null);
    setGlobalMsg(null);
    setGlobalErr(null);

    const pid = propertyIdRef.current;
    if (!pid) {
      setStep2Err("Create draft first (Step 1).");
      return;
    }

    if (!step2Valid) {
      setStep2Err("Complete unit details (Type, Bedrooms, Bathrooms, Price, Available).");
      return;
    }

    try {
      setLoading(true);
      const updated = await updateDraft(pid, {
        units: [unitDerived],
        amenities: amenityNames,
      });
      setProperty(updated);
      setStep2Done(true);
      setOpen2(false);
      setOpen3(true);

      // IMPORTANT: don’t show draft preview link here
      setStep2Msg("Listing saved. Complete images and submit.");
      setTimeout(() => step3AnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e: any) {
      setStep2Err(e?.message || "Failed to save unit");
    } finally {
      setLoading(false);
    }
  };

  const saveAll = async () => {
    setStep3Msg(null);
    setStep3Err(null);
    setGlobalMsg(null);
    setGlobalErr(null);

    const pid = propertyIdRef.current;
    if (!pid) {
      setStep3Err("Create draft first (Step 1).");
      return;
    }

    if (!step1Valid) {
      setGlobalErr("Complete Step 1 first.");
      setOpen1(true);
      return;
    }
    if (!step2Valid) {
      setGlobalErr("Complete Step 2 first.");
      setOpen2(true);
      return;
    }
    if (imagesBusy) {
      setStep3Err("Please wait for all images to finish uploading.");
      return;
    }
    if (images.length > 10) {
      setStep3Err("Maximum images is 10.");
      return;
    }

    try {
      setLoading(true);
      await updateDraft(pid, { units: [unitDerived], amenities: amenityNames });
      // images already saved via upload endpoints; this save just ensures unit/amenities are latest
      setStep3Msg("Draft saved.");
      await loadDrafts();
    } catch (e: any) {
      setStep3Err(e?.message || "Failed to save draft");
    } finally {
      setLoading(false);
    }
  };

  const requestPublish = async () => {
    setStep3Err(null);
    setGlobalMsg(null);
    setGlobalErr(null);

    const pid = propertyIdRef.current;
    if (!pid) {
      setGlobalErr("Create draft first.");
      return;
    }

    // Hard blocks
    if (!step1Valid) {
      setGlobalErr("Complete Step 1 first.");
      setOpen1(true);
      return;
    }
    if (!step2Valid) {
      setGlobalErr("Complete Step 2 first.");
      setOpen2(true);
      return;
    }
    if (images.length < 1) {
      setStep3Err("Add at least 1 image.");
      return;
    }
    if (images.length > 10) {
      setStep3Err("Maximum images is 10.");
      return;
    }
    if (imagesBusy) {
      setStep3Err("Please wait for all images to finish uploading.");
      return;
    }

    // Persist unit + amenities before publishing
    try {
      setLoading(true);
      await updateDraft(pid, { units: [unitDerived], amenities: amenityNames });
    } catch (e: any) {
      setLoading(false);
      setGlobalErr(e?.message || "Failed to save before publishing");
      return;
    } finally {
      setLoading(false);
    }

    // Check quota proactively
    try {
      const u = await getUsage();
      setUsageState(u);
      if (!u.activeCount || u.remainingListings <= 0) {
        setQuotaOpen(true);
        return;
      }
      setPublishOpen(true);
    } catch {
      setPublishOpen(true);
    }
  };

  const publish = async () => {
    const pid = propertyIdRef.current;
    if (!pid) return;

    setLoading(true);
    setPublishOpen(false);
    setGlobalMsg(null);
    setGlobalErr(null);

    try {
      const { property: updated } = await publishListing(pid);

      // Refresh usage
      let u: Usage | null = null;
      try {
        u = await getUsage();
        setUsageState(u);
      } catch {}

      const consumedLine = u ? `1 listing consumed • balance: ${u.remainingListings} remaining` : "1 listing consumed";

      // Show confirmation dialog (prevents “scroll miss”), with new tab link
      setPublishedDialog({
        open: true,
        propertyId: updated.id,
        message: `Property posted successfully. ${consumedLine}`,
      });

      await loadDrafts();

      // CLEAR + COLLAPSE form to avoid “looks like it can submit again”
      resetForm(true);
    } catch (e: any) {
      const message = e?.message || "Failed to publish";
      if (/quota|subscribe|extend|402/i.test(message)) {
        setGlobalErr(
          "No subscription quota remaining. Your property is saved as a draft. Please buy/extend a subscription on the billing page to publish."
        );
        setQuotaOpen(true);
      } else {
        setGlobalErr(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const discardDraft = async (id: string) => {
    setGlobalMsg(null);
    setGlobalErr(null);
    setDiscardId(null);

    // optimistic
    setDrafts((prev) => prev.filter((d) => d.id !== id));

    const res = await apiDelete(`/properties/${id}`);
    if (res.ok) {
      // If they were editing that draft, reset form + URL
      if (propertyIdRef.current === id) resetForm(true);

      setGlobalMsg("Draft discarded.");
      await loadDrafts(); // cache bust inside loadDrafts
    } else {
      setGlobalErr((res.data as any)?.message || "Failed to discard draft");
      await loadDrafts();
    }
  };

  const onContinueDraft = (d: Prop) => {
    setContinuing({ id: d.id, title: d.title || "(Untitled)" });
    router.push(`${pathname}?id=${d.id}`);
  };

  const canToggleStep2 = step1Done && !!propertyIdRef.current;
  const canToggleStep3 = step2Done && !!propertyIdRef.current;

  const unitSummary = useMemo(() => {
    const price = unitDerived.rent ? formatKes(unitDerived.rent) : "—";
    return {
      Type: unitDerived.type || "—",
      Bedrooms: String(unitDerived.bedrooms || "—"),
      Bathrooms: String(unitDerived.bathrooms || "—"),
      Available: String(unitDerived.available || "—"),
      "Price (KES)": price,
    };
  }, [unitDerived]);

  const areaSummary = useMemo(() => {
    const c = trimOrEmpty(county) || "—";
    const con = trimOrEmpty(constituency) || "—";
    const w = trimOrEmpty(ward) || "—";
    return { County: c, Constituency: con, Ward: w };
  }, [county, constituency, ward]);

  const displayedDrafts = useMemo(() => {
    const sorted = [...drafts].sort((a, b) => {
      const ax = new Date(a.updatedAt || 0).getTime();
      const bx = new Date(b.updatedAt || 0).getTime();
      return bx - ax;
    });
    if (showAllDrafts) return sorted;
    return sorted.slice(0, 2);
  }, [drafts, showAllDrafts]);

  return (
    <section className="py-6 space-y-4">
      {/* Header actions */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">List Property</h1>
          <p className="text-sm text-gray-600">Drafts auto-save as you go. Publish only when ready.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => resetForm(true)}
            className="border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white"
          >
            <Plus className="h-4 w-4 mr-2" /> Add New Listing
          </Button>
          <Button className="bg-brand-blue text-white hover:bg-black" onClick={loadDrafts}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Continuing banner */}
      {continuing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
          <div className="font-semibold">Continuing draft: {continuing.title}</div>
          <div className="text-sm mt-1">Your saved data has been loaded. Continue where you left off.</div>
        </div>
      )}

      {/* Drafts */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Your Drafts</h2>
          {drafts.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAllDrafts((v) => !v)}
              className="text-sm underline text-gray-700"
            >
              {showAllDrafts ? "Show fewer" : "View all drafts"}
            </button>
          )}
        </div>

        {drafts.length === 0 ? (
          <p className="text-sm text-gray-600 mt-2">No drafts yet. Start below.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {displayedDrafts.map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between gap-3">
                <div className="text-sm min-w-0">
                  <div className="font-medium truncate">{d.title || "(Untitled)"}</div>
                  <div className="text-gray-600 truncate">{d.location || "No location"}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => onContinueDraft(d)}>
                    <PlayCircle className="h-4 w-4 mr-2" /> Continue
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setDiscardId(d.id)}>
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
                <Label>Neighborhood/Estate/Village/Locality *</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Garden Estate, Roysambu"
                />
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
                    setStep1Err(null);
                    setStep1Msg(null);
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
                    setStep1Err(null);
                    setStep1Msg(null);
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
                    setStep1Err(null);
                    setStep1Msg(null);
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
              {loading ? "Working…" : (
                <span className="inline-flex items-center">
                  Next: Unit Details <ChevronRight className="h-4 w-4 ml-2" />
                </span>
              )}
            </Button>

            {step1Err && <p className="text-sm text-red-600">{step1Err}</p>}
            {step1Msg && <p className="text-sm text-green-600">{step1Msg}</p>}
          </div>
        )}
      </div>

      {/* STEP 2 */}
      <div className="rounded-xl border bg-white" ref={step2AnchorRef}>
        <button
          type="button"
          onClick={() => {
            if (!canToggleStep2) return;
            setOpen2((v) => !v);
          }}
          className="w-full flex items-center justify-between px-4 py-3 disabled:opacity-60"
          disabled={!canToggleStep2}
        >
          <span className="font-semibold">Step 2 — Unit & Amenities</span>
          {open2 ? <MinusCircle className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
        </button>

        {open2 && canToggleStep2 && (
          <div className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Unit form */}
              <div className="lg:col-span-2 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Type *</Label>
                    <select className="w-full border rounded px-3 py-2" value={unitType} onChange={(e) => setUnitType(e.target.value)}>
                      {["Apartment","Studio","Bedsitter","Hostel","Townhouse","Office","Shop","Mansion","Bungalow"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label>Bedrooms (≥ 1) *</Label>
                    <Input
                      inputMode="numeric"
                      value={bedroomsText}
                      onChange={(e) => setBedroomsText(e.target.value.replace(/[^0-9]/g, ""))}
                      onBlur={() => setBedroomsText(String(clampInt(Number(bedroomsText), 1)))}
                      placeholder="1"
                    />
                  </div>

                  <div>
                    <Label>Bathrooms (≥ 1) *</Label>
                    <Input
                      inputMode="numeric"
                      value={bathroomsText}
                      onChange={(e) => setBathroomsText(e.target.value.replace(/[^0-9]/g, ""))}
                      onBlur={() => setBathroomsText(String(clampInt(Number(bathroomsText), 1)))}
                      placeholder="1"
                    />
                  </div>

                  <div>
                    <Label>Available (≥ 1) *</Label>
                    <Input
                      inputMode="numeric"
                      value={availableText}
                      onChange={(e) => setAvailableText(e.target.value.replace(/[^0-9]/g, ""))}
                      onBlur={() => setAvailableText(String(clampInt(Number(availableText), 1)))}
                      placeholder="1"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label>Price (KES) *</Label>
                    <Input
                      inputMode="decimal"
                      placeholder="e.g. 16,000 or 16,000.00"
                      value={priceText}
                      onChange={(e) => setPriceText(e.target.value.replace(/[^0-9.,]/g, ""))}
                      onBlur={() => {
                        const { value } = parseMoneyInput(priceText);
                        setPriceText(value ? formatKes(value) : "");
                      }}
                    />
                    <p className="text-xs text-gray-600 mt-1">Numbers only. Commas/decimals are okay.</p>
                  </div>
                </div>

                {/* Amenities */}
                <div>
                  <Label>Amenities (optional)</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {AMENITIES.map((a) => (
                      <label key={a} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={amenityNames.includes(a)}
                          onChange={(e) => {
                            const next = e.target.checked ? uniq([...amenityNames, a]) : amenityNames.filter((x) => x !== a);
                            setAmenityNames(next);
                            touchAutoSave({ amenities: next });
                          }}
                        />
                        {a}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live summary */}
              <div className="rounded-xl border bg-gray-50 p-4">
                <div className="font-semibold">Summary</div>

                <div className="mt-3 text-sm text-gray-700">
                  <div className="font-medium">Area</div>
                  <div className="mt-2 space-y-1">
                    {Object.entries(areaSummary).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-2">
                        <span className="text-gray-600">{k}</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-700">
                  <div className="font-medium">Unit</div>
                  <div className="mt-2 space-y-1">
                    {Object.entries(unitSummary).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-2">
                        <span className="text-gray-600">{k}</span>
                        <span
                          className={
                            k === "Price (KES)"
                              ? "font-extrabold text-base px-2 py-1 rounded border border-brand-blue bg-white"
                              : ""
                          }
                        >
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-700">
                  <div className="font-medium">Amenities</div>
                  <div className="mt-2 text-xs text-gray-700">
                    {amenityNames.length ? amenityNames.join(", ") : "—"}
                  </div>
                </div>

                {!step2Valid && (
                  <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <div>Complete all required unit fields to continue.</div>
                  </div>
                )}
              </div>
            </div>

            <Button className="bg-brand-blue" onClick={nextFromStep2} disabled={loading}>
              {loading ? "Saving…" : (
                <span className="inline-flex items-center">
                  Next: Images <ChevronRight className="h-4 w-4 ml-2" />
                </span>
              )}
            </Button>

            {step2Err && <p className="text-sm text-red-600">{step2Err}</p>}
            {step2Msg && <p className="text-sm text-green-600">{step2Msg}</p>}
          </div>
        )}
      </div>

      {/* STEP 3 */}
      <div className="rounded-xl border bg-white" ref={step3AnchorRef}>
        <button
          type="button"
          onClick={() => {
            if (!canToggleStep3) return;
            setOpen3((v) => !v);
          }}
          className="w-full flex items-center justify-between px-4 py-3 disabled:opacity-60"
          disabled={!canToggleStep3}
        >
          <span className="font-semibold">Step 3 — Images</span>
          {open3 ? <MinusCircle className="h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
        </button>

        {open3 && canToggleStep3 && (
          <div className="px-4 pb-4 space-y-3">
            <ImageUploader
              propertyId={propertyIdRef.current!}
              images={images}
              onChange={(items) => setImages(items.slice(0, 10))}
              maxImages={10}
              onBusyChange={setImagesBusy}
            />

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-gray-600">Minimum 1 image • Maximum 10 • Submit unlocks when uploads complete.</div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={saveAll} disabled={loading}>
                  {loading ? "Saving…" : "Save"}
                </Button>

                <Button className="bg-brand-blue" onClick={requestPublish} disabled={loading || !step3Valid}>
                  {loading ? "Working…" : "Submit"}
                </Button>
              </div>
            </div>

            {step3Err && <p className="text-sm text-red-600">{step3Err}</p>}
            {step3Msg && <p className="text-sm text-green-600">{step3Msg}</p>}
          </div>
        )}
      </div>

      {/* Global messages (posting / deleting / quota etc) */}
      {globalMsg && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-900">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5" /> {globalMsg}
          </div>
        </div>
      )}

      {globalErr && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5" /> {globalErr}
          </div>
          <div className="mt-2 text-sm">
            If this is about subscription quota, go to{" "}
            <Link className="underline" href="/dashboard/lister/billing">
              Billing
            </Link>
            .
          </div>
        </div>
      )}

      {/* Discard confirm */}
      <Dialog open={!!discardId} onOpenChange={(o) => (!o ? setDiscardId(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this Draft?</DialogTitle>
            <DialogDescription>This will permanently delete the draft and its uploaded images.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => discardDraft(discardId!)}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* No quota dialog */}
      <Dialog open={quotaOpen} onOpenChange={setQuotaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subscription required</DialogTitle>
            <DialogDescription>
              You need an active subscription with available listing slots to publish. Your property remains saved as a draft.
            </DialogDescription>
          </DialogHeader>
          {usage && (
            <div className="text-sm text-gray-700">
              <div>Active subscriptions: {usage.activeCount}</div>
              <div>Remaining listings: {usage.remainingListings}</div>
              <div>Used published: {usage.usedPublished}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotaOpen(false)}>
              Close
            </Button>
            <Button asChild className="bg-brand-blue">
              <Link href="/dashboard/lister/billing">Go to Billing</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm publish */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm publish</DialogTitle>
            <DialogDescription>
              Publishing will consume 1 slot from your subscription quota.
              {usage ? ` Remaining after publish: ${Math.max(0, usage.remainingListings - 1)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button onClick={publish} className="bg-brand-blue" disabled={loading}>
              {loading ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish success dialog */}
      <Dialog
        open={publishedDialog.open}
        onOpenChange={(o) => setPublishedDialog((prev) => ({ ...prev, open: o }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Listing Published</DialogTitle>
            <DialogDescription>{publishedDialog.message}</DialogDescription>
          </DialogHeader>

          {publishedDialog.propertyId && (
            <div className="text-sm">
              View live listing:{" "}
              <a
                href={`/properties/${publishedDialog.propertyId}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Open property page
              </a>
            </div>
          )}

          <DialogFooter>
            <Button
              className="bg-brand-blue"
              onClick={() => setPublishedDialog({ open: false })}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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