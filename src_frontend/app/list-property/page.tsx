//frontend/src/app/list-property/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';
import EP from '@/lib/endpoints';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Plan = {
  id: string;
  name: string;
  price: number;
  durationInDays: number;
  totalListings: number;
  featuredListings: number;
};

type MinimalUser = { id: string; name?: string; email?: string; role?: string };

export default function ListPropertyGatePage() {
  const router = useRouter();
  const [user, setUser] = useState<MinimalUser | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem('rk_user');
    setUser(raw ? JSON.parse(raw) : null);
  }, []);

  useEffect(() => {
    // If logged-in lister => go straight to listing flow
    const role = String(user?.role || '').toUpperCase();
    if (role === 'LISTER') {
      router.replace('/dashboard/lister/list');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    apiGet<Plan[]>(EP.plans).then(({ ok, json }) => {
      setPlans(ok && Array.isArray(json) ? json : []);
    });
  }, []);

  const loggedIn =
  typeof window !== 'undefined' && !!localStorage.getItem('rk_token');


  const formatListings = (listings: number) => {
    if (listings >= 100000) return 'Unlimited Units';
    return `${listings} listings`;
  };

  return (
    <div className="container py-10 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">List your property</h1>
        <p className="text-sm text-gray-600">
          {loggedIn
            ? 'You are logged in, but this account is not a Lister. You can create/sign in to a Lister account to continue.'
            : 'Choose a package to start listing. If you already have a Lister account, just log in.'}
        </p>

        <div className="flex gap-2 flex-wrap">
          <Link href="/signup">
            <Button className="bg-brand-blue text-white">Sign up</Button>
          </Link>
          <Link href="/login?next=%2Fdashboard%2Flister%2Flist">
            <Button variant="outline">Login</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className="rounded-2xl shadow-lg p-6 bg-white border border-gray-200">
            <div className="space-y-3">
              <div className="text-xl font-bold">{p.name}</div>
              <div className="text-3xl font-extrabold text-brand-blue">
                KES {p.price.toLocaleString()}
              </div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>{p.durationInDays} days</li>
                <li>{formatListings(p.totalListings)}</li>
                <li>{p.featuredListings} featured</li>
              </ul>

              <div className="pt-2 text-xs text-gray-500">
                After purchase, you’ll be able to create listings from your Lister dashboard.
              </div>

              <Link href="/pricing">
                <Button className="w-full mt-3 bg-brand-blue text-white">View / Buy</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
