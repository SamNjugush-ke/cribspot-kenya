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

export function FeaturedSlider() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({
      featured: 'true',
      status: 'PUBLISHED',
      limit: '16',
    }).toString();

    apiGet<Property[]>(`/api/properties?${qs}`)
      .then((res) => setItems(Array.isArray(res.json) ? res.json : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="py-10">
        <div className="h-8 w-48 mb-3 rounded bg-gray-100 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl border animate-pulse bg-gray-100" />
          ))}
        </div>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="py-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Featured Listings</h2>
        <Link href="/featured" className="text-brand-blue hover:underline">View all</Link>
      </div>

      <Swiper
        modules={[Navigation, Pagination, Grid, Autoplay]}
        navigation
        pagination={{ clickable: true }}
        autoplay={{ delay: 4000 }}
        grid={{ rows: 2, fill: 'row' }}
        breakpoints={{
          320: { slidesPerView: 1 },
          640: { slidesPerView: 2 },
          1024: { slidesPerView: 4 },
        }}
        spaceBetween={16}
      >
        {items.map((p) => (
          <SwiperSlide key={p.id}>
            <ListingCard item={p} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}