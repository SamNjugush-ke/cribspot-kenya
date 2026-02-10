// frontend/src/components/NewListings.tsx
'use client';

import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Grid, Autoplay } from 'swiper/modules';
import { apiGet } from '@/lib/api';
import type { Property } from '@/lib/types';
import { ListingCard } from '@/components/ListingCard';
import Link from 'next/link';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/grid';

export default function NewListings() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiGet<any>('/api/properties?status=PUBLISHED&limit=50&sort=new');
        // ✅ FIX: match backend shape
        const data = res.ok && Array.isArray(res.json?.items) ? res.json.items : [];
        if (alive) {
          setItems(data);
          setLoading(false);
        }
      } catch {
        if (alive) {
          setItems([]);
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="py-10">
        <div className="container mx-auto px-4">
          <div className="h-8 w-56 mb-3 rounded bg-gray-100 animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-xl border animate-pulse bg-gray-100"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="py-10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">New Listings</h2>
          <Link href="/browse" className="text-sm text-brand-blue hover:underline">
            View all →
          </Link>
        </div>

        <Swiper
          modules={[Navigation, Pagination, Grid, Autoplay]}
          navigation
          pagination={{ clickable: true }}
          autoplay={{ delay: 5000 }}
          grid={{ rows: 2, fill: 'row' }}
          breakpoints={{
            320: { slidesPerView: 1 },
            640: { slidesPerView: 2 },
            1024: { slidesPerView: 5 },
          }}
          spaceBetween={16}
        >
          {items.map((p) => (
            <SwiperSlide key={p.id}>
              <ListingCard item={p} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
