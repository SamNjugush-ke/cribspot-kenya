"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Shell title="Resetting password…" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const disabled = useMemo(() => loading || !token, [loading, token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!token) {
      setError("Missing token. Please open the reset link from your email.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/api/auth/reset-password", { token, password });
      if (!res.ok) {
        setError((res.data as any)?.message || res.error || "Failed");
        return;
      }
      setInfo("Password updated successfully. Redirecting to login…");
      setTimeout(() => router.replace("/login"), 900);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell title="Reset password">
      {!token && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Missing token. Please open the reset link from your email.
        </div>
      )}

      {info && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {info}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <input
          className="w-full border rounded-lg px-3 py-2"
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          className="w-full border rounded-lg px-3 py-2"
          type="password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        <button
          className="w-full rounded-lg px-3 py-2 bg-brand-blue text-white hover:bg-brand-red disabled:opacity-60"
          disabled={disabled}
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>

      <div className="mt-4 text-sm">
        <a className="text-brand-blue hover:text-brand-red underline" href="/login">
          Back to login
        </a>
      </div>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border rounded-xl p-4">
        <h1 className="text-xl font-bold mb-3">{title}</h1>
        {children}
      </div>
    </div>
  );
}
