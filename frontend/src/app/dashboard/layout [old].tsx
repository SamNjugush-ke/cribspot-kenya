// src/app/dashboard/layout.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  LogOut,
  User,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { API_BASE } from "@/lib/api";
import { SocketProvider, useSocket } from "@/contexts/SocketProvider";

type Me = {
  user?: {
    id: string;
    name: string;
    email: string;
    role:
      | "SUPER_ADMIN"
      | "ADMIN"
      | "LISTER"
      | "RENTER"
      | "AGENT"
      | "EDITOR";
  };
};

function Topbar({ me, onLogout }: { me: Me | null; onLogout: () => void }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = (me?.user?.name || "U").slice(0, 2);

  // 🔴 consume unread count here
  const { unread } = useSocket();

  return (
    <header className="sticky top-0 z-30 h-16 border-b bg-white">
      <div className="h-full container flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" width={142} height={28} alt="CribSpot Kenya" />
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="relative"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
                {unread}
              </span>
            )}
          </Button>

          {/* Avatar + name + chevron */}
          <DropdownMenu onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 font-medium">
                  {initials}
                </span>
                {me?.user?.name || "Account"}
                {menuOpen ? (
                  <ChevronUp className="h-4 w-4 opacity-70" />
                ) : (
                  <ChevronDown className="h-4 w-4 opacity-70" />
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                <LayoutGrid className="mr-2 h-4 w-4" />
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/dashboard/profile")}
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600" onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("rk_token");
    if (!token) {
      router.replace(
        `/login?next=${encodeURIComponent(pathname || "/dashboard")}`
      );
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("auth fail");
        const json = await res.json();
        setMe(json);
      } catch {
        router.replace(
          `/login?next=${encodeURIComponent(pathname || "/dashboard")}`
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = () => {
    localStorage.removeItem("rk_token");
    router.replace("/login");
  };

  const role = me?.user?.role || "LISTER";

  return (
    <SocketProvider>
      <div className="min-h-screen bg-gray-50">
        <Topbar me={me} onLogout={logout} />

        {/* FIXED SIDEBAR LAYOUT */}
        <div className="container grid grid-cols-12 gap-6 py-6">
          <aside className="col-span-12 md:col-span-3 lg:col-span-3">
            <Sidebar role={role as any} />
          </aside>
          <main className="col-span-12 md:col-span-9 lg:col-span-9">
            {children}
          </main>
        </div>
      </div>
    </SocketProvider>
  );
}