import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/browse",
          "/featured",
          "/pricing",
          "/list-property",
          "/blog",
          "/properties",
          "/counties",
          "/areas",
        ],
        disallow: [
          "/dashboard",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/api",
        ],
      },
    ],
    sitemap: "https://cribspot.co.ke/sitemap.xml",
    host: "https://cribspot.co.ke",
  };
}