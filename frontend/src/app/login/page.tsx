"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import api, { apiGet } from "@/lib/api";
import { Eye, EyeOff } from "lucide-react";

type Role = "SUPER_ADMIN" | "ADMIN" | "LISTER" | "RENTER" | "AGENT" | "EDITOR";

function dashboardFor(role: Role) {
  switch (role) {
    case "SUPER_ADMIN":
      return "/dashboard/super";
    case "ADMIN":
      return "/dashboard/admin";
    case "LISTER":
      return "/dashboard/lister";
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

function safeNext(next: string | null) {
  if (!next) return null;
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return null;
}

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

  const next = safeNext(sp.get("next"));

  const registered = sp.get("registered");
  const registeredMsg = useMemo(() => {
    if (registered === "1" || registered === "true" || registered === "yes") {
      return "Account created successfully. Please check your email to confirm it before logging in.";
    }
    return null;
  }, [registered]);

  const verified = sp.get("verified");
  const verifiedMsg = useMemo(() => {
    if (verified === "1" || verified === "true" || verified === "yes") {
      return "Email confirmed successfully. You can now sign in.";
    }
    return null;
  }, [verified]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [errCode, setErrCode] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setErrCode(null);
    setInfo(null);

    try {
      const res = await api.post<{
        token: string;
        user: { id: string; name?: string; email?: string; role: Role };
      }>("/api/auth/login", { email, password });

      const token = res.data?.token;
      const u = res.data?.user;

      if (!res.ok || !token) {
        const msg = (res.data as any)?.message || res.error || "Invalid credentials";
        const code = (res.data as any)?.code || null;
        setErrCode(code);

        if (code === "EMAIL_NOT_VERIFIED") {
          setErr("Please confirm your email first. Check your inbox (and spam), or resend the verification email below.");
        } else if (code === "ACCOUNT_BANNED") {
          setErr("Your account is currently banned from accessing the site. Please use the Contact Us page if you believe this was a mistake.");
        } else {
          setErr(msg);
        }
        return;
      }

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
    } catch {
      setErr("Login failed");
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    setResending(true);
    setErr(null);
    setInfo(null);
    try {
      if (!email) {
        setErr("Enter your email above, then click resend.");
        return;
      }
      const r = await api.post("/api/auth/resend-verification", { email });
      if (!r.ok) {
        setErr((r.data as any)?.message || r.error || "Failed to resend verification email");
        return;
      }
      setInfo((r.data as any)?.message || "Verification email resent. Please check your inbox (and spam).");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Welcome back</CardTitle>
        </CardHeader>

        <CardContent>
          {registeredMsg && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {registeredMsg}
            </div>
          )}

          {verifiedMsg && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {verifiedMsg}
            </div>
          )}

          {info && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {info}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div>
              <Label>Password</Label>

              {/* ✅ Password with eye toggle */}
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-brand-blue transition-colors p-1"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="mt-2 text-right text-sm">
                <a className="text-brand-blue hover:text-brand-red underline" href="/forgot-password">
                  Forgot password?
                </a>
              </div>
            </div>

            {err && <p className="text-sm text-red-600">{err}</p>}

            {errCode === "ACCOUNT_BANNED" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Need to appeal? Use the <a className="underline font-medium" href="/contact">Contact Us</a> page and share your account email.
              </div>
            )}

            {errCode === "EMAIL_NOT_VERIFIED" && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={resendVerification}
                  disabled={resending}
                  className="w-full rounded-lg px-3 py-2 border border-brand-blue text-brand-blue hover:border-brand-red hover:text-brand-red disabled:opacity-60"
                >
                  {resending ? "Resending…" : "Resend verification email"}
                </button>
                <p className="text-xs text-gray-600">
                  Tip: If it still doesn’t arrive, check Spam/Promotions. (Email providers love playing hide-and-seek.)
                </p>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center text-sm text-muted-foreground">
          Don’t have an account?{" "}
          <a className="ml-1 underline" href="/signup">
            Sign up
          </a>
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