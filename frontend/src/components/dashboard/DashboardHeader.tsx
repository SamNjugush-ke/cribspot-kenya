"use client";

import Link from "next/link";
import { useMemo, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { Role } from "@/types/user";
import { API_BASE } from "@/lib/api";

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
  Menu,
  MessageSquare,
  Search,
  Shield,
  Undo2,
  User,
  X,
} from "lucide-react";

import NotificationsBell from "@/components/NotificationsBell";
import { MessagesAPI } from "@/components/messages/api";

type StoredUser = { id: string; name?: string | null; email: string; role?: string };
type MeResp = { user?: StoredUser };

const AUTH_EVENT = "rk:auth";
const USER_KEY = "rk_user";

function safeJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function authHeaders(t?: string | null): HeadersInit {
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
  if (["super", "admin", "lister", "renter", "agent", "editor"].includes(last)) return "Overview";
  return nice;
}

function notifyAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_EVENT));
}

function clearAllAuth() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("rk_token");
  localStorage.removeItem(USER_KEY);

  localStorage.removeItem("rk_token_impersonator");
  localStorage.removeItem("rk_impersonated_user");
  localStorage.removeItem("rk_impersonator_user");
  localStorage.removeItem("rk_impersonator_token");
  localStorage.removeItem("rk_impersonating");

  localStorage.removeItem("rk_last_activity");
  localStorage.removeItem("rk_last_me_check");
}

