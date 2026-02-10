'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type MinimalUser = { id: string; name?: string; email?: string; role?: string };

const AUTH_EVENT = 'rk:auth';

function dashboardFor(role?: string) {
  const r = String(role || '').toUpperCase();
  if (r === 'SUPER_ADMIN') return '/dashboard/super';
  if (r === 'ADMIN') return '/dashboard/admin';
  if (r === 'EDITOR') return '/dashboard/editor';
  if (r === 'AGENT') return '/dashboard/agent';
  if (r === 'LISTER') return '/dashboard/lister';
  if (r === 'RENTER') return '/dashboard/renter';
  return '/dashboard';
}

function readUser(): MinimalUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('rk_user');
  try {
    return raw ? (JSON.parse(raw) as MinimalUser) : null;
  } catch {
    return null;
  }
}

function notifyAuthChanged() {
  // same-tab notifier (storage event won't fire on same tab)
  window.dispatchEvent(new Event(AUTH_EVENT));
  // also dispatch a generic event some other parts might listen to
  window.dispatchEvent(new Event('storage'));
}

export function Header() {
  const router = useRouter();
  const [user, setUser] = useState<MinimalUser | null>(null);

  useEffect(() => {
    const sync = () => setUser(readUser());

    // initial
    sync();

    // cross-tab updates
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rk_user' || e.key === 'rk_token') sync();
    };

    // same-tab updates
    const onAuth = () => sync();

    // visibility/focus updates
    const onFocus = () => sync();

    window.addEventListener('storage', onStorage);
    window.addEventListener(AUTH_EVENT, onAuth as any);
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(AUTH_EVENT, onAuth as any);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const displayName = useMemo(() => {
    if (!user) return '';
    return user.name?.trim() || user.email?.split('@')?.[0] || 'Account';
  }, [user]);

  const isLister = String(user?.role || '').toUpperCase() === 'LISTER';

  const logout = () => {
    // Clear auth
    localStorage.removeItem('rk_token');
    localStorage.removeItem('rk_user');

    // clear impersonation keys too
    localStorage.removeItem('rk_token_impersonator');
    localStorage.removeItem('rk_impersonated_user');
    localStorage.removeItem('rk_impersonator_user');

    localStorage.removeItem('rk_impersonator_token');
    localStorage.removeItem('rk_impersonating');

    localStorage.removeItem('rk_last_activity');
    localStorage.removeItem('rk_last_me_check');

    // Immediately update header state on same tab
    notifyAuthChanged();

    // Go to login (as you want)
    router.replace('/login');
  };

  const handleListProperty = () => {
    if (isLister) {
      router.push('/dashboard/lister/list');
      return;
    }
    router.push('/list-property');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b">
      <div className="container h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="CribSpot Kenya" width={120} height={32} style={{ height: 'auto' }} />
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={handleListProperty}
            className="px-3 py-1.5 rounded-lg border text-brand-blue border-brand-blue hover:bg-brand-blue hover:text-white transition"
          >
            List Property
          </button>

          {user ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-800">{displayName}</span>
              <span className="opacity-40">|</span>
              <button className="text-brand-blue hover:underline" onClick={() => router.push(dashboardFor(user.role))}>
                Dashboard
              </button>
              <span className="opacity-40">|</span>
              <button className="text-red-600 hover:underline" onClick={logout}>
                Logout
              </button>
            </div>
          ) : (
            <>
              <Link href="/signup" className="px-3 py-1.5 rounded-lg bg-brand-blue text-white shadow-soft hover:bg-brand-red">
                Sign Up
              </Link>
              <Link href="/login" className="px-3 py-1.5 rounded-lg bg-brand-blue text-white shadow-soft hover:bg-brand-red">
                Login
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}