// src/app/pricing/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import EP from "@/lib/endpoints";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import CheckoutDialog, { type Plan } from "@/components/billing/CheckoutDialog";
import { LockKeyhole, LogIn, UserPlus } from "lucide-react";

function formatListings(listings: number) {
  if (listings >= 100000) return "Unlimited listings";
  return `${listings} listing${listings === 1 ? "" : "s"}`;
}

export default function PricingPage() {
  const router = useRouter();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(!!localStorage.getItem("rk_token"));
  }, []);

  useEffect(() => {
    apiGet<Plan[]>(EP.plans).then(({ ok, json }) => {
      const arr = ok && Array.isArray(json) ? (json as any[]) : [];
      setPlans(
        arr.map((p) => ({
          ...p,
          isActive: typeof p.isActive === "boolean" ? p.isActive : true,
        }))
      );
    });
  }, []);

  const activePlans = useMemo(() => plans.filter((p) => p.isActive !== false), [plans]);

  function handlePlanClick(plan: Plan) {
    if (!hasToken) {
      router.push("/login?next=%2Fdashboard%2Flister%2Fbilling");
      return;
    }

    router.push("/dashboard/lister/billing");
  }

  return (
    <main className="container py-12 space-y-8">
      {!hasToken ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-amber-800">
                <LockKeyhole className="h-4 w-4" />
                Login required before payment
              </div>
              <h1 className="mt-3 text-2xl font-bold text-gray-900">
                Create or log into a Lister account first
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-700">
                Packages are paid for from the Lister billing page so every payment
                is attached to an account and can activate the right subscription.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="/signup?next=%2Fdashboard%2Flister%2Fbilling">
                <Button className="bg-brand-blue text-white">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Sign up
                </Button>
              </Link>
              <Link href="/login?next=%2Fdashboard%2Flister%2Fbilling">
                <Button variant="outline">
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </Button>
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <h1 className="mb-3 text-center text-3xl font-extrabold text-[#004AAD]">
          Choose a plan
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-gray-600">
          {hasToken
            ? "Continue to billing to buy, renew, or extend a package."
            : "Review the packages below. You will be asked to log in before payment."}
        </p>

        <div className="grid gap-8 md:grid-cols-3">
          {activePlans.map((p) => (
            <Card
              key={p.id}
              className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-8 shadow-lg transition hover:shadow-xl"
            >
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{p.name}</h3>

                <div className="mt-4 text-4xl font-extrabold text-[#004AAD]">
                  KES {Number(p.price || 0).toLocaleString()}
                </div>

                <ul className="mt-6 space-y-2 text-sm text-gray-700">
                  <li>{p.durationInDays} days</li>
                  <li>{formatListings(p.totalListings)}</li>
                  <li>{p.featuredListings} featured listing slot(s)</li>
                </ul>
              </div>

              <Button
                className="mt-8 w-full bg-[#004AAD] hover:bg-[#003580]"
                onClick={() => handlePlanClick(p)}
              >
                {hasToken ? "Go to billing" : `Login to get ${p.name}`}
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <CheckoutDialog open={open} onOpenChange={setOpen} plan={selected} />
    </main>
  );
}