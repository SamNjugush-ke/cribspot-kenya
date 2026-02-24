"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api, { apiGet } from "@/lib/api";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Shell title="Confirming your email…" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token");

  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) {
        setStatus("error");
        setMsg("Missing token. Please open the confirmation link from your email.");
        return;
      }
      const res = await apiGet<{ message?: string }>("/api/auth/verify-email", { params: { token } });
      if (res.ok) {
        setStatus("ok");
        setMsg("Email confirmed. Redirecting to login…");
        setTimeout(() => router.replace("/login?verified=1"), 900);
      } else {
        setStatus("error");
        setMsg(res.data?.message || res.error || "Failed to confirm email.");
      }
    })();
  }, [token, router]);

  const title = useMemo(() => {
    if (status === "loading") return "Confirming your email…";
    if (status === "ok") return "Email confirmed";
    return "Confirmation failed";
  }, [status]);

  return (
    <Shell title={title}>
      {msg && (
        <div
          className={
            status === "error"
              ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              : "rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
          }
        >
          {msg}
        </div>
      )}

      {status === "error" && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-gray-700">
            If your link expired, go back to signup and hit <span className="font-semibold">Resend email</span>.
          </p>
          <a className="text-brand-blue hover:text-brand-red underline text-sm" href="/signup">
            Back to signup
          </a>
        </div>
      )}
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border rounded-xl p-4">
        <h1 className="text-xl font-bold mb-3">{title}</h1>
        {children || <p className="text-sm text-gray-700">Please wait…</p>}
      </div>
    </div>
  );
}
