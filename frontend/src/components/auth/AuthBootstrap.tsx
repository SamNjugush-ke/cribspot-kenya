'use client';

import { useEffect } from 'react';
import { apiGet } from '@/lib/api';

const USER_KEY = 'rk_user';
const TOKEN_KEY = 'rk_token';
const LAST_ACTIVITY_KEY = 'rk_last_activity';

// Adjust to taste (e.g. 2h, 4h, 8h).
// This is your “session expires out of inactivity” behavior.
const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

// Avoid spamming /me on every render
const ME_REFRESH_THROTTLE_MS = 2 * 60 * 1000;
const LAST_ME_CHECK_KEY = 'rk_last_me_check';

type MinimalUser = { id: string; name?: string; email?: string; role?: string };

function now() {
  return Date.now();
}

function readNum(key: string) {
  if (typeof window === 'undefined') return 0;
  const v = localStorage.getItem(key);
  const n = v ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
}

function setNum(key: string, val: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, String(val));
}

function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);

  // impersonation-related keys (both conventions)
  localStorage.removeItem('rk_token_impersonator');
  localStorage.removeItem('rk_impersonated_user');
  localStorage.removeItem('rk_impersonator_user');

  localStorage.removeItem('rk_impersonator_token');
  localStorage.removeItem('rk_impersonating');

  localStorage.removeItem(LAST_ACTIVITY_KEY);
  localStorage.removeItem(LAST_ME_CHECK_KEY);
}

async function hydrateMeIfNeeded() {
  if (typeof window === 'undefined') return;

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    localStorage.removeItem(USER_KEY);
    return;
  }

  const lastCheck = readNum(LAST_ME_CHECK_KEY);
  const tooSoon = lastCheck && now() - lastCheck < ME_REFRESH_THROTTLE_MS;
  const hasUser = !!localStorage.getItem(USER_KEY);

  // If we already have a user and checked recently, do nothing.
  if (hasUser && tooSoon) return;

  setNum(LAST_ME_CHECK_KEY, now());

  const res = await apiGet<{ user: MinimalUser }>('/api/auth/me');
  if (!res.ok || !res.data?.user) {
    // Token invalid/expired -> clear and bounce to login only if user is in protected areas
    clearAuth();
    return;
  }

  localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
}

export default function AuthBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Seed activity timestamp
    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
      setNum(LAST_ACTIVITY_KEY, now());
    }

    // Hydrate user on first load (token-only -> token+user)
    hydrateMeIfNeeded().catch(() => {});

    // Activity listeners (idle timeout)
    const bump = () => setNum(LAST_ACTIVITY_KEY, now());

    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, bump, { passive: true }));

    // Idle checker
    const timer = window.setInterval(() => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;

      const last = readNum(LAST_ACTIVITY_KEY);
      if (!last) return;

      if (now() - last > IDLE_TIMEOUT_MS) {
        // Respect “expires out of inactivity”
        clearAuth();

        // If you’re on dashboard pages, send to login
        const path = window.location.pathname || '';
        if (path.startsWith('/dashboard')) {
          window.location.href = '/login?reason=idle';
        } else {
          // Public pages: just refresh header state
          window.dispatchEvent(new StorageEvent('storage', { key: USER_KEY }));
        }
      }
    }, 30_000);

    // Cross-tab sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY || e.key === USER_KEY) {
        hydrateMeIfNeeded().catch(() => {});
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, bump));
      window.clearInterval(timer);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return null;
}
