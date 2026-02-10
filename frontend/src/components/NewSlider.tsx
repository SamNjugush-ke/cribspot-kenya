'use client';
import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Grid, Autoplay } from 'swiper/modules';
import { apiGet } from '@/lib/api';
import type { Property } from '@/lib/types';
import { ListingCard } from '@/components/ListingCard';
import Link from 'next/link';

export function NewSlider() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      // if your backend doesn't support sort=new, fallback to createdAt desc on server
      const res = await apiGet<Property[]>('/api/properties?status=PUBLISHED&limit=12&sort=new');
      const data = (res.ok && Array.isArray(res.data)) ? res.data : [];
      if (alive) { setItems(data); setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return null;
  if (!items.length) return null;

  return (
    <section className="py-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">New Listings</h2>
        <Link href="/browse" className="text-brand-blue hover:underline">Browse all</Link>
      </div>

      <Swiper
        modules={[Navigation, Pagination, Grid, Autoplay]}
        navigation
        pagination={{ clickable: true }}
        autoplay={{ delay: 4000 }}
        grid={{ rows: 1, fill: 'row' }}
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