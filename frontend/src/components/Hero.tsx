'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

import { apiGet } from '@/lib/api';
import {
  PROPERTY_TYPES,
  BEDROOM_OPTIONS,
  KENYA_COUNTIES,
} from '@/lib/constants';

type Amenity = { id: string; name: string };

export function Hero() {
  const router = useRouter();

  const [county, setCounty] = useState<string>('ALL');
  const [type, setType] = useState<string>('ALL');
  const [beds, setBeds] = useState<string>('ANY');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [allAmenities, setAllAmenities] = useState<Amenity[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [amenitiesLoading, setAmenitiesLoading] = useState(false);

  const countiesAZ = useMemo(
    () => [...KENYA_COUNTIES].sort((a, b) => a.localeCompare(b)),
    []
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setAmenitiesLoading(true);
      const { ok, json } = await apiGet<Amenity[]>('/api/amenities');
      if (mounted) {
        setAmenitiesLoading(false);
        setAllAmenities(ok && Array.isArray(json) ? json : []);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleAmenity = (name: string) => {
    setAmenities((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set('status', 'PUBLISHED');
    if (county !== 'ALL') params.set('county', county);
    if (type !== 'ALL') params.set('type', type);
    if (beds !== 'ANY') params.set('bedrooms', beds);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (amenities.length) params.set('amenities', amenities.join(','));
    router.push(params.toString() ? `/browse?${params.toString()}` : '/browse');
  };

  return (
    <section className="relative">
      {/* Hero background */}
      <div className="relative h-[48vh] min-h-[340px] w-full rounded-xl overflow-hidden shadow-soft">
        <Image
          src="/hero1.png"
          alt="Find your next rental"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-black/0" />
        <div className="absolute inset-0 flex items-center">
          <div className="container text-white text-center">
            <h1 className="text-4xl md:text-5xl font-bold drop-shadow">
              Find your next home with ease
            </h1>
            <p className="mt-3 text-lg opacity-90">
              Browse rentals across Kenya – apartments, bedsitters, hostels and
              more.
            </p>

            {/* New Browse & List buttons */}
            <div className="mt-6 flex justify-center gap-4">
              <Link
                href="/browse"
                className="px-6 py-2 rounded-lg bg-brand-blue text-white font-semibold hover:bg-brand-blue/90 transition"
              >
                Browse Rentals
              </Link>
              <Link
                href="/lister"
                className="px-6 py-2 rounded-lg bg-brand-red text-white font-semibold hover:bg-brand-red/90 transition"
              >
                List Property
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Compact search panel */}
      <div className="-mt-8 relative z-10">
        <div className="container">
          <div className="mx-auto max-w-5xl rounded-2xl border bg-white/95 backdrop-blur p-4 shadow-sm">
            <form
              onSubmit={onSubmit}
              className="grid grid-cols-1 gap-3 md:grid-cols-6"
            >
              {/* County */}
              <div className="md:col-span-1">
                <Select value={county} onValueChange={setCounty}>
                  <SelectTrigger>
                    <SelectValue placeholder="County" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Counties</SelectItem>
                    {countiesAZ.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type */}
              <div className="md:col-span-1">
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bedrooms */}
              <div className="md:col-span-1">
                <Select value={beds} onValueChange={setBeds}>
                  <SelectTrigger>
                    <SelectValue placeholder="Bedrooms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">Any</SelectItem>
                    {BEDROOM_OPTIONS.map((b) => (
                      <SelectItem key={b} value={String(b)}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Min price */}
              <div className="md:col-span-1">
                <Input
                  inputMode="numeric"
                  placeholder="Min KES"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </div>

              {/* Max price */}
              <div className="md:col-span-1">
                <Input
                  inputMode="numeric"
                  placeholder="Max KES"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>

              {/* Advanced toggle */}
              <div className="md:col-span-1 flex items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="w-full"
                >
                  Advanced
                </Button>
              </div>

              {/* Amenities */}
              {advancedOpen && (
                <div className="md:col-span-6 border-t pt-3">
                  {amenitiesLoading ? (
                    <p className="text-sm text-gray-500">Loading amenities…</p>
                  ) : allAmenities.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No amenities available.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {allAmenities.map((a) => (
                        <label
                          key={a.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={amenities.includes(a.name)}
                            onCheckedChange={() => toggleAmenity(a.name)}
                          />
                          {a.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Search button */}
              <div className="md:col-span-6 flex justify-center mt-3">
                <Button
                  type="submit"
                  className="px-8 bg-brand-blue text-white hover:bg-brand-blue/90"
                >
                  Search Rentals
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
