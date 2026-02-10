// frontend/src/app/login/page.tsx
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import api, { apiGet } from "@/lib/api";

type Role = "SUPER_ADMIN" | "ADMIN" | "LISTER" | "RENTER" | "AGENT" | "EDITOR";

function dashboardFor(role: Role) {
  switch (role) {
    case "SUPER_ADMIN":
      return "/dashboard/super";
    case "ADMIN":
      return "/dashboard/admin";
    case "LISTER":
      return "/dashboard/lister/billing";
    case "RENTER":
      return "/dashboard/renter";
    case "AGENT":
      return "/dashboard/agent";
    case "EDITOR":
      return "/dashboard/editor";
    default:
      return "/dashboard";
  }
}

/**
 * Next.js App Router: useSearchParams() must be under a Suspense boundary.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    try {
      const res = await api.post<{ token: string; user: { id: string; name?: string; email?: string; role: Role } }>(
        "/api/auth/login",
        { email, password }
      );

      const token = res.data?.token;
      const u = res.data?.user;

      if (!res.ok || !token) {
        setErr((res.data as any)?.message || "Invalid credentials");
        return;
      }

      // client-only storage
      localStorage.setItem("rk_token", token);

      if (u?.id) {
        localStorage.setItem("rk_user", JSON.stringify(u));
      } else {
        const me = await apiGet<{ user: any }>("/api/auth/me");
        if (me.ok && me.data?.user) localStorage.setItem("rk_user", JSON.stringify(me.data.user));
      }

      localStorage.setItem("rk_last_activity", String(Date.now()));

      const target = next || dashboardFor((u?.role || "RENTER") as Role);
      router.replace(target);
    } catch (e: any) {
      setErr("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Welcome back</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            {err && <p className="text-sm text-red-600">{err}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center text-sm text-muted-foreground">
          Don’t have an account? <a className="ml-1 underline" href="/signup">Sign up</a>
        </CardFooter>
      </Card>
    </div>
  );
}

function LoginSkeleton() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="h-6 w-40 bg-gray-100 rounded animate-pulse mx-auto" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 bg-gray-100 rounded animate-pulse" />
          <div className="h-10 bg-gray-100 rounded animate-pulse" />
          <div className="h-10 bg-gray-100 rounded animate-pulse" />
        </CardContent>
        <CardFooter>
          <div className="h-4 w-56 bg-gray-100 rounded animate-pulse mx-auto" />
        </CardFooter>
      </Card>
    </div>
  );
}