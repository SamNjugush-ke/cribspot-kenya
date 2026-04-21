import "./globals.css";
import LayoutShell from "./layout-shell";
import Script from "next/script";

export const metadata = {
  title: "CribSpot Kenya",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="en">
      <head>
        {gaId ? (
          <>
            <Script
              id="ga-src"
              async
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
          async
          strategy="afterInteractive"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6820149438274131"
          crossOrigin="anonymous"
        />
      </head>

      <body className="min-h-screen flex flex-col">
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}