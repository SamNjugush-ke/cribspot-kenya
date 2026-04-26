import type { Metadata, Viewport } from "next";
import "./globals.css";
import LayoutShell from "./layout-shell";
import Script from "next/script";

const siteUrl = "https://cribspot.co.ke";
const siteName = "CribSpot Kenya";
const defaultTitle =
  "CribSpot Kenya | Houses, Bedsitters & Apartments for Rent";
const defaultDescription =
  "Find houses, bedsitters, apartments and rental properties across Kenya. Browse verified listings, compare rental options, or list your property on CribSpot Kenya.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  applicationName: siteName,
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,

  keywords: [
    "CribSpot Kenya",
    "houses for rent in Kenya",
    "apartments for rent in Kenya",
    "bedsitters for rent in Kenya",
    "rental houses Kenya",
    "property listings Kenya",
    "houses to let Kenya",
    "list property Kenya",
    "rental marketplace Kenya",
  ],

  authors: [{ name: "CribSpot Kenya" }],
  creator: "CribSpot Kenya",
  publisher: "CribSpot Kenya",

  alternates: {
    canonical: siteUrl,
  },

  openGraph: {
    type: "website",
    locale: "en_KE",
    url: siteUrl,
    siteName,
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CribSpot Kenya - Find rental homes across Kenya",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/og-image.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },

  manifest: "/site.webmanifest",

  category: "real estate",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F766E",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="en-KE">
      <body className="min-h-screen flex flex-col">
        {gaId ? (
          <>
            <Script
              id="ga-src"
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            />
            <Script id="ga-inline" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        ) : null}

        <Script
          id="adsense-script"
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6820149438274131"
          crossOrigin="anonymous"
        />

        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}