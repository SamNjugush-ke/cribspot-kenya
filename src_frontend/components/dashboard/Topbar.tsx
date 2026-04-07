'use client';
import Link from 'next/link';
import AccountMenu from '@/components/site/AccountMenu';
import { useEffect, useState } from 'react';
import type { Role } from '@/types/user';
import { Button } from '@/components/ui/button';

type MinimalUser = { id: string; name?: string; email?: string; role?: Role };

export default function Topbar() {
  const [user, setUser] = useState<MinimalUser | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('rk_user');
    setUser(raw ? JSON.parse(raw) : null);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rk_user' || e.key === 'rk_token') {
        const r = localStorage.getItem('rk_user');
        setUser(r ? JSON.parse(r) : null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isLister = user?.role?.toUpperCase() === 'LISTER';

  return (
    <div className="sticky top-0 z-30 bg-white border-b">
      <div className="h-14 px-4 md:px-6 flex items-center justify-between">
        <div className="font-semibold">Dashboard</div>
        <div className="flex items-center gap-3">
          {isLister && (
            <Link href="/dashboard/lister/billing">
              <Button size="sm" variant="outline">Upgrade plan</Button>
            </Link>
          )}
          {user && <AccountMenu user={user} />}
        </div>
      </div>
    </div>
  );
}