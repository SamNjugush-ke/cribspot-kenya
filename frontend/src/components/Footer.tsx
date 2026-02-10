'use client';
import { useState } from 'react';
import api from '@/lib/api';

export function Footer() {
  const [email, setEmail] = useState('');
  const [ok, setOk] = useState<string | null>(null);

  const subscribe = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setOk(null);
    try {
      await api.post('/api/marketing/subscribe', { email });
      setOk('Subscribed!');
      setEmail('');
    } catch {
      // Graceful no-op in dev
      setOk('Thanks! (dev mode)');
      setEmail('');
    }
  };

  return (
    <footer className="mt-16 border-t bg-brand-gray/60">
      {/* Top grid */}
      <div className="container mx-auto py-10 grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Brand + tagline */}
        <div className="md:col-span-4">
          <div className="flex items-center gap-3">
            {/* 512x512 source; show it clearly */}
            <img
              src="/Main_Logo.svg"
              alt="CribSpot Kenya"
              width={64}
              height={64}
              className="h-16 w-16 md:h-20 md:w-20 rounded-md"
            />
            <div>
              <p className="text-lg font-semibold tracking-tight">CribSpot Kenya</p>
              <p className="text-sm text-gray-700">
                Swift, reliable, and fast property discovery.
              </p>
            </div>
          </div>
        </div>

        {/* Explore */}
        <div className="md:col-span-3">
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide">Explore</h4>
          <ul className="space-y-1 text-sm">
            <li><a className="hover:underline" href="/browse">Browse</a></li>
            <li><a className="hover:underline" href="/featured">Featured</a></li>
            <li><a className="hover:underline" href="/blog">Property Blog</a></li>
          </ul>
        </div>

        {/* Company */}
        <div className="md:col-span-3">
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide">Company</h4>
          <ul className="space-y-1 text-sm">
            <li><a className="hover:underline" href="/about">About</a></li>
            <li><a className="hover:underline" href="/contact">Contact</a></li>
            <li><a className="hover:underline" href="/terms">Terms</a></li>
          </ul>
        </div>

        {/* Newsletter (sticks to the right on md+) */}
        <div className="md:col-span-2 md:items-end md:text-right flex flex-col">
          <h4 className="text-sm font-semibold uppercase tracking-wide">Newsletter</h4>
          <form onSubmit={subscribe} className="mt-3 flex w-full md:justify-end gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              aria-label="Email address"
              required
              className="w-full md:w-48 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-brand-red text-white text-sm font-medium hover:opacity-90 active:opacity-80"
            >
              Subscribe
            </button>
          </form>
          {ok && <p className="text-xs text-green-700 mt-2">{ok}</p>}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t">
        <div className="container mx-auto py-4 text-center text-xs text-gray-600">
          © {new Date().getFullYear()} CribSpot Kenya. All rights reserved. Developed by{' '}
          <a
            href="https://salotech.co.ke"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-blue hover:underline"
          >
            Salotech
          </a>.
        </div>
      </div>
    </footer>
  );
}