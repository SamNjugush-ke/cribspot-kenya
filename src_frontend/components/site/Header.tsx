'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import AccountMenu from '@/components/site/AccountMenu';
import type { Role } from '@/types/user';

type MinimalUser = { id: string; name?: string; email?: string; role?: Role };

export default function Header() {
  const [user, setUser] = useState<MinimalUser | null>(null);

  useEffect(() => {
    const read = () => {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('rk_user') : null;
      setUser(raw ? JSON.parse(raw) : null);
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rk_user' || e.key === 'rk_token') read();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isLister = user?.role?.toUpperCase() === 'LISTER';

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
      <div className="container h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-brand-blue">CribSpot Kenya</Link>
          <nav className="hidden md:flex items-center gap-4 text-sm text-gray-700">
            <Link href="/browse">Browse</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/blogs">Blog</Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isLister && (
            <Link href="/dashboard/lister/billing">
              <Button variant="outline" className="hidden md:inline-flex">Upgrade plan</Button>
            </Link>
          )}

          {user ? (
            <AccountMenu user={user} />
          ) : (
            <>
              <Link href="/login"><Button variant="ghost">Login</Button></Link>
              <Link href="/signup"><Button className="bg-[#004AAD] hover:bg-brand-red text-white">Sign up</Button></Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
