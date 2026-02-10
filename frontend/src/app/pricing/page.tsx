// src/app/pricing/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import EP from '@/lib/endpoints';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import CheckoutDialog, { type Plan } from '@/components/billing/CheckoutDialog';

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Plan | null>(null);

  useEffect(() => {
    apiGet<Plan[]>(EP.plans).then(({ ok, json }) => {
      const arr = ok && Array.isArray(json) ? (json as any[]) : [];
      setPlans(
        arr.map((p) => ({
          ...p,
          isActive: typeof p.isActive === 'boolean' ? p.isActive : true,
        }))
      );
    });
  }, []);

  

  const formatListings = (listings: number) => {
    if (listings >= 100000) return 'Unlimited Units';
    return `${listings} listings`;
  };

  return (
    <div className="container py-12">
      <h1 className="text-3xl font-extrabold mb-12 text-center text-[#004AAD]">
        Choose a plan
      </h1>

      <div className="grid gap-8 md:grid-cols-3">
        {plans.map((p) => (
          <Card
            key={p.id}
            className="rounded-2xl shadow-lg p-8 flex flex-col justify-between bg-white border border-gray-200 hover:shadow-xl transition"
          >
            <div>
              {/* Plan name */}
              <h3 className="text-2xl font-bold text-gray-900">{p.name}</h3>

              {/* Price */}
              <div className="mt-4 text-4xl font-extrabold text-[#004AAD]">
                KES {p.price.toLocaleString()}
              </div>

              {/* Features */}
              <ul className="mt-6 space-y-2 text-gray-700 text-sm">
                <li>{p.durationInDays} days</li>
                <li>{formatListings(p.totalListings)}</li>
                <li>{p.featuredListings} featured</li>
              </ul>
            </div>

            {/* CTA Button */}
            <Button
              className="w-full mt-8 bg-[#004AAD] hover:bg-[#003580]"
              onClick={() => {
                setSelected(p);
                setOpen(true);
              }}
            >
              Get {p.name}
            </Button>
          </Card>
        ))}
      </div>

      <CheckoutDialog open={open} onOpenChange={setOpen} plan={selected} />
    </div>
  );
}
