// src/components/CountySearch.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { Building2, ChevronDown, ChevronUp } from 'lucide-react';

type Row = { county: string; count: number };
type Constituency = { name: string; count: number };

export default function CountySearch() {
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<'TOP' | 'AZ'>('TOP');
  const [loading, setLoading] = useState(false);

  const [expandedCounty, setExpandedCounty] = useState<string | null>(null);
  const [constituencies, setConstituencies] = useState<
    Record<string, Constituency[]>
  >({});

  useEffect(() => {
    setLoading(true);
    apiGet<Row[]>('/api/properties/stats/counties')
      .then((res) => {
        const data = Array.isArray(res.json) ? res.json : [];
        setRows(data);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (tab === 'TOP') return copy.sort((a, b) => b.count - a.count);
    return copy.sort((a, b) => a.county.localeCompare(b.county));
  }, [rows, tab]);

  const groupsAZ = useMemo(() => {
    const ranges = [
      ['A', 'D'],
      ['E', 'H'],
      ['I', 'L'],
      ['M', 'P'],
      ['Q', 'T'],
      ['U', 'Z'],
    ] as const;

    return ranges.map(([start, end]) => {
      const counties = sorted.filter((r) => {
        const first = r.county[0].toUpperCase();
        return first >= start && first <= end;
      });
      return { label: `${start}–${end}`, counties };
    });
  }, [sorted]);

  const toggleCounty = async (county: string) => {
    if (expandedCounty === county) {
      setExpandedCounty(null);
      return;
    }
    setExpandedCounty(county);

    if (!constituencies[county]) {
      const res = await apiGet<Constituency[]>(
        `/api/properties/stats/constituencies?county=${encodeURIComponent(
          county
        )}`
      );
      setConstituencies((prev) => ({
        ...prev,
        [county]: Array.isArray(res.json) ? res.json : [],
      }));
    }
  };

  return (
    <section className="py-10">
      <div className="container mx-auto px-4">
        {/* Section heading */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-brand-blue">
            Select by State or Area in Kenya
          </h2>
          <p className="text-gray-600 mt-2">
            Check out these New Listings in Various States
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-6">
          <div className="flex gap-2 text-sm">
            <button
              className={`px-3 py-1 rounded ${
                tab === 'TOP'
                  ? 'bg-brand-blue text-white'
                  : 'border text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setTab('TOP')}
            >
              Top
            </button>
            <button
              className={`px-3 py-1 rounded ${
                tab === 'AZ'
                  ? 'bg-brand-blue text-white'
                  : 'border text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setTab('AZ')}
            >
              A–Z
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg border animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded border p-8 text-center text-gray-600">
            No county data yet.
          </div>
        ) : tab === 'TOP' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {sorted.map((r) => (
              <div
                key={r.county}
                className="flex flex-col items-start gap-2 rounded-lg border p-4 hover:shadow-md transition"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-brand-blue" />
                  <h3 className="font-semibold text-lg">
                    {r.county}{' '}
                    <span className="ml-2 text-sm text-gray-500">
                      ({r.count})
                    </span>
                  </h3>
                </div>
                <button
                  onClick={() => toggleCounty(r.county)}
                  className="flex items-center gap-1 text-sm text-brand-blue hover:underline"
                >
                  View Location in {r.county}{' '}
                  {expandedCounty === r.county ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                {expandedCounty === r.county && (
                  <div className="ml-6 mt-2 flex flex-col gap-1 text-sm">
                    <Link
                      href={`/browse?county=${encodeURIComponent(r.county)}`}
                      className="text-gray-700 hover:underline"
                    >
                      All [{r.count}]
                    </Link>
                    {constituencies[r.county]?.map((c) => (
                      <Link
                        key={c.name}
                        href={`/browse?county=${encodeURIComponent(
                          r.county
                        )}&constituency=${encodeURIComponent(c.name)}`}
                        className="text-gray-700 hover:underline"
                      >
                        {c.name} [{c.count}]
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {groupsAZ.map((group) => (
              <div key={group.label}>
                <h4 className="text-lg font-semibold text-brand-blue mb-2">
                  {group.label}
                </h4>
                {group.counties.length === 0 ? (
                  <p className="text-gray-500 text-sm">No counties</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {group.counties.map((r) => (
                      <div
                        key={r.county}
                        className="flex flex-col items-start gap-1 rounded-lg border p-3 hover:shadow-md transition"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-brand-blue" />
                          <span className="font-medium">{r.county}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {r.count} listings
                        </span>
                        <Link
                          href={`/browse?county=${encodeURIComponent(
                            r.county
                          )}`}
                          className="text-xs text-brand-blue hover:underline"
                        >
                          View Location
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
