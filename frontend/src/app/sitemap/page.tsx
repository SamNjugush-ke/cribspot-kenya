import Link from "next/link";

export default function SitemapPage() {
  const pages = [
    ["/", "Home"],
    ["/browse", "Browse Properties"],
    ["/featured", "Featured Listings"],
    ["/pricing", "Pricing"],
    ["/list-property", "List Your Property"],
    ["/blog", "Home Hunt Help Blog"],
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Sitemap</h1>
      <p className="mt-3 text-slate-600">
        Key public pages on CribSpot Kenya.
      </p>

      <ul className="mt-8 space-y-3">
        {pages.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-teal-700 hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-slate-500">
        XML sitemap:{" "}
        <Link href="/sitemap.xml" className="text-teal-700 hover:underline">
          /sitemap.xml
        </Link>
      </p>
    </main>
  );
}