import type { MetadataRoute } from "next";

const SITE_URL = "https://cribspot.co.ke";
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "").replace(/\/api$/, "") ||
  "https://api.cribspot.co.ke";

type PropertyItem = {
  id: string;
  updatedAt?: string;
  createdAt?: string;
  county?: string | null;
  area?: string | null;
};

type BlogItem = {
  id: string;
  slug?: string | null;
  publishedAt?: string | null;
};

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/browse`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/featured`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/list-property`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/signup`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const propertiesRes = await getJson<{
    items?: PropertyItem[];
  }>(`${API_BASE}/api/properties?status=PUBLISHED&limit=50`);

  const blogsRes = await getJson<{
    items?: BlogItem[];
  }>(`${API_BASE}/api/blogs?status=published&perPage=50`);

  const propertyPages: MetadataRoute.Sitemap =
    propertiesRes?.items?.map((p) => ({
      url: `${SITE_URL}/properties/${p.id}`,
      lastModified: p.updatedAt || p.createdAt || now,
      changeFrequency: "weekly",
      priority: 0.85,
    })) || [];

  const blogPages: MetadataRoute.Sitemap =
    blogsRes?.items?.map((b) => ({
      url: `${SITE_URL}/blog/${b.slug || b.id}`,
      lastModified: b.publishedAt || now,
      changeFrequency: "monthly",
      priority: 0.75,
    })) || [];

  return [...staticPages, ...propertyPages, ...blogPages];
}