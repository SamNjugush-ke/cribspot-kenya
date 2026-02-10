'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import DashboardHeader from './DashboardHeader';
import api from '@/lib/api';
import type { Role } from '@/types/user';

type Me = { id: string; name: string; email: string; role: Role };

function dashboardRoot(role: Role) {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/dashboard/super';
    case 'ADMIN':
      return '/dashboard/admin';
    case 'LISTER':
      return '/dashboard/lister';
    case 'RENTER':
      return '/dashboard/renter';
    case 'AGENT':
      return '/dashboard/agent';
    case 'EDITOR':
      return '/dashboard/editor';
    default:
      return '/dashboard';
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const token = typeof window !== 'undefined' ? localStorage.getItem('rk_token') : null;
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname || '/dashboard')}`);
      return;
    }

    (async () => {
      const res = await api.get<{ user: Me }>('/api/auth/me');

      if (res.ok && res.data?.user) {
        if (isMounted) setMe(res.data.user);

        if (pathname === '/dashboard') {
          router.replace(dashboardRoot(res.data.user.role));
        }
      } else {
        localStorage.removeItem('rk_token');
        router.replace('/login');
      }

      if (isMounted) setReady(true);
    })();

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading dashboard…
      </div>
    );
  }

  if (!me) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader role={me.role} />
      <div className="flex">
        <Sidebar role={me.role} />
        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}