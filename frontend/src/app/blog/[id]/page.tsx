import { notFound } from 'next/navigation';
import Link from 'next/link';
import { API_BASE } from '@/lib/api';

type Blog = {
  id: string;
  slug: string;
  title: string;
  coverImage?: string | null;
  contentHtml?: string | null;
  excerpt?: string | null;
  publishedAt?: string | null;
  authorUser?: { id: string; name: string | null };
  categories?: { category: { id: string; name: string; slug: string } }[];
  tags?: { tag: { id: string; name: string; slug: string } }[];
};

async function fetchBlogById(id: string): Promise<Blog | null> {
  const res = await fetch(`${API_BASE}/api/blogs/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

async function fetchBlogBySlug(slug: string): Promise<Blog | null> {
  const res = await fetch(`${API_BASE}/api/blogs/slug/${slug}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

const formatImageUrl = (coverImage?: string | null) => {
  if (!coverImage) return null;
  if (coverImage.startsWith('http://') || coverImage.startsWith('https://')) return coverImage;
  return `${API_BASE}${coverImage}`;
};

function fmtDate(d?: string | null) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '';
  }
}

export default async function BlogDetailPage({ params }: { params: { id: string } }) {
  const blog = (await fetchBlogById(params.id)) || (await fetchBlogBySlug(params.id));
  if (!blog) notFound();

  const img = formatImageUrl(blog.coverImage);
  const cats = (blog.categories || []).map((x) => x.category);
  const tags = (blog.tags || []).map((x) => x.tag);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* ✅ Full-width header row */}
      <header className="mb-8">
        <p className="text-sm text-[#004AAD] font-semibold mb-3">Property Advice</p>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
          {blog.title}
        </h1>

        <div className="mt-4 text-sm text-gray-500 flex flex-wrap items-center gap-2">
          {blog.publishedAt ? <span>{fmtDate(blog.publishedAt)}</span> : null}
          {blog.authorUser?.name ? (
            <>
              <span className="opacity-60">•</span>
              <span>By {blog.authorUser.name}</span>
            </>
          ) : null}
        </div>
      </header>

      {/* ✅ Content row: left + right */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* LEFT: cover image + content */}
        <article className="lg:col-span-8">
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={blog.title}
              className="w-full h-[320px] sm:h-[380px] object-cover rounded-2xl border bg-white shadow-sm"
            />
          )}

          {blog.excerpt && (
            <p className="mt-6 text-lg text-gray-700 leading-relaxed">
              {blog.excerpt}
            </p>
          )}

          {blog.contentHtml ? (
            <div className="mt-6 prose prose-lg max-w-none">
              <div dangerouslySetInnerHTML={{ __html: blog.contentHtml }} />
            </div>
          ) : (
            <p className="mt-6 text-gray-600">No content.</p>
          )}
        </article>

        {/* RIGHT: categories + tags + CTA */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold mb-2">Categories</div>
            {cats.length ? (
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <span key={c.id} className="text-xs px-3 py-1 rounded-full border bg-gray-50">
                    {c.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">None</div>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold mb-2">Tags</div>
            {tags.length ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t.id} className="text-xs px-3 py-1 rounded-full border bg-gray-50">
                    {t.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">None</div>
            )}
          </div>

          {/* ✅ CTA / extra content so sidebar isn't empty */}
          <div className="rounded-2xl border bg-[#004AAD] text-white p-5 shadow-sm">
            <div className="text-base font-semibold">Ready to find the right place?</div>
            <p className="mt-1 text-sm text-white/90">
              Browse verified listings or post your property and reach renters faster.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/properties"
                className="inline-flex items-center justify-center rounded-xl bg-white text-[#004AAD] font-medium px-4 py-2 hover:opacity-95"
              >
                Browse Properties
              </Link>
              <Link
                href="/list-property"
                className="inline-flex items-center justify-center rounded-xl border border-white/30 px-4 py-2 hover:bg-white/10"
              >
                List a Property
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold">More to explore</div>
            <div className="mt-3 space-y-2 text-sm">
              <Link href="/blog" className="block text-[#004AAD] hover:underline">
                Browse more articles →
              </Link>
              <Link href="/dashboard" className="block text-[#004AAD] hover:underline">
                Go to your dashboard →
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
