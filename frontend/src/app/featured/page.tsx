'use client';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { Property } from '@/lib/types';
import { ListingCard } from '@/components/ListingCard';

export default function FeaturedPage() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    apiGet<any>('/api/properties?featured=true&status=PUBLISHED')
      .then((res) => {
        if (!ignore) {
          const data = res.json;
          setItems(Array.isArray(data?.items) ? data.items : []);
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section className="py-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">Featured Properties</h1>
      </div>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => (
            <ListingCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </section>
  );
}