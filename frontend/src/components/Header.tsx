'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, LayoutDashboard, LogOut, User as UserIcon } from 'lucide-react';

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
  window.dispatchEvent(new Event(AUTH_EVENT));
  window.dispatchEvent(new Event('storage'));
}

function initials(name?: string, email?: string) {
  const clean = (name || '').trim();
  if (clean) {
    const parts = clean.split(/\s+/);
    const a = parts[0]?.[0] ?? '';
    const b = parts[1]?.[0] ?? '';
    return (a + b || a).toUpperCase();
  }
  return (email?.[0] || 'A').toUpperCase();
}

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<MinimalUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const sync = () => setUser(readUser());

    sync();

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'rk_user' || e.key === 'rk_token') sync();
    };

    const onAuth = () => sync();
    const onFocus = () => sync();

    window.addEventListener('storage', onStorage);
    window.addEventListener(AUTH_EVENT, onAuth as EventListener);
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(AUTH_EVENT, onAuth as EventListener);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const displayName = useMemo(() => {
    if (!user) return '';
    return user.name?.trim() || user.email?.split('@')?.[0] || 'Account';
  }, [user]);

  const isLister = String(user?.role || '').toUpperCase() === 'LISTER';

  const logout = () => {
    localStorage.removeItem('rk_token');
    localStorage.removeItem('rk_user');

    localStorage.removeItem('rk_token_impersonator');
    localStorage.removeItem('rk_impersonated_user');
    localStorage.removeItem('rk_impersonator_user');

    localStorage.removeItem('rk_impersonator_token');
    localStorage.removeItem('rk_impersonating');

    localStorage.removeItem('rk_last_activity');
    localStorage.removeItem('rk_last_me_check');

    notifyAuthChanged();
    setMobileOpen(false);
    router.replace('/login');
  };

  const handleListProperty = () => {
    setMobileOpen(false);
    if (isLister) {
      router.push('/dashboard/lister/list');
      return;
    }
    router.push('/list-property');
  };

  const goDashboard = () => {
    setMobileOpen(false);
    router.push(dashboardFor(user?.role));
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container">
        <div className="flex h-14 items-center justify-between gap-3 sm:h-16">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <Image
              src="/logo.svg"
              alt="CribSpot Kenya"
              width={140}
              height={34}
              priority
              className="h-auto w-[116px] sm:w-[136px]"
            />
          </Link>

          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={handleListProperty}
              className="rounded-xl border border-brand-blue px-4 py-2 text-sm font-medium text-brand-blue transition hover:bg-brand-blue hover:text-white"
            >
              List Property
            </button>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-xs font-semibold text-white">
                    {initials(user.name, user.email)}
                  </div>
                  <div className="max-w-[160px] truncate text-sm font-medium text-slate-800">
                    {displayName}
                  </div>
                </div>

                <button
                  className="rounded-xl px-3 py-2 text-sm font-medium text-brand-blue hover:bg-blue-50"
                  onClick={goDashboard}
                >
                  Dashboard
                </button>

                <button
                  className="rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  onClick={logout}
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-red"
                >
                  Sign Up
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-red"
                >
                  Login
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={handleListProperty}
              className="rounded-lg border border-brand-blue px-3 py-2 text-xs font-semibold text-brand-blue transition hover:bg-brand-blue hover:text-white"
            >
              List
            </button>

            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-slate-200 py-3 md:hidden">
            {user ? (
              <div className="mb-3 flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue text-sm font-semibold text-white">
                  {initials(user.name, user.email)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              {user ? (
                <>
                  <button
                    onClick={goDashboard}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </button>

                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      router.push('/profile');
                    }}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <UserIcon className="h-4 w-4" />
                    Profile
                  </button>

                  <button
                    onClick={logout}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="rounded-xl bg-brand-blue px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-red"
                  >
                    Sign Up
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-xl border border-brand-blue px-4 py-3 text-center text-sm font-semibold text-brand-blue transition hover:bg-blue-50"
                  >
                    Login
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}