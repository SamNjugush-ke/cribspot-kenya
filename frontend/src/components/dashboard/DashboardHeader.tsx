// frontend/src/components/dashboard/DashboardHeader.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";
import type { Role } from "@/types/user";

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

import {
  ChevronDown,
  Home,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Search,
  Shield,
  Undo2,
  User,
} from "lucide-react";

type MeResp = { user?: { id: string; name?: string | null; email: string; role?: string } };

const AUTH_EVENT = "rk:auth";

function safeJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function token() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rk_token");
}

function authHeaders(): HeadersInit {
  const t = token();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function initials(nameOrEmail?: string | null) {
  const s = (nameOrEmail || "U").trim();
  const parts = s.includes("@") ? s.split("@")[0].split(".") : s.split(" ");
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function roleHome(role?: string | null) {
  const r = String(role || "").toUpperCase();
  if (r === "SUPER_ADMIN") return "/dashboard/super";
  if (r === "ADMIN") return "/dashboard/admin";
  if (r === "EDITOR") return "/dashboard/editor";
  if (r === "AGENT") return "/dashboard/agent";
  if (r === "LISTER") return "/dashboard/lister";
  if (r === "RENTER") return "/dashboard/renter";
  return "/dashboard";
}

function titleFromPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "dashboard";
  const nice = last.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  if (
    last === "super" ||
    last === "admin" ||
    last === "lister" ||
    last === "renter" ||
    last === "agent" ||
    last === "editor"
  ) {
    return "Overview";
  }
  return nice;
}

function notifyAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_EVENT)); // same-tab listeners (Header/AuthBootstrap)
}

function clearAllAuth() {
  if (typeof window === "undefined") return;

  // core auth
  localStorage.removeItem("rk_token");
  localStorage.removeItem("rk_user");

  // impersonation (both conventions)
  localStorage.removeItem("rk_token_impersonator");
  localStorage.removeItem("rk_impersonated_user");
  localStorage.removeItem("rk_impersonator_user");

  localStorage.removeItem("rk_impersonator_token");
  localStorage.removeItem("rk_impersonating");

  // idle/bootstrap keys
  localStorage.removeItem("rk_last_activity");
  localStorage.removeItem("rk_last_me_check");
}

