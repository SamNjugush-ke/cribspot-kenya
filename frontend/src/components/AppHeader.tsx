//frontend/src/components/AppHeader.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, LogOut, User, LayoutDashboard, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

// very small helper; no global auth context changes needed
type Me = { id: string; name: string; email: string; role: 'LISTER'|'RENTER'|'AGENT'|'ADMIN'|'SUPER_ADMIN'|'EDITOR' };

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // fetch me only if token present
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = localStorage.getItem('rk_token');
    if (!t) { setMe(null); return; }
    (async () => {
      try {
        const res = await api.get<{ user: Me }>('/api/auth/me');
        setMe(res.data?.user ?? null);
      } catch {
        setMe(null);
      }
    })();
  }, [pathname]);

  const onLogout = () => {
    localStorage.removeItem('rk_token');
    router.replace('/login');
  };

  const onStartListing = () => {
    // if logged in, go to lister dashboard (or lister flow); else go login with next
    if (me?.role === 'LISTER') {
      router.push('/dashboard/lister');
    } else {
      router.push('/login?next=/lister/list');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white">
      <div className="container flex h-16 items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-2 rounded hover:bg-gray-100" aria-label="menu">
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/" className="flex items-center gap-2">
            {/* logo as requested */}
            <Image src="/logo.svg" alt="CribSpot Kenya" width={142} height={28} priority />
            <span className="sr-only">CribSpot Kenya</span>
          </Link>

          <nav className="hidden md:flex items-center gap-5 ml-4">
            <Link href="/browse" className={linkCls('/browse', pathname)}>Browse</Link>
            <Link href="/pricing" className={linkCls('/pricing', pathname)}>Pricing</Link>
            <Link href="/blog" className={linkCls('/blog', pathname)}>Blog</Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Start Listing button - always visible on public header */}
          <Button onClick={onStartListing} className="hidden sm:inline-flex hover:bg-[#0a1f44]/90">
            Start Listing
          </Button>

          {!me ? (
            <>
              <Link href="/login" className="px-3 py-2 text-sm rounded bg-brand-blue text-white hover:bg-brand-red">Login</Link>
              <Link href="/signup" className="px-3 py-2 text-sm rounded bg-brand-blue text-white hover:bg-brand-red">Sign up</Link>
            </>
          ) : (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="flex items-center gap-2 rounded-full px-3 py-2 hover:bg-gray-100"
              >
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center font-medium">
                  {initials(me.name)}
                </div>
                <span className="hidden sm:inline text-sm">{me.name}</span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-md border bg-white shadow-md overflow-hidden"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <div className="px-3 py-3 border-b">
                    <div className="text-sm font-medium">{me.name}</div>
                    <div className="text-xs text-gray-500">{me.email}</div>
                  </div>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                    onClick={() => router.push(roleHome(me.role))}
                  >
                    <LayoutDashboard className="h-4 w-4" /> Dashboard
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                    onClick={() => router.push('/profile')}
                  >
                    <User className="h-4 w-4" /> Profile
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    onClick={onLogout}
                  >
                    <LogOut className="h-4 w-4" /> Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function linkCls(href: string, pathname: string) {
  const active = pathname === href;
  return cn(
    'text-sm px-2 py-1 rounded-md',
    active ? 'font-medium bg-gray-100' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
  );
}

function initials(name?: string) {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  const a = parts[0]?.[0] ?? '';
  const b = parts[1]?.[0] ?? '';
  return (a + b || a).toUpperCase();
}

function roleHome(role: Me['role']) {
  switch (role) {
    case 'LISTER': return '/dashboard/lister';
    case 'RENTER': return '/dashboard/renter';
    case 'AGENT': return '/dashboard/agent';
    case 'EDITOR': return '/dashboard/editor';
    case 'ADMIN': return '/dashboard/admin';
    case 'SUPER_ADMIN': return '/dashboard/super';
    default: return '/';
  }
}
