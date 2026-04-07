'use client';
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import EP from "@/lib/endpoints";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type AllowedSignupRole = "RENTER" | "LISTER";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AllowedSignupRole>("RENTER");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/dashboard";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.post(EP.signup, { name, email, password, role });
      router.replace("/login?next=" + encodeURIComponent(next));
    } catch (e:any) {
      const s = e?.response?.status;
      const m = e?.response?.data?.message || e?.message || "Signup failed";
      setErr(`${m}${s ? ` (HTTP ${s})` : ""}`);
    } finally { setBusy(false); }
  };

  return (
    <section className="container max-w-md py-10 space-y-4">
      <h1 className="text-2xl font-bold">Create account</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div><Label>Name</Label><Input value={name} onChange={(e)=>setName(e.target.value)} required /></div>
        <div><Label>Email</Label><Input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" required autoComplete="username" /></div>
        <div><Label>Password</Label><Input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" required autoComplete="new-password" /></div>

        <div>
          <Label>Role</Label>
          <div className="mt-2 flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="role" value="RENTER" checked={role==="RENTER"} onChange={()=>setRole("RENTER")} />
              RENTER
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="role" value="LISTER" checked={role==="LISTER"} onChange={()=>setRole("LISTER")} />
              LISTER
            </label>
          </div>
          <p className="text-xs text-gray-600 mt-1">Other roles (ADMIN, AGENT, EDITOR) can only be granted by Super Admin.</p>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
      </form>
    </section>
  );
}
