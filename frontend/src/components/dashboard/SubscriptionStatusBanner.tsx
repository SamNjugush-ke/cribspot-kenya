"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type UsageLike = {
  remainingListings?: number;
  remainingFeatured?: number;
  totalListings?: number;
  totalFeatured?: number;
  activeCount?: number;
  expiresAtSoonest?: string | null;
} | null;

function daysLeft(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function SubscriptionStatusBanner({
  usage,
  loading,
}: {
  usage: UsageLike;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600 shadow-sm">
        Checking subscription status…
      </div>
    );
  }

  const activeCount = usage?.activeCount ?? 0;
  const remainingListings = usage?.remainingListings ?? 0;
  const expiresAt = usage?.expiresAtSoonest ?? null;
  const left = daysLeft(expiresAt);

  if (activeCount <= 0) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            <div className="mt-0.5 rounded-full bg-red-100 p-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-red-900">
                No active subscription — listings cannot go live.
              </div>
              <p className="mt-1 text-sm text-red-800">
                Buy a package to publish properties and start receiving tenant leads.
              </p>
            </div>
          </div>

          <Link href="/dashboard/lister/billing">
            <Button className="bg-red-700 text-white hover:bg-red-800">
              Subscribe now
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (remainingListings <= 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-amber-900">
                Subscription active, but listing quota is finished.
              </div>
              <p className="mt-1 text-sm text-amber-800">
                Extend or buy another package to publish more properties.
              </p>
            </div>
          </div>

          <Link href="/dashboard/lister/billing">
            <Button className="bg-amber-700 text-white hover:bg-amber-800">
              Top up package
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const expiringSoon = typeof left === "number" && left <= 7;

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        expiringSoon
          ? "border-amber-200 bg-amber-50"
          : "border-green-200 bg-green-50"
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <div
            className={`mt-0.5 rounded-full p-2 ${
              expiringSoon
                ? "bg-amber-100 text-amber-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {expiringSoon ? (
              <Clock className="h-5 w-5" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
          </div>

          <div>
            <div
              className={`font-semibold ${
                expiringSoon ? "text-amber-900" : "text-green-900"
              }`}
            >
              {expiringSoon
                ? `Subscription active, but expires soon.`
                : `Subscription active — you can continue listing.`}
            </div>

            <p
              className={`mt-1 text-sm ${
                expiringSoon ? "text-amber-800" : "text-green-800"
              }`}
            >
              {remainingListings} listing slot(s) left
              {expiresAt ? ` · Expires ${fmtDate(expiresAt)}` : ""}
              {typeof left === "number" ? ` · ${left} day(s) left` : ""}.
            </p>
          </div>
        </div>

        <Link href="/dashboard/lister/billing">
          <Button variant={expiringSoon ? "default" : "outline"}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Manage package
          </Button>
        </Link>
      </div>
    </div>
  );
}