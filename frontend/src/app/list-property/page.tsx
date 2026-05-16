// frontend/src/app/list-property/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import EP from "@/lib/endpoints";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, LockKeyhole, LogIn, UserPlus } from "lucide-react";

type Plan = {
  id: string;
  name: string;
  price: number;
  durationInDays: number;
  totalListings: number;
  featuredListings: number;
  isActive?: boolean;
};

type MinimalUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
};

function safeReadUser(): MinimalUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem("rk_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function formatListings(listings: number) {
  if (listings >= 100000) return "Unlimited listings";
  return `${listings} listing${listings === 1 ? "" : "s"}`;
}

export default function ListPropertyGatePage() {
  const router = useRouter();

  const [user, setUser] = useState<MinimalUser | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    setUser(safeReadUser());
    setHasToken(!!localStorage.getItem("rk_token"));
  }, []);

  useEffect(() => {
    let alive = true;

    apiGet<Plan[]>(EP.plans)
      .then(({ ok, json }) => {
        if (!alive) return;
        const arr = ok && Array.isArray(json) ? json : [];
        setPlans(arr.filter((p) => p.isActive !== false));
      })
      .finally(() => {
        if (alive) setLoadingPlans(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const role = useMemo(() => String(user?.role || "").toUpperCase(), [user?.role]);
  const loggedIn = hasToken;

  function goToBilling() {
    if (!loggedIn) {
      router.push("/login?next=%2Fdashboard%2Flister%2Fbilling");
      return;
    }

    router.push("/dashboard/lister/billing");
  }

  return (
    <main className="container py-10 space-y-8">
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-center">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-blue/10 px-3 py-1 text-sm font-medium text-brand-blue">
              <LockKeyhole className="h-4 w-4" />
              Account required before payment
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              List your property on CribSpot Kenya
            </h1>

            <p className="max-w-2xl text-sm leading-6 text-gray-600">
              To avoid orphan payments, packages can only be bought from a logged-in
              Lister account. Sign up or log in first, then continue to billing and
              publish your listing from your dashboard.
            </p>

            {loggedIn ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <div className="font-semibold">You are signed in.</div>
                <div>
                  Continue to billing to buy or manage a package. After payment,
                  you can list from your Lister dashboard.
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="font-semibold">You are not signed in.</div>
                <div>
                  Create a Lister account or log in before buying a package.
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {!loggedIn ? (
                <>
                  <Link href="/signup?next=%2Fdashboard%2Flister%2Fbilling">
                    <Button className="bg-brand-blue text-white">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Sign up as Lister
                    </Button>
                  </Link>

                  <Link href="/login?next=%2Fdashboard%2Flister%2Fbilling">
                    <Button variant="outline">
                      <LogIn className="mr-2 h-4 w-4" />
                      Login
                    </Button>
                  </Link>
                </>
              ) : (
                <Button className="bg-brand-blue text-white" onClick={goToBilling}>
                  Go to billing
                </Button>
              )}
            </div>

            {loggedIn && role && role !== "LISTER" ? (
              <p className="text-xs text-gray-500">
                Signed in as <b>{role}</b>. If this account cannot list properties,
                use a Lister account or update the user role from admin.
              </p>
            ) : null}
          </div>

          <div className="rounded-3xl bg-brand-blue p-6 text-white">
            <div className="text-sm opacity-80">Simple flow</div>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
                <span>Create or log into your Lister account</span>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
                <span>Buy package from the billing page</span>
              </div>
              <div className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
                <span>List, publish, and track your property</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-bold">Available packages</h2>
          <p className="text-sm text-gray-600">
            Package purchase is completed inside your Lister billing page.
          </p>
        </div>

        {loadingPlans ? (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl border bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((p) => (
              <Card
                key={p.id}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="text-xl font-bold">{p.name}</div>

                  <div className="text-3xl font-extrabold text-brand-blue">
                    KES {Number(p.price || 0).toLocaleString()}
                  </div>

                  <ul className="space-y-1 text-sm text-gray-700">
                    <li>{p.durationInDays} days</li>
                    <li>{formatListings(p.totalListings)}</li>
                    <li>{p.featuredListings} featured listing slot(s)</li>
                  </ul>

                  <Button className="mt-3 w-full bg-brand-blue text-white" onClick={goToBilling}>
                    {loggedIn ? "Go to billing" : "Login to buy"}
                  </Button>
                </div>
              </Card>
            ))}

            {!plans.length ? (
              <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
                No active packages are currently available.
              </div>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}