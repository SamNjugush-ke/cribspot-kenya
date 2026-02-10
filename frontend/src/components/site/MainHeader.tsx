//frontend/src/components/site/MainHeader.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/api";

type Me = { user?: { id: string; name: string; role: string } };

export default function MainHeader() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("rk_token") : null;
    if (!token) return setMe(null);

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        setMe(json);
      } catch {
        setMe(null);
      }
    })();
  }, []);

  const isAuthed = !!me?.user?.id;
  const role = me?.user?.role;

  const startHref = isAuthed
    ? role === "LISTER"
      ? "/dashboard/lister"
      : "/dashboard"
    : "/login?next=/lister/list";

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur">
      <div className="container h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="CribSpot Kenya" width={142} height={36} />
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/browse">Browse</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/blog">Blog</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href={startHref}>
            <Button className="bg-[#0b1320] text-white hover:bg-black">Start Listing</Button>
          </Link>
          {!isAuthed ? (
            <>
              <Link href="/login"><Button variant="ghost">Login</Button></Link>
              <Link href="/signup"><Button>Sign up</Button></Link>
            </>
          ) : (
            <Link href="/dashboard">
              <Button variant="outline">{me?.user?.name || "Dashboard"}</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
