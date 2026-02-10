//frontend/src/app/blog/page.tsx
import Link from 'next/link';
import { API_BASE } from '@/lib/api';

type Blog = {
  id: string;
  slug: string; //
  title: string;
  coverImage?: string | null;
  excerpt?: string | null;
  publishedAt?: string | null;
};

async function fetchBlogs(): Promise<Blog[]> {
  const res = await fetch(`${API_BASE}/api/blogs?perPage=12`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

const formatImageUrl = (coverImage?: string | null) => {
  if (!coverImage) return null;
  if (coverImage.startsWith('http://') || coverImage.startsWith('https://')) {
    return coverImage;
  }
  return `${API_BASE}${coverImage}`;
};

export default async function BlogIndexPage() {
  const blogs = await fetchBlogs();

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-6">Property Advice</h1>
      {blogs.length === 0 && (
        <p className="text-gray-600">No blog posts available yet.</p>
      )}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
        {blogs.map((b) => {
          const img = formatImageUrl(b.coverImage);
          return (
            <Link
              key={b.id}
              href={`/blog/${b.slug || b.id}`}
              className="border rounded-xl overflow-hidden hover:shadow bg-white transition-shadow flex flex-col"
            >
              {img && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  alt={b.title}
                  className="h-40 w-full object-cover"
                />
              )}
              <div className="p-4 space-y-2">
                <div className="text-xs text-gray-500">
                  {b.publishedAt
                    ? new Date(b.publishedAt).toLocaleDateString()
                    : ''}
                </div>
                <h2 className="text-lg font-semibold line-clamp-2">
                  {b.title}
                </h2>
                {b.excerpt && (
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {b.excerpt}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