export default function DashboardHeader({
  role,
  title,
  subtitle,
  onQuickSearch,
  mobileNavOpen = false,
  onOpenMobileNav,
  onCloseMobileNav,
}: {
  role: Role;
  title?: string;
  subtitle?: string;
  onQuickSearch?: (q: string) => void;
  mobileNavOpen?: boolean;
  onOpenMobileNav?: () => void;
  onCloseMobileNav?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [me, setMe] = useState<StoredUser | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [q, setQ] = useState("");
  const [tokenState, setTokenState] = useState<string | null>(null);
  const [impersonatorToken, setImpersonatorToken] = useState<string | null>(null);
  const [directUnread, setDirectUnread] = useState(0);

  const impersonatedUser = useMemo(
    () =>
      safeJson<{ id: string; email?: string; name?: string; role?: string }>(
        typeof window !== "undefined" ? localStorage.getItem("rk_impersonated_user") : null
      ),
    [pathname]
  );

  const impersonatorUser = useMemo(
    () =>
      safeJson<{ id: string; email?: string; name?: string; role?: string }>(
        typeof window !== "undefined" ? localStorage.getItem("rk_impersonator_user") : null
      ),
    [pathname]
  );

  const isImpersonating = !!impersonatorToken;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sync = () => {
      setTokenState(localStorage.getItem("rk_token"));
      setImpersonatorToken(localStorage.getItem("rk_token_impersonator"));
    };

    sync();

    const onAuth = () => sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "rk_token" || e.key === "rk_token_impersonator" || e.key === USER_KEY) {
        sync();
      }
    };

    window.addEventListener(AUTH_EVENT, onAuth as any);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(AUTH_EVENT, onAuth as any);
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname]);

  useEffect(() => {
    let alive = true;

    const hydrateFromStorage = () => {
      const stored = safeJson<StoredUser>(
        typeof window !== "undefined" ? localStorage.getItem(USER_KEY) : null
      );
      if (alive && stored?.email) setMe(stored);
    };

    (async () => {
      try {
        setLoadingMe(true);

        if (!tokenState) {
          setMe(null);
          hydrateFromStorage();
          return;
        }

        const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders(tokenState) });
        if (!res.ok) {
          hydrateFromStorage();
          return;
        }

        const json = (await res.json().catch(() => null)) as MeResp | null;
        if (!alive) return;

        const user = json?.user ?? null;

        if (user?.email) {
          if (!user.name) {
            const stored = safeJson<StoredUser>(
              typeof window !== "undefined" ? localStorage.getItem(USER_KEY) : null
            );
            setMe({ ...user, name: user.name ?? stored?.name ?? null });
          } else {
            setMe(user);
          }
        } else {
          setMe(null);
          hydrateFromStorage();
        }
      } catch {
        if (!alive) return;
        setMe(null);
        hydrateFromStorage();
      } finally {
        if (alive) setLoadingMe(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [pathname, tokenState]);

  useEffect(() => {
    let alive = true;

    async function loadUnread() {
      try {
        if (!tokenState) {
          if (alive) setDirectUnread(0);
          return;
        }
        const c = await MessagesAPI.unreadCount("DIRECT");
        if (alive) setDirectUnread(c || 0);
      } catch {
        if (alive) setDirectUnread(0);
      }
    }

    loadUnread();
    const t = setInterval(loadUnread, 25000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [tokenState, pathname]);

  const computedTitle = title || titleFromPath(pathname || "/dashboard");
  const computedSubtitle =
    subtitle ||
    (role === "SUPER_ADMIN" || role === "ADMIN"
      ? "Admin tools, moderation, exports and controls."
      : "Your workspace — tasks, messages and activity.");

  const canImpersonateUI = role === "SUPER_ADMIN" || role === "ADMIN";

  const doLogout = () => {
    if (typeof window === "undefined") return;
    clearAllAuth();
    notifyAuthChanged();
    router.replace("/login");
  };

  const revertImpersonation = () => {
    if (typeof window === "undefined") return;
    const original = localStorage.getItem("rk_token_impersonator");
    if (!original) return;

    localStorage.setItem("rk_token", original);

    localStorage.removeItem("rk_token_impersonator");
    localStorage.removeItem("rk_impersonated_user");
    localStorage.removeItem("rk_impersonator_user");
    localStorage.removeItem("rk_impersonator_token");
    localStorage.removeItem("rk_impersonating");

    localStorage.removeItem(USER_KEY);
    notifyAuthChanged();

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
    <div className="space-y-3">
      {isImpersonating && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2 text-sm text-red-700">
            <Shield className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold">Impersonating</div>
              <div className="truncate">
                {impersonatedUser?.email || me?.email || "user"}
                {impersonatedUser?.role ? ` (${impersonatedUser.role})` : ""}
                {impersonatorUser?.email ? ` · Original: ${impersonatorUser.email}` : ""}
              </div>
            </div>
          </div>

          {canImpersonateUI && (
            <Button
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700 self-start sm:self-auto"
              onClick={revertImpersonation}
            >
              <Undo2 className="h-4 w-4" />
              Revert
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={mobileNavOpen ? onCloseMobileNav : onOpenMobileNav}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-white text-gray-700 shadow-sm md:hidden"
              aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl2 bg-brand-blue/10 font-bold text-brand-blue ring-1 ring-brand-blue/20">
              {initials(me?.name || me?.email || "U")}
            </div>

            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-gray-900 sm:text-lg">
                {computedTitle}
              </div>
              <div className="line-clamp-2 text-xs text-gray-500 sm:text-sm">
                {computedSubtitle}
              </div>
            </div>
          </div>

          <div className="hidden lg:flex lg:items-center lg:gap-2 lg:pl-4">
            <Link href="/">
              <Button variant="outline" className="rounded-xl2">
                <Home className="h-4 w-4" />
                Home
              </Button>
            </Link>

            <Link href="/dashboard/messages">
              <Button variant="outline" className="rounded-xl2">
                <MessageSquare className="h-4 w-4" />
                Messages
                {directUnread > 0 ? (
                  <Badge className="ml-1 rounded-full px-2 py-0.5">{directUnread}</Badge>
                ) : null}
              </Button>
            </Link>

            <NotificationsBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="max-w-[220px] rounded-xl2 bg-brand-blue text-white hover:bg-brand-sky">
                  <User className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {loadingMe ? "Loading…" : me ? me.name || me.email || "Account" : "Account"}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-90" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-[320px] max-w-[calc(100vw-2rem)]">
                <DropdownMenuLabel className="space-y-1">
                  <div className="truncate font-semibold">{me?.name || "Account"}</div>
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{me?.email || "—"}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge className="rounded-full bg-brand-gray text-brand-black">{role}</Badge>
                    {isImpersonating ? (
                      <Badge className="rounded-full border border-red-200 bg-red-100 text-red-700">
                        Impersonating
                      </Badge>
                    ) : (
                      <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                        Normal
                      </Badge>
                    )}
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <Link href={roleHome(role)} className="cursor-pointer">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard home
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href="/dashboard/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href="/dashboard/notifications" className="cursor-pointer">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Notifications
                  </Link>
                </DropdownMenuItem>

                {canImpersonateUI && isImpersonating && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-700 focus:text-red-700"
                      onClick={revertImpersonation}
                    >
                      <Undo2 className="mr-2 h-4 w-4" />
                      Revert impersonation
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={doLogout} className="text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <form onSubmit={submitSearch} className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={role === "SUPER_ADMIN" || role === "ADMIN" ? "Quick search users…" : "Search…"}
              className="h-11 rounded-xl2 pl-9"
            />
          </div>

          <Button type="submit" className="h-11 rounded-xl2 bg-brand-blue px-4 text-white hover:bg-brand-sky sm:px-5">
            Go
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2 lg:hidden">
          <Link href="/">
            <Button variant="outline" className="rounded-xl2">
              <Home className="h-4 w-4" />
              <span className="hidden xs:inline">Home</span>
            </Button>
          </Link>

          <Link href="/dashboard/messages">
            <Button variant="outline" className="rounded-xl2">
              <MessageSquare className="h-4 w-4" />
              Messages
              {directUnread > 0 ? (
                <Badge className="ml-1 rounded-full px-2 py-0.5">{directUnread}</Badge>
              ) : null}
            </Button>
          </Link>

          <NotificationsBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="max-w-full rounded-xl2 bg-brand-blue text-white hover:bg-brand-sky">
                <User className="h-4 w-4 shrink-0" />
                <span className="max-w-[120px] truncate sm:max-w-[180px]">
                  {loadingMe ? "Loading…" : me ? me.name || me.email || "Account" : "Account"}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-90" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-[320px] max-w-[calc(100vw-1rem)]">
              <DropdownMenuLabel className="space-y-1">
                <div className="truncate font-semibold">{me?.name || "Account"}</div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{me?.email || "—"}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge className="rounded-full bg-brand-gray text-brand-black">{role}</Badge>
                  {isImpersonating ? (
                    <Badge className="rounded-full border border-red-200 bg-red-100 text-red-700">
                      Impersonating
                    </Badge>
                  ) : (
                    <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                      Normal
                    </Badge>
                  )}
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link href={roleHome(role)} className="cursor-pointer">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard home
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href="/dashboard/notifications" className="cursor-pointer">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Notifications
                </Link>
              </DropdownMenuItem>

              {canImpersonateUI && isImpersonating && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-700 focus:text-red-700"
                    onClick={revertImpersonation}
                  >
                    <Undo2 className="mr-2 h-4 w-4" />
                    Revert impersonation
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={doLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}