export default function DashboardHeader({
  role,
  title,
  subtitle,
  onQuickSearch,
}: {
  role: Role;
  title?: string;
  subtitle?: string;
  onQuickSearch?: (q: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [me, setMe] = useState<MeResp["user"] | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [q, setQ] = useState("");

  // impersonation storage convention:
  // rk_token_impersonator -> original token
  // rk_impersonated_user, rk_impersonator_user -> metadata
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

  // Keep banner state fresh on route changes AND auth changes (same tab)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const sync = () => setImpersonatorToken(localStorage.getItem("rk_token_impersonator"));

    sync();

    const onAuth = () => sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "rk_token" || e.key === "rk_token_impersonator") sync();
    };

    window.addEventListener(AUTH_EVENT, onAuth as any);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(AUTH_EVENT, onAuth as any);
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname]);

  // Load /me when token changes or path changes.
  // NOTE: previously depended only on pathname; during logout it could still show old me until refresh.
  useEffect(() => {
    (async () => {
      try {
        setLoadingMe(true);
        const res = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() });
        const json = (await res.json().catch(() => null)) as MeResp | null;
        setMe(json?.user ?? null);
      } catch {
        setMe(null);
      } finally {
        setLoadingMe(false);
      }
    })();
    // include token in deps so clearing token refreshes instantly
  }, [pathname, typeof window !== "undefined" ? localStorage.getItem("rk_token") : ""]);

  const computedTitle = title || titleFromPath(pathname || "/dashboard");
  const computedSubtitle =
    subtitle ||
    (role === "SUPER_ADMIN" || role === "ADMIN"
      ? "Admin tools, moderation, exports and controls."
      : "Your workspace — tasks, messages and activity.");

  const canImpersonateUI = role === "SUPER_ADMIN" || role === "ADMIN";

  const doLogout = () => {
    if (typeof window === "undefined") return;

    // Clear everything
    clearAllAuth();

    // Instant UI sync for Header + any listeners on same tab
    notifyAuthChanged();

    // Navigate to login. No need to router.refresh(); it can keep stale client state briefly.
    router.replace("/login");
  };

  const revertImpersonation = () => {
    if (typeof window === "undefined") return;
    const original = localStorage.getItem("rk_token_impersonator");
    if (!original) return;

    // restore token
    localStorage.setItem("rk_token", original);

    // clear impersonation keys
    localStorage.removeItem("rk_token_impersonator");
    localStorage.removeItem("rk_impersonated_user");
    localStorage.removeItem("rk_impersonator_user");

    // also clear alternate keys
    localStorage.removeItem("rk_impersonator_token");
    localStorage.removeItem("rk_impersonating");

    // force re-hydration of /me everywhere
    localStorage.removeItem("rk_user");

    // notify same-tab listeners (header/banner should flip instantly)
    notifyAuthChanged();

    // hard reload to reset role-based nav and caches cleanly
    window.location.href = roleHome("SUPER_ADMIN");
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const needle = q.trim();
    if (!needle) return;

    if (onQuickSearch) {
      onQuickSearch(needle);
    } else {
      if (role === "SUPER_ADMIN" || role === "ADMIN") {
        router.push(
          `/dashboard/${role === "SUPER_ADMIN" ? "super" : "admin"}/users?q=${encodeURIComponent(needle)}`
        );
      } else {
        router.push(`/dashboard/messages`);
      }
    }
    setQ("");
  };

  return (
    <div className="space-y-2">
      {isImpersonating && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 flex items-center justify-between gap-3">
          <div className="text-sm text-red-700 flex items-center gap-2 min-w-0">
            <Shield className="h-4 w-4 shrink-0" />
            <span className="font-semibold shrink-0">Impersonating</span>
            <span className="truncate">
              {impersonatedUser?.email || me?.email || "user"}
              {impersonatedUser?.role ? ` (${impersonatedUser.role})` : ""}
              {impersonatorUser?.email ? ` · Original: ${impersonatorUser.email}` : ""}
            </span>
          </div>

          {canImpersonateUI && (
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={revertImpersonation}>
              <Undo2 className="h-4 w-4 mr-2" />
              Revert
            </Button>
          )}
        </div>
      )}

      <div className="h-14 flex items-center justify-between gap-3">
        {/* Left: title */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 rounded-xl2 bg-brand-blue/10 flex items-center justify-center text-brand-blue font-bold ring-1 ring-brand-blue/20">
            {initials(me?.name || me?.email || "U")}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{computedTitle}</div>
            <div className="text-xs text-gray-500 truncate">{computedSubtitle}</div>
          </div>
        </div>

        {/* Middle: quick search */}
        <form onSubmit={submitSearch} className="hidden lg:flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative w-full">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={role === "SUPER_ADMIN" || role === "ADMIN" ? "Quick search users…" : "Search…"}
              className="pl-9 rounded-xl2"
            />
          </div>
          <Button type="submit" className="bg-brand-blue text-white hover:bg-brand-sky rounded-xl2">
            Go
          </Button>
        </form>

        {/* Right: actions + menu */}
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/">
            <Button variant="outline" className="rounded-xl2">
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          </Link>

          <Link href="/dashboard/messages">
            <Button variant="outline" className="rounded-xl2">
              <MessageSquare className="h-4 w-4 mr-2" />
              Messages
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-xl2 bg-brand-blue text-white hover:bg-brand-sky">
                <User className="h-4 w-4 mr-2" />
                <span className="max-w-[120px] truncate">
                  {loadingMe ? "Loading…" : me ? (me.name || me.email || "Account") : "Account"}
                </span>
                <ChevronDown className="h-4 w-4 ml-2 opacity-90" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-[320px]">
              <DropdownMenuLabel className="space-y-1">
                <div className="font-semibold truncate">{me?.name || "Account"}</div>
                <div className="text-xs text-gray-600 flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{me?.email || "—"}</span>
                </div>
                <div className="pt-1 flex flex-wrap gap-2">
                  <Badge className="rounded-full bg-brand-gray text-brand-black">{role}</Badge>
                  {isImpersonating ? (
                    <Badge className="rounded-full bg-red-100 text-red-700 border border-red-200">Impersonating</Badge>
                  ) : (
                    <Badge className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Normal</Badge>
                  )}
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link href={roleHome(role)} className="cursor-pointer">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard home
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile" className="cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>

              {canImpersonateUI && isImpersonating && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-700 focus:text-red-700" onClick={revertImpersonation}>
                    <Undo2 className="h-4 w-4 mr-2" />
                    Revert impersonation
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={doLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Small-screen search */}
      <form onSubmit={submitSearch} className="lg:hidden flex items-center gap-2">
        <div className="relative w-full">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={role === "SUPER_ADMIN" || role === "ADMIN" ? "Quick search users…" : "Search…"}
            className="pl-9 rounded-xl2"
          />
        </div>
        <Button type="submit" className="bg-brand-blue text-white hover:bg-brand-sky rounded-xl2">
          Go
        </Button>
      </form>
    </div>
  );
}