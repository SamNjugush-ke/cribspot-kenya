import Link from "next/link";

type Blog = {
  id: string;
  slug: string;
  title: string;
  coverImage?: string | null;
  excerpt?: string | null;
  publishedAt?: string | null;
};

function getRawApiHost() {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000";
  return raw.replace(/\/+$/, "");
}

function getApiBase() {
  const host = getRawApiHost();
  return host.replace(/\/api\/?$/, "") + "/api";
}

async function fetchBlogs(): Promise<Blog[]> {
  const base = getApiBase();
  const url = `${base}/blogs?perPage=12`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();

  // backend might return { items } or array
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
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

export default async function BlogIndexPage() {
  const blogs = await fetchBlogs();

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Blog</h1>
          <p className="text-sm text-gray-600 mt-1">
            Property tips, market insights, and updates.
          </p>
        </div>
      </div>

      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {blogs.map((b) => {
          const img = formatImageUrl(b.coverImage);
          const href = `/blog/${b.id || b.slug}`;

          return (
            <Link
              key={b.id}
              href={href}
              className="rounded-2xl border bg-white shadow-sm overflow-hidden hover:shadow transition"
            >
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt={b.title} className="h-44 w-full object-cover" />
              ) : (
                <div className="h-44 w-full bg-gray-100" />
              )}

              <div className="p-4">
                <div className="text-xs text-gray-500">{b.publishedAt ? fmtDate(b.publishedAt) : ""}</div>
                <div className="mt-1 font-semibold">{b.title}</div>
                {b.excerpt ? <div className="mt-2 text-sm text-gray-700 line-clamp-3">{b.excerpt}</div> : null}
              </div>
            </Link>
          );
        })}
      </div>

      {blogs.length === 0 ? (
        <div className="mt-8 text-sm text-gray-600">No published posts yet.</div>
      ) : null}
    </div>
  );
}