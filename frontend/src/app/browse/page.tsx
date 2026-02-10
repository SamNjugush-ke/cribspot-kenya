// frontend/src/app/browse/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { Property } from "@/lib/types";
import { ListingCard } from "@/components/ListingCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Filters = {
  type?: string;
  bedrooms?: string;
  min?: string;
  max?: string;
  county?: string;
  constituency?: string;
  area?: string;
  page?: string;
  limit?: string;
};

const DEFAULT_LIMIT = "12";

function buildQuery(q: Record<string, string | undefined>) {
  const usp = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v && v.trim() !== "") usp.set(k, v);
  });
  return usp.toString();
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
      type: sp.get("type") || "",
      bedrooms: sp.get("beds") || "",
      min: sp.get("min") || "",
      max: sp.get("max") || "",
      county: sp.get("county") || "",
      constituency: sp.get("constituency") || "",
      area: sp.get("area") || "",
      page: sp.get("page") || "1",
      limit: sp.get("limit") || DEFAULT_LIMIT,
    }),
    // intentionally depend on sp so if user navigates with back/forward, we pick up new values
    [sp]
  );

  const [type, setType] = useState(initial.type);
  const [beds, setBeds] = useState(initial.bedrooms);
  const [min, setMin] = useState(initial.min);
  const [max, setMax] = useState(initial.max);
  const [county, setCounty] = useState(initial.county);
  const [constituency, setConstituency] = useState(initial.constituency);
  const [area, setArea] = useState(initial.area);
  const [page, setPage] = useState(initial.page || "1");
  const [limit, setLimit] = useState(initial.limit || DEFAULT_LIMIT);

  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // When URL changes via browser navigation, sync state to URL.
  // (Prevents stale UI when user hits back/forward.)
  useEffect(() => {
    setType(initial.type);
    setBeds(initial.bedrooms);
    setMin(initial.min);
    setMax(initial.max);
    setCounty(initial.county);
    setConstituency(initial.constituency);
    setArea(initial.area);
    setPage(initial.page || "1");
    setLimit(initial.limit || DEFAULT_LIMIT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.type, initial.bedrooms, initial.min, initial.max, initial.county, initial.constituency, initial.area, initial.page, initial.limit]);

  useEffect(() => {
    const apiQuery = buildQuery({
      type,
      bedrooms: beds,
      minPrice: min,
      maxPrice: max,
      county,
      constituency,
      area,
      status: "PUBLISHED",
      page,
      limit,
    });

    // Keep URL in sync (but avoid creating a history entry on every change)
    const urlQuery = buildQuery({
      type,
      beds,
      min,
      max,
      county,
      constituency,
      area,
      page,
      limit,
    });

    router.replace(`${pathname}?${urlQuery}`);

    setLoading(true);
    setErr(null);

    apiGet<any>(`/api/properties?${apiQuery}`)
      .then((res) => {
        const data = res.json;
        setItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((e: any) => {
        setItems([]);
        setErr(e?.message || "Failed to load listings");
      })
      .finally(() => setLoading(false));
  }, [type, beds, min, max, county, constituency, area, page, limit, pathname, router]);

  const nextPage = () => setPage(String(Number(page || "1") + 1));
  const prevPage = () => setPage(String(Math.max(1, Number(page || "1") - 1)));

  return (
    <section className="container py-6">
      <h1 className="text-2xl font-bold mb-3">Browse Rentals</h1>

      {/* Sticky filter bar */}
      <div className="sticky top-16 z-30 bg-white/80 backdrop-blur border rounded-xl p-3 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
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
              <option>Apartment</option>
              <option>House</option>
              <option>Office</option>
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
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5+</option>
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
            <Input
              value={county}
              onChange={(e) => {
                setCounty(e.target.value);
                setPage("1");
              }}
              placeholder="e.g. Nairobi"
            />
          </div>

          <div>
            <Label>Area</Label>
            <Input
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setPage("1");
              }}
              placeholder="e.g. Westlands"
            />
          </div>
        </div>

        {/* constituency hidden for now (still works via URL / future dropdowns) */}
        <input type="hidden" value={constituency} readOnly />

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
              <option>12</option>
              <option>24</option>
              <option>48</option>
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
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
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