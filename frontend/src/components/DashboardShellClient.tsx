"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import type { Role } from "@/types/user";
import { SocketProvider } from "@/contexts/SocketProvider";

import DashboardHeader from "@/components/dashboard/DashboardHeader";

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    return safeJsonParse<Record<string, any>>(json);
  } catch {
    return null;
  }
}

function normalizeRole(role: any): Role | null {
  const r = String(role || "").toUpperCase();
  const allowed: Role[] = ["SUPER_ADMIN", "ADMIN", "LISTER", "RENTER", "AGENT", "EDITOR"];
  return (allowed as string[]).includes(r) ? (r as Role) : null;
}

export default function DashboardShellClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [role, setRole] = useState<Role | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("rk_token") : null;

    if (!token) {
      setRole(null);
      setReady(true);
      const next = encodeURIComponent(pathname || "/dashboard");
      router.replace(`/login?next=${next}`);
      return;
    }

    const payload = decodeJwtPayload(token);
    const r = normalizeRole(payload?.role);

    if (!r) {
      setRole(null);
      setReady(true);
      const next = encodeURIComponent(pathname || "/dashboard");
      router.replace(`/login?next=${next}`);
      return;
    }

    setRole(r);
    setReady(true);
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-brand-gray">
        <div className="h-14 border-b bg-white" />
        <div className="mx-auto max-w-7xl p-6">
          <div className="h-6 w-48 rounded bg-white/70" />
          <div className="mt-6 h-64 rounded-xl2 bg-white/70" />
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-brand-gray flex items-center justify-center text-sm text-gray-600">
        Redirecting…
      </div>
    );
  }

  return (
    <SocketProvider>
      <div className="min-h-screen bg-brand-gray flex">
        <Sidebar role={role} />

        <div className="flex-1 min-w-0">
          {/* Top header area */}
          <div className="sticky top-0 z-30 border-b bg-white">
            <div className="px-4 py-3">
              <DashboardHeader role={role} />
            </div>
          </div>

          {/* Page container */}
          <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SocketProvider>
  );
}