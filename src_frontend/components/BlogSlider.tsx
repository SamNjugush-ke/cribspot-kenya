//frontend/src/components/BlogSlider.tsx code:
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, API_BASE } from '@/lib/api';

type Blog = {
  id: string;
  title: string;
  coverImage?: string | null;
  publishedAt?: string | null;
  excerpt?: string | null;
};

export default function BlogSlider() {
  const [items, setItems] = useState<Blog[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    apiGet<Blog[]>('/api/blogs/latest', { params: { limit: 8 } })
      .then((res) => {
        if (!mounted) return;
        const data = res.json;
        setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!mounted) return;
        setItems([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const placeholderCards = Array.from({ length: 8 }).map((_, i) => (
    <div
      key={i}
      className="rounded-xl border overflow-hidden flex flex-col animate-pulse bg-gray-50"
    >
      <div className="h-32 w-full bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  ));

  const formatImageUrl = (coverImage?: string | null) => {
    if (!coverImage) return null;
    // Already absolute (Cloudinary etc.)
    if (
      coverImage.startsWith('http://') ||
      coverImage.startsWith('https://')
    ) {
      return coverImage;
    }
    // Relative path from backend (/uploads/...)
    return `${API_BASE}${coverImage}`;
  };

  return (
    <section className="py-10 bg-[#F5F7FB]">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Property Advice
          </h2>
          <Link
            href="/blog"
            className="text-sm text-[#004AAD] hover:underline"
          >
            View all posts
          </Link>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          {loading && !items
            ? placeholderCards
            : items && items.length > 0
            ? items.map((b) => {
                const img = formatImageUrl(b.coverImage);
                return (
                  <Link
                    key={b.id}
                    href={`/blog/${b.id}`}
                    className="rounded-xl border overflow-hidden hover:shadow flex flex-col bg-white transition-shadow"
                  >
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={b.title}
                        className="h-32 w-full object-cover"
                      />
                    ) : (
                      <div className="h-32 w-full bg-gray-200" />
                    )}
                    <div className="p-3">
                      <div className="text-xs text-gray-500 mb-1">
                        {b.publishedAt
                          ? new Date(b.publishedAt).toLocaleDateString()
                          : ''}
                      </div>
                      <div className="text-sm font-medium line-clamp-2">
                        {b.title}
                      </div>
                    </div>
                  </Link>
                );
              })
            : placeholderCards}
        </div>
      </div>
    </section>
  );
}
