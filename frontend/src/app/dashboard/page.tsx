// frontend/src/app/dashboard/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Role } from "@/types/user";


function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function normalizeRole(role: any): Role | null {
  const r = String(role || "").toUpperCase();
  const allowed: Role[] = ["SUPER_ADMIN", "ADMIN", "LISTER", "RENTER", "AGENT", "EDITOR"];
  return (allowed as string[]).includes(r) ? (r as Role) : null;
}

function landingForRole(role: Role) {
  switch (role) {
    case "SUPER_ADMIN":
      return "/dashboard/super";
    case "ADMIN":
      return "/dashboard/admin";
    case "EDITOR":
      return "/dashboard/editor";
    case "AGENT":
      return "/dashboard/agent";
    case "LISTER":
      return "/dashboard/lister";
    case "RENTER":
      return "/dashboard/renter";
    default:
      return "/";
  }
}

export default function DashboardIndex() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const next = params.get("next");
    if (next && next.startsWith("/dashboard")) {
      router.replace(next);
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("rk_token") : null;
    if (!token) {
      router.replace("/login?next=/dashboard");
      return;
    }

    const payload = decodeJwtPayload(token);
    const role = normalizeRole(payload?.role);

    if (!role) {
      router.replace("/login?next=/dashboard");
      return;
    }

    router.replace(landingForRole(role));
  }, [router, params]);

  return <div className="p-6 text-sm text-gray-600">Loading…</div>;
}