//frontend/src/counties/[county]/page.tsx

'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import type { Property } from '@/lib/types';
import { ListingCard } from '@/components/ListingCard';

export default function CountyPage() {
  const { county } = useParams<{ county: string }>();
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!county) return;
    let ignore = false;
    setLoading(true);
    api.get('/api/properties', { params: { county, status: 'PUBLISHED' } })
      .then(res => { if (!ignore) setItems(res.data || []); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [county]);

  return (
    <section className="py-6">
      <h1 className="text-2xl font-bold mb-3">Listings in {decodeURIComponent(String(county))}</h1>
      {loading ? <p>Loading…</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => <ListingCard key={it.id} item={it} />)}
        </div>
      )}
    </section>
  );
}
