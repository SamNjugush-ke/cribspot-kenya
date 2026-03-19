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
        setBlog(res.json || null);
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
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Preview</h1>
          <p className="text-sm text-gray-600">Drafts are visible here (authenticated).</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/editor/blog-editor?id=${blog.id}`} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
            Back to editor
          </Link>
          {blog.published ? (
            <Link
              href={`/blog/${blog.slug || blog.id}`}
              target="_blank"
              className="rounded-lg bg-[#004AAD] px-4 py-2 text-sm text-white hover:opacity-95"
            >
              Open public view
            </Link>
          ) : null}
        </div>
      </div>

      {!blog.published && (
        <div className="mx-auto mb-4 max-w-6xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This post is still a draft, so public view is hidden until it is published.
        </div>
      )}

      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-12">
        <article className="min-w-0 rounded-xl border bg-white p-5 lg:col-span-9">
          <div className="mb-3 flex items-center justify-between">
            <span
              className={[
                'rounded-full border px-2 py-1 text-xs font-medium',
                blog.published
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700',
              ].join(' ')}
            >
              {blog.published ? 'Published' : 'Draft'}
            </span>

            <div className="text-xs text-gray-500">{blog.authorUser?.name ? `By ${blog.authorUser.name}` : ''}</div>
          </div>

          <h2 className="mb-2 text-2xl font-semibold [overflow-wrap:anywhere]">{blog.title}</h2>

          {img && <img src={img} alt={blog.title} className="mb-4 h-64 w-full rounded-xl object-cover" />}

          {blog.excerpt && <p className="mb-4 text-gray-700 [overflow-wrap:anywhere]">{blog.excerpt}</p>}

          {blog.contentHtml ? (
            <div
              className="prose max-w-none overflow-hidden [overflow-wrap:anywhere] [&_*]: [&_*]:[overflow-wrap:anywhere] [&_img]:max-w-full [&_img]:h-auto [&_table]:w-full [&_table]:table-fixed"
              dangerouslySetInnerHTML={{ __html: blog.contentHtml }}
            />
          ) : (
            <p className="text-sm text-gray-600">No content yet.</p>
          )}
        </article>

        <aside className="space-y-4 lg:col-span-3">
          <div className="rounded-xl border bg-white p-4">
            <div className="mb-2 text-sm font-semibold">Categories</div>
            {cats.length ? (
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <span key={c.id} className="rounded-full border bg-gray-50 px-2 py-1 text-xs">
                    {c.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">None</div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-4">
            <div className="mb-2 text-sm font-semibold">Tags</div>
            {tags.length ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t.id} className="rounded-full border bg-gray-50 px-2 py-1 text-xs">
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
