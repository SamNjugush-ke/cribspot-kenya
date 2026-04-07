"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import type { Role } from "@/types/user";
import { SocketProvider } from "@/contexts/SocketProvider";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { PermissionsProvider } from "@/components/super/PermissionsProvider";

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-brand-gray">
        <div className="h-14 border-b bg-white" />
        <div className="mx-auto max-w-7xl p-4 md:p-6">
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
    <PermissionsProvider>
      <SocketProvider>
        <div className="min-h-screen bg-brand-gray md:flex">
          <Sidebar
            role={role}
            mobileOpen={mobileNavOpen}
            onMobileClose={() => setMobileNavOpen(false)}
          />

          <div className="min-w-0 flex-1">
            <div className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
              <div className="px-3 py-3 sm:px-4">
                <DashboardHeader
                  role={role}
                  mobileNavOpen={mobileNavOpen}
                  onOpenMobileNav={() => setMobileNavOpen(true)}
                  onCloseMobileNav={() => setMobileNavOpen(false)}
                />
              </div>
            </div>

            <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 md:px-6 md:py-6">
              {children}
            </main>
          </div>
        </div>
      </SocketProvider>
    </PermissionsProvider>
  );
}