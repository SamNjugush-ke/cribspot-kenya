"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { Property } from "@/lib/types";
import { ListingCard } from "@/components/ListingCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import {
  KENYA_ADMIN,
  KENYA_COUNTIES,
  PROPERTY_TYPES,
  BEDROOM_OPTIONS,
} from "@/lib/constants";

type Filters = {
  type: string;
  bedrooms: string;
  min: string;
  max: string;
  county: string;
  constituency: string;
  ward: string;
  page: string;
  limit: string;
};

const DEFAULT_LIMIT = "12";

type AdminMap = Record<
  string,
  { constituencies: Record<string, { wards: string[] }> }
>;

const ADMIN: AdminMap = KENYA_ADMIN as unknown as AdminMap;

function buildQuery(q: Record<string, string>) {
  const usp = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v.trim() !== "") usp.set(k, v);
  });
  return usp.toString();
}

function uniqStrings(arr: string[]) {
  return Array.from(new Set(arr));
}

function safeWards(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return uniqStrings(
    input
      .map((w) => String(w ?? "").trim())
      .filter(Boolean)
  ).sort((a, b) => a.localeCompare(b));
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<BrowseSkeleton />}>
      <BrowseInner />
    </Suspense>
  );
}

function BrowseInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // derive initial state from querystring (memoized)
  const initial: Filters = useMemo(
    () => ({
      type: sp.get("type") ?? "",
      bedrooms: sp.get("beds") ?? "",
      min: sp.get("min") ?? "",
      max: sp.get("max") ?? "",
      county: sp.get("county") ?? "",
      constituency: sp.get("constituency") ?? "",
      ward: sp.get("ward") ?? "",
      page: sp.get("page") ?? "1",
      limit: sp.get("limit") ?? DEFAULT_LIMIT,
    }),
    [sp]
  );

  const [type, setType] = useState<string>(initial.type);
  const [beds, setBeds] = useState<string>(initial.bedrooms);
  const [min, setMin] = useState<string>(initial.min);
  const [max, setMax] = useState<string>(initial.max);
  const [county, setCounty] = useState<string>(initial.county);
  const [constituency, setConstituency] = useState<string>(initial.constituency);
  const [ward, setWard] = useState<string>(initial.ward);
  const [page, setPage] = useState<string>(initial.page);
  const [limit, setLimit] = useState<string>(initial.limit);

  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // When URL changes via browser navigation, sync state to URL.
  useEffect(() => {
    setType(initial.type);
    setBeds(initial.bedrooms);
    setMin(initial.min);
    setMax(initial.max);
    setCounty(initial.county);
    setConstituency(initial.constituency);
    setWard(initial.ward);
    setPage(initial.page);
    setLimit(initial.limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initial.type,
    initial.bedrooms,
    initial.min,
    initial.max,
    initial.county,
    initial.constituency,
    initial.ward,
    initial.page,
    initial.limit,
  ]);

  const countyOptions = useMemo(() => {
    // If the URL contains a county not in constants, still show it so UI doesn’t “lose” it.
    const cur = county.trim();
    const base = [...KENYA_COUNTIES];
    if (cur && !base.includes(cur)) base.unshift(cur);
    return base;
  }, [county]);

  const constituencyOptions = useMemo(() => {
    const c = county.trim();
    if (!c) return [];
    const keys = Object.keys(ADMIN[c]?.constituencies ?? {}).sort((a, b) =>
      a.localeCompare(b)
    );

    const cur = constituency.trim();
    if (cur && !keys.includes(cur)) return [cur, ...keys];
    return keys;
  }, [county, constituency]);

  const wardOptions = useMemo(() => {
    const c = county.trim();
    const k = constituency.trim();
    if (!c || !k) return [];
    const wards = ADMIN[c]?.constituencies?.[k]?.wards ?? [];
    const cleaned = safeWards(wards);

    const cur = ward.trim();
    if (cur && !cleaned.includes(cur)) return [cur, ...cleaned];
    return cleaned;
  }, [county, constituency, ward]);

  useEffect(() => {
    // Keep URL in sync (but avoid creating a history entry on every change)
    const urlQuery = buildQuery({
      type,
      beds,
      min,
      max,
      county,
      constituency,
      ward,
      page,
      limit,
    });
    router.replace(`${pathname}?${urlQuery}`);

    setLoading(true);
    setErr(null);

    apiGet<any>("/properties", {
      params: {
        status: "PUBLISHED",
        type: type || "",
        bedrooms: beds || "",
        minPrice: min || "",
        maxPrice: max || "",
        county: county || "",
        constituency: constituency || "",
        ward: ward || "", // ✅ sent to backend (needs backend support to filter)
        page: page || "1",
        limit: limit || DEFAULT_LIMIT,
      },
    })
      .then((res) => {
        const data: any = res.data;
        setItems(Array.isArray(data?.items) ? data.items : []);
        if (!res.ok) {
          setErr(res.error || "Failed to load listings");
        }
      })
      .catch((e: any) => {
        setItems([]);
        setErr(e?.message || "Failed to load listings");
      })
      .finally(() => setLoading(false));
  }, [type, beds, min, max, county, constituency, ward, page, limit, pathname, router]);

  const nextPage = () => setPage(String(Number(page || "1") + 1));
  const prevPage = () => setPage(String(Math.max(1, Number(page || "1") - 1)));

  return (
    <section className="container py-6">
      <h1 className="text-2xl font-bold mb-3">Browse Rentals</h1>

      {/* Sticky filter bar */}
      <div className="sticky top-16 z-30 bg-white/80 backdrop-blur border rounded-xl p-3 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <div>
            <Label>Type</Label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage("1");
              }}
              className="w-full border rounded px-2 py-2"
            >
              <option value="">Any</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Bedrooms</Label>
            <select
              value={beds}
              onChange={(e) => {
                setBeds(e.target.value);
                setPage("1");
              }}
              className="w-full border rounded px-2 py-2"
            >
              <option value="">Any</option>
              {BEDROOM_OPTIONS.filter((x) => x !== "Any").map((b) => (
                <option key={b} value={b === "5+" ? "5" : b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Min Price</Label>
            <Input
              value={min}
              onChange={(e) => {
                setMin(e.target.value);
                setPage("1");
              }}
              placeholder="e.g. 20000"
            />
          </div>

          <div>
            <Label>Max Price</Label>
            <Input
              value={max}
              onChange={(e) => {
                setMax(e.target.value);
                setPage("1");
              }}
              placeholder="e.g. 100000"
            />
          </div>

          <div>
            <Label>County</Label>
            <select
              value={county}
              onChange={(e) => {
                const next = e.target.value;
                setCounty(next);
                // reset dependents
                setConstituency("");
                setWard("");
                setPage("1");
              }}
              className="w-full border rounded px-2 py-2"
            >
              <option value="">Any</option>
              {countyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Constituency</Label>
            <select
              value={constituency}
              onChange={(e) => {
                const next = e.target.value;
                setConstituency(next);
                setWard("");
                setPage("1");
              }}
              className="w-full border rounded px-2 py-2"
              disabled={!county.trim()}
            >
              <option value="">Any</option>
              {constituencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Ward</Label>
            <select
              value={ward}
              onChange={(e) => {
                setWard(e.target.value);
                setPage("1");
              }}
              className="w-full border rounded px-2 py-2"
              disabled={!county.trim() || !constituency.trim()}
            >
              <option value="">Any</option>
              {wardOptions.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 justify-between">
          <div className="text-xs text-gray-600">Results update automatically.</div>

          <div className="flex items-center gap-2">
            <Label className="text-xs">Per page</Label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(e.target.value);
                setPage("1");
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="12">12</option>
              <option value="24">24</option>
              <option value="48">48</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: Number(limit) || 12 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl border animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border p-10 text-center text-gray-600">
          <p className="font-medium">No listings match your filters.</p>
          <p className="text-sm">Try widening your price range or removing some filters.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((p) => (
              <ListingCard key={p.id} item={p} />
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 mt-6">
            <Button variant="outline" onClick={prevPage} disabled={(Number(page) || 1) <= 1}>
              Previous
            </Button>
            <div className="text-sm text-gray-700">Page {page}</div>
            <Button variant="outline" onClick={nextPage}>
              Next
            </Button>
          </div>
        </>
      )}

      {err && <p className="text-red-600 mt-3">{err}</p>}
    </section>
  );
}

function BrowseSkeleton() {
  return (
    <section className="container py-6">
      <h1 className="text-2xl font-bold mb-3">Browse Rentals</h1>
      <div className="sticky top-16 z-30 bg-white/80 backdrop-blur border rounded-xl p-3 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-20 bg-gray-100 rounded" />
              <div className="h-10 w-full bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl border animate-pulse bg-gray-100" />
        ))}
      </div>
    </section>
  );
}