'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, API_BASE } from '@/lib/api';

type Blog = {
  id: string;
  title: string;
  slug: string;
  coverImage?: string | null;
  excerpt?: string | null;
  published?: boolean;
  publishedAt?: string | null;
  contentHtml?: string | null;
  authorUser?: { id: string; name: string | null };

  categories?: { category: { id: string; name: string; slug: string } }[];
  tags?: { tag: { id: string; name: string; slug: string } }[];
};

const formatImageUrl = (coverImage?: string | null) => {
  if (!coverImage) return null;
  if (coverImage.startsWith('http://') || coverImage.startsWith('https://')) return coverImage;
  return `${API_BASE}${coverImage}`;
};

export default function BlogPreviewPage({ params }: { params: { id: string } }) {
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr(null);

    apiGet<Blog>(`/api/blogs/${params.id}`)
      .then((res) => {
        if (!mounted) return;
        setBlog(res.json);
      })
      .catch((e: any) => {
        if (!mounted) return;
        setErr(e?.message || 'Failed to load preview');
        setBlog(null);
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [params.id]);

  if (loading) return <div className="p-6 text-sm text-gray-600">Loading preview…</div>;

  if (err || !blog) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err || 'Blog not found'}
        </div>
        <div className="mt-4">
          <Link className="text-sm text-[#004AAD] hover:underline" href="/dashboard/editor/blogs">
            Back to posts
          </Link>
        </div>
      </div>
    );
  }

  const img = formatImageUrl(blog.coverImage);
  const cats = (blog.categories || []).map((x) => x.category);
  const tags = (blog.tags || []).map((x) => x.tag);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold">Preview</h1>
          <p className="text-sm text-gray-600">Drafts are visible here (authenticated).</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/editor/blog-editor?id=${blog.id}`}
            className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50"
          >
            Back to editor
          </Link>
          <Link
            href={`/blog/${blog.slug || blog.id}`}
            target="_blank"
            className="px-4 py-2 rounded-lg bg-[#004AAD] text-white text-sm hover:opacity-95"
          >
            Open public view
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 max-w-6xl mx-auto">
        <article className="lg:col-span-9 bg-white rounded-xl border p-5">
          <div className="mb-3 flex items-center justify-between">
            <span
              className={[
                'text-xs font-medium px-2 py-1 rounded-full border',
                blog.published
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200',
              ].join(' ')}
            >
              {blog.published ? 'Published' : 'Draft'}
            </span>

            <div className="text-xs text-gray-500">{blog.authorUser?.name ? `By ${blog.authorUser.name}` : ''}</div>
          </div>

          <h2 className="text-2xl font-semibold mb-2">{blog.title}</h2>

          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={blog.title} className="w-full h-64 object-cover rounded-xl mb-4" />
          )}

          {blog.excerpt && <p className="text-gray-700 mb-4">{blog.excerpt}</p>}

          {blog.contentHtml ? (
            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: blog.contentHtml }} />
          ) : (
            <p className="text-sm text-gray-600">No content yet.</p>
          )}
        </article>

        <aside className="lg:col-span-3 space-y-4">
          <div className="rounded-xl border bg-white p-4">
            <div className="text-sm font-semibold mb-2">Categories</div>
            {cats.length ? (
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <span key={c.id} className="text-xs px-2 py-1 rounded-full border bg-gray-50">
                    {c.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">None</div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-4">
            <div className="text-sm font-semibold mb-2">Tags</div>
            {tags.length ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t.id} className="text-xs px-2 py-1 rounded-full border bg-gray-50">
                    {t.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">None</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}