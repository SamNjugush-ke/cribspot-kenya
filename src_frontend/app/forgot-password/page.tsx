"use client";

import { useState } from "react";
import api from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setInfo(null);

    try {
      const res = await api.post("/api/auth/forgot-password", { email });
      if (!res.ok) {
        setError((res.data as any)?.message || res.error || "Failed");
        setErrorCode((res.data as any)?.code || null);
        return;
      }
      setInfo((res.data as any)?.message || "Password reset link sent. Please check your email (and spam).");
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const r = await api.post("/api/auth/resend-verification", { email });
      if (!r.ok) {
        setError((r.data as any)?.message || r.error || "Failed to resend email");
        return;
      }
      setInfo((r.data as any)?.message || "Verification email resent. Please check your inbox (and spam).");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border rounded-xl p-4">
        <h1 className="text-xl font-bold mb-3">Forgot password</h1>
        <p className="text-sm text-gray-700 mb-4">
          Enter the email you used to register. If it exists, we’ll send you a password reset link.
        </p>

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
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 bg-brand-blue text-white hover:bg-brand-red disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        {errorCode === "EMAIL_NOT_VERIFIED" && (
          <div className="mt-3">
            <button
              type="button"
              onClick={resendVerification}
              disabled={loading || !email}
              className="w-full rounded-lg px-3 py-2 border border-brand-blue text-brand-blue hover:border-brand-red hover:text-brand-red disabled:opacity-60"
            >
              Resend verification email
            </button>
          </div>
        )}

        <div className="mt-4 text-sm">
          <a className="text-brand-blue hover:text-brand-red underline" href="/login">
            Back to login
          </a>
          <span className="mx-2 text-gray-400">•</span>
          <a className="text-brand-blue hover:text-brand-red underline" href="/signup">
            Create account
          </a>
        </div>
      </div>
    </div>
  );
}