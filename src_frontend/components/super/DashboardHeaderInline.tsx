"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";

import {
  ChevronDown,
  LogOut,
  Shield,
  Undo2,
  User,
  Mail,
  Search,
  MessageSquare,
  FileDown,
  ScrollText,
  LayoutGrid,
} from "lucide-react";

type MeResp = {
  user?: { id: string; name?: string | null; email: string; role?: string };
};

function safeJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rk_token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function DashboardHeaderInline({
  title = "Dashboard",
  subtitle,
  className,
  showSearch = true,
}: {
  title?: string;
  subtitle?: string;
  className?: string;
  showSearch?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [me, setMe] = useState<MeResp["user"] | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [q, setQ] = useState("");

  const [impersonatorToken, setImpersonatorToken] = useState<string | null>(null);

  const impersonatedUser = useMemo(
    () =>
      safeJson<{ id: string; email?: string; name?: string; role?: string }>(
        typeof window !== "undefined" ? localStorage.getItem("rk_impersonated_user") : null
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname]
  );

  const impersonatorUser = useMemo(
    () =>
      safeJson<{ id: string; email?: string; name?: string; role?: string }>(
        typeof window !== "undefined" ? localStorage.getItem("rk_impersonator_user") : null
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname]
  );

  const isImpersonating = !!impersonatorToken;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setImpersonatorToken(localStorage.getItem("rk_token_impersonator"));
  }, [pathname]);

  useEffect(() => {
    (async () => {
      try {
        setLoadingMe(true);
        const res = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() });
        const data = (await res.json().catch(() => null)) as MeResp | null;
        setMe(data?.user ?? null);
      } catch {
        setMe(null);
      } finally {
        setLoadingMe(false);
      }
    })();
  }, [pathname]);

  const quickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const needle = q.trim();
    if (!needle) return;
    router.push(`/dashboard/super/users?q=${encodeURIComponent(needle)}`);
    setQ("");
  };

  const logout = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("rk_token");
    localStorage.removeItem("rk_token_impersonator");
    localStorage.removeItem("rk_impersonated_user");
    localStorage.removeItem("rk_impersonator_user");
    router.push("/login");
    router.refresh();
  };

  const revertImpersonation = () => {
    if (typeof window === "undefined") return;
    const original = localStorage.getItem("rk_token_impersonator");
    if (!original) return;

    localStorage.setItem("rk_token", original);
    localStorage.removeItem("rk_token_impersonator");
    localStorage.removeItem("rk_impersonated_user");
    localStorage.removeItem("rk_impersonator_user");
    window.location.href = "/dashboard/super/users";
  };

  const displayName =
    me?.name?.trim() || (me?.email ? me.email.split("@")[0] : "") || "Account";
  const role = me?.role || "—";

  return (
    <div className={cn("space-y-3", className)}>
      {isImpersonating && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-red-700 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="font-semibold">Impersonation active</span>
            <span className="text-red-700/80">
              Acting as{" "}
              <span className="font-semibold">
                {impersonatedUser?.email || me?.email || "this user"}
              </span>
              {impersonatedUser?.role ? ` (${impersonatedUser.role})` : ""}
            </span>
            {impersonatorUser?.email ? (
              <span className="text-red-700/70">
                · Original: <span className="font-semibold">{impersonatorUser.email}</span>
              </span>
            ) : null}
          </div>

          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={revertImpersonation}
          >
            <Undo2 className="h-4 w-4 mr-2" />
            Revert
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-2xl bg-brand-blue/10 flex items-center justify-center ring-1 ring-brand-blue/20">
              <LayoutGrid className="h-5 w-5 text-brand-blue" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-bold truncate">{title}</div>
              <div className="text-xs text-gray-600 truncate">
                {subtitle ?? "Shortcuts, search, and account controls."}
              </div>
            </div>
          </div>
        </div>

        {showSearch && (
          <form onSubmit={quickSearch} className="flex-1 max-w-xl">
            <Card className="shadow-soft rounded-2xl border">
              <div className="flex items-center gap-2 px-3 py-2">
                <Search className="h-4 w-4 text-gray-500" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Quick search (users/listings)…"
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Button type="submit" size="sm" className="bg-brand-blue text-white hover:bg-brand-sky">
                  Go
                </Button>
              </div>
            </Card>
          </form>
        )}

        <div className="flex items-center gap-2 justify-between lg:justify-end">
          <div className="flex items-center gap-2">
            <Link href="/dashboard/messages">
              <Button variant="outline" className="rounded-2xl">
                <MessageSquare className="h-4 w-4 mr-2" />
                Messages
              </Button>
            </Link>
            <Link href="/dashboard/super/reports">
              <Button variant="outline" className="rounded-2xl">
                <FileDown className="h-4 w-4 mr-2" />
                Reports
              </Button>
            </Link>
            <Link href="/dashboard/super/audit">
              <Button variant="outline" className="rounded-2xl">
                <ScrollText className="h-4 w-4 mr-2" />
                Audit
              </Button>
            </Link>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-2xl bg-brand-blue text-white hover:bg-brand-sky">
                <User className="h-4 w-4 mr-2" />
                <span className="max-w-[140px] truncate">
                  {loadingMe ? "Loading…" : displayName}
                </span>
                <ChevronDown className="h-4 w-4 ml-2 opacity-90" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-[320px]">
              <DropdownMenuLabel className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{displayName}</div>
                    <div className="text-xs text-gray-600 flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{me?.email ?? "—"}</span>
                    </div>
                  </div>
                  <Badge className="rounded-full bg-brand-gray text-brand-black">
                    {role}
                  </Badge>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile" className="cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  My profile
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {isImpersonating && (
                <>
                  <DropdownMenuItem
                    className="text-red-700 focus:text-red-700"
                    onClick={revertImpersonation}
                  >
                    <Undo2 className="h-4 w-4 mr-2" />
                    Revert impersonation
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <Badge className="rounded-full bg-brand-gray text-brand-black">
          Session: {me?.email ? "Authenticated" : "Unknown"}
        </Badge>
        <Badge className="rounded-full bg-brand-gray text-brand-black">
          Role: {role}
        </Badge>
        {isImpersonating ? (
          <Badge className="rounded-full bg-red-100 text-red-700 border border-red-200">
            Impersonating
          </Badge>
        ) : (
          <Badge className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Normal mode
          </Badge>
        )}
      </div>
    </div>
  );
}
