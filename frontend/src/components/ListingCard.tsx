// src/components/ListingCard.tsx
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { currencyKES } from '@/lib/utils';
import type { Property } from '@/lib/types';
import { MapPin, Heart, Star } from 'lucide-react';
import { API_BASE } from "@/lib/api";


export function ListingCard({ item }: { item: Property }) {
  const img =
    item.images?.[0]?.url || 'https://placehold.co/600x400?text=No+Image';

  const rents = item.units?.map((u) => u.rent) || [];
  const minRent = rents.length ? Math.min(...rents) : 0;
  const maxRent = rents.length ? Math.max(...rents) : 0;

  const statusLabel =
    item.status === 'PUBLISHED'
      ? 'Available'
      : item.status === 'UNPUBLISHED'
      ? 'Rented'
      : '';

  const firstUnit = item.units?.[0];
  const bedrooms = firstUnit?.bedrooms ?? 0;
  const bathrooms = firstUnit?.bathrooms ?? 0;

  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    // preload favorites if needed
  }, [item.id]);

  async function toggleFavorite() {
    try {
      const token = localStorage.getItem('rk_token');
      if (!token) {
        alert('Please login to save favorites.');
        return;
      }

      const res = await fetch(`${API_BASE}/api/favorites/${item.id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Toggle failed');
      const data = await res.json();
      setFavorited(data.favorited);
    } catch (err) {
      console.error('Favorite error', err);
      alert('Failed to update favorites');
    }
  }

  return (
    <div className="bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition transform hover:-translate-y-1 hover:scale-[1.01]">
      <div className="relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={item.title}
          className="w-full h-40 object-cover transition-transform duration-300 hover:scale-105"
        />

        {/* Status badge */}
        {statusLabel && (
          <span
            className={`absolute top-2 left-2 text-xs px-2 py-1 rounded-full font-medium ${
              statusLabel === 'Available'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {statusLabel}
          </span>
        )}

        {/* Featured badge */}
        {item.featured && (
          <span className="absolute top-2 left-20 bg-brand-red text-white text-xs px-2 py-1 rounded-full font-semibold flex items-center gap-1 shadow">
            <Star className="h-3 w-3 fill-yellow-300 text-yellow-300" />
            Featured
          </span>
        )}

        {/* Favorite icon */}
        <button
          type="button"
          className="absolute top-2 right-2 p-1 rounded-full bg-white/80 hover:bg-white transition"
          onClick={toggleFavorite}
        >
          <Heart
            className={`h-4 w-4 ${
              favorited ? 'fill-red-500 text-red-500' : 'text-brand-blue'
            }`}
          />
        </button>

        {/* Price overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2 text-sm font-semibold">
          {minRent === maxRent
            ? `KES ${currencyKES(minRent)} / month`
            : `From KES ${currencyKES(minRent)} / month`}
        </div>
      </div>

      <div className="p-3 space-y-1">
        {/* Title */}
        <h3 className="font-semibold line-clamp-1">{item.title}</h3>

        {/* Location */}
        <p className="text-sm text-gray-600 flex items-center gap-1 line-clamp-1">
          <MapPin className="h-3 w-3 text-brand-blue" />
          {item.area ? `${item.area}, ` : ''}
          {item.location || ''}
          {item.county ? ` — ${item.county}` : ''}
        </p>

        {/* Beds & Baths */}
        {bedrooms > 0 || bathrooms > 0 ? (
          <div className="flex gap-2 text-xs mt-1">
            {bedrooms > 0 && (
              <span className="bg-gray-100 px-2 py-0.5 rounded">
                {bedrooms} Bed{bedrooms > 1 ? 's' : ''}
              </span>
            )}
            {bathrooms > 0 && (
              <span className="bg-gray-100 px-2 py-0.5 rounded">
                {bathrooms} Bath{bathrooms > 1 ? 's' : ''}
              </span>
            )}
          </div>
        ) : null}

        {/* Details link */}
        <Link
          href={`/properties/${item.id}`}
          className="inline-block mt-2 text-sm text-brand-blue hover:underline"
        >
          View details
        </Link>
      </div>
    </div>
  );
}