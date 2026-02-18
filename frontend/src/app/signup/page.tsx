'use client';

import { useMemo, useState } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';

type Role = 'LISTER' | 'RENTER' | 'AGENT';

function normalizeLocalPhone(local: string) {
  const digits = local.replace(/[^\d]/g, '');
  // must be 9 digits starting with 7 or 1 (e.g. 7XXXXXXXX or 1XXXXXXXX)
  if (!/^[17]\d{8}$/.test(digits)) return null;
  return digits;
}

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<Role>('LISTER');

  // ✅ phone for all roles
  const [countryCode, setCountryCode] = useState('254'); // editable prefix
  const [localPhone, setLocalPhone] = useState('7'); // 7XXXXXXXX or 1XXXXXXXX

  // Agent extra fields
  const [location, setLocation] = useState('');
  const [dailyFee, setDailyFee] = useState('');
  const [whatsapp, setWhatsapp] = useState<'yes' | 'no'>('no');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const normalizedFullPhone = useMemo(() => {
    const cc = String(countryCode || '').replace(/[^\d]/g, '');
    const lp = normalizeLocalPhone(localPhone);
    if (!cc || !lp) return null;
    return `${cc}${lp}`; // digits only
  }, [countryCode, localPhone]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    if (!normalizedFullPhone) {
      setError('Enter phone as 7XXXXXXXX or 1XXXXXXXX.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        name,
        email,
        password,
        role,
        phone: normalizedFullPhone, // ✅ digits-only E.164
      };

      if (role === 'AGENT') {
        payload.agentProfile = {
          location,
          dailyFee: dailyFee ? Number(dailyFee) : null,
          phone: normalizedFullPhone,
          whatsapp: whatsapp === 'yes',
        };
      }

      const res = await api.post<any>('/api/auth/signup', payload);

      if (!res.ok) {
        setError((res.data as any)?.message || 'Failed to create account');
        return;
      }

      // ✅ Stop auto-login. Redirect to login with success message.
      router.replace('/login?registered=1');
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-10 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Create account</h1>

      <form onSubmit={submit} className="bg-white border rounded-xl p-4 space-y-3">
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          className="w-full border rounded-lg px-3 py-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {/* ✅ Phone for all roles */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Phone</label>
          <div className="flex gap-2">
            <input
              className="w-[110px] border rounded-lg px-3 py-2 bg-gray-50"
              value={`+${countryCode}`}
              onChange={(e) => setCountryCode(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="+254"
              inputMode="numeric"
            />
            <input
              className="flex-1 border rounded-lg px-3 py-2"
              placeholder="7XXXXXXXX"
              value={localPhone}
              onChange={(e) => setLocalPhone(e.target.value)}
              inputMode="numeric"
              required
            />
          </div>
          <p className="text-xs text-gray-500">Format: +254 7XXXXXXXX or +254 1XXXXXXXX</p>
        </div>

        <input
          className="w-full border rounded-lg px-3 py-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <input
          className="w-full border rounded-lg px-3 py-2"
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        <select
          className="w-full border rounded-lg px-3 py-2"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          <option value="LISTER">Lister</option>
          <option value="RENTER">Renter</option>
          {/* If you want Agent signups visible, uncomment: */}
          {/* <option value="AGENT">Agent</option> */}
        </select>

        {role === 'AGENT' && (
          <div className="space-y-2 pt-2 border-t">
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Daily fee (KES)"
              value={dailyFee}
              onChange={(e) => setDailyFee(e.target.value)}
              inputMode="numeric"
            />
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value as any)}
            >
              <option value="no">WhatsApp? No</option>
              <option value="yes">WhatsApp? Yes</option>
            </select>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          className="w-full rounded-lg px-3 py-2 bg-brand-blue text-white hover:bg-brand-red disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </section>
  );
}