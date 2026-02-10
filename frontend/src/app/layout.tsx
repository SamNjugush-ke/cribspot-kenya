'use client';

import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { usePathname } from 'next/navigation';
import AuthBootstrap from '@/components/auth/AuthBootstrap';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith('/dashboard');

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <AuthBootstrap />
        {/* Show public header/footer only outside dashboard */}
        {!isDashboard && <Header />}
        <main className="flex-1">{children}</main>
        {!isDashboard && <Footer />}
      </body>
    </html>
  );
}
