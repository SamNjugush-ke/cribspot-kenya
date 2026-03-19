import { notFound } from "next/navigation";
import Link from "next/link";

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

function getRawApiHost() {
  const raw = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  return raw.replace(/\/+$/, "");
}

function getApiBase() {
  const host = getRawApiHost();
  return host.replace(/\/api\/?$/, "") + "/api";
}

async function fetchBlogById(id: string): Promise<Blog | null> {
  const base = getApiBase();
  const url = `${base}/blogs/${encodeURIComponent(id)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function fetchBlogBySlug(slug: string): Promise<Blog | null> {
  const base = getApiBase();
  const url = `${base}/blogs/slug/${encodeURIComponent(slug)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

const formatImageUrl = (coverImage?: string | null) => {
  if (!coverImage) return null;
  if (coverImage.startsWith("http://") || coverImage.startsWith("https://")) return coverImage;
  const host = getRawApiHost();
  return `${host}${coverImage.startsWith("/") ? "" : "/"}${coverImage}`;
};

function fmtDate(d?: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "";
  }
}

export default async function BlogDetailPage({ params }: { params: { id: string } }) {
  const blog = (await fetchBlogById(params.id)) || (await fetchBlogBySlug(params.id));
  if (!blog) notFound();

  const img = formatImageUrl(blog.coverImage);
  const cats = (blog.categories || []).map((x) => x.category);
  const tags = (blog.tags || []).map((x) => x.tag);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 min-w-0">
        <p className="mb-3 text-sm font-semibold text-[#004AAD]">Property Advice</p>

        <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-gray-900 [overflow-wrap:anywhere] sm:text-5xl">
          {blog.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          {blog.publishedAt ? <span>{fmtDate(blog.publishedAt)}</span> : null}
          {blog.authorUser?.name ? (
            <>
              <span className="opacity-60">•</span>
              <span>By {blog.authorUser.name}</span>
            </>
          ) : null}
        </div>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-12">
        <article className="min-w-0 lg:col-span-8">
          {img && <img src={img} alt={blog.title} className="h-[320px] w-full rounded-2xl border bg-white object-cover shadow-sm sm:h-[380px]" />}

          {blog.excerpt && <p className="mt-6 text-lg leading-relaxed text-gray-700 [overflow-wrap:anywhere]">{blog.excerpt}</p>}

          {blog.contentHtml ? (
            <div className="mt-6 prose prose-lg max-w-none overflow-hidden [overflow-wrap:anywhere] [&_*]: [&_*]:[overflow-wrap:anywhere] [&_img]:max-w-full [&_img]:h-auto [&_table]:w-full [&_table]:table-fixed">
              <div dangerouslySetInnerHTML={{ __html: blog.contentHtml }} />
            </div>
          ) : (
            <p className="mt-6 text-gray-600">No content.</p>
          )}
        </article>

        <aside className="space-y-5 lg:col-span-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-2 text-sm font-semibold">Categories</div>
            {cats.length ? (
              <div className="flex flex-wrap gap-2">
                {cats.map((c) => (
                  <span key={c.id} className="rounded-full border bg-gray-50 px-3 py-1 text-xs">
                    {c.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">None</div>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-2 text-sm font-semibold">Tags</div>
            {tags.length ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t.id} className="rounded-full border bg-gray-50 px-3 py-1 text-xs">
                    {t.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">None</div>
            )}
          </div>

          <div className="rounded-2xl bg-[#004AAD] p-5 text-white shadow-sm">
            <div className="text-base font-semibold">Ready to find the right place?</div>
            <p className="mt-1 text-sm text-white/90">Browse verified listings or post your property and reach renters faster.</p>

            <div className="mt-4 flex flex-col gap-2">
              <Link href="/properties" className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 font-medium text-[#004AAD] hover:opacity-95">
                Browse Properties
              </Link>
              <Link href="/list-property" className="inline-flex items-center justify-center rounded-xl border border-white/30 px-4 py-2 hover:bg-white/10">
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
