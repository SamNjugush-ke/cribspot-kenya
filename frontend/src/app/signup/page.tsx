'use client';

import { useMemo, useState } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

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

  // success UI state
  const [registered, setRegistered] = useState(false);
  const [mailSent, setMailSent] = useState<boolean | null>(null); // null until registered
  const [info, setInfo] = useState<string | null>(null);

  // password UX
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const normalizedFullPhone = useMemo(() => {
    const cc = String(countryCode || '').replace(/[^\d]/g, '');
    const lp = normalizeLocalPhone(localPhone);
    if (!cc || !lp) return null;
    return `${cc}${lp}`; // digits only
  }, [countryCode, localPhone]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // tight client-side validation (fast feedback)
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
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
    setInfo(null);

    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        phone: normalizedFullPhone, // ✅ digits-only E.164
      };

      if (role === 'AGENT') {
        payload.agentProfile = {
          location: location.trim(),
          dailyFee: dailyFee ? Number(dailyFee) : null,
          phone: normalizedFullPhone,
          whatsapp: whatsapp === 'yes',
        };
      }

      const res = await api.post<any>('/api/auth/signup', payload);

      if (!res.ok) {
        setError((res.data as any)?.message || res.error || 'Failed to create account');
        return;
      }

      // ✅ Only mark as registered after backend confirms success
      const sent = Boolean((res.data as any)?.mailSent);
      setRegistered(true);
      setMailSent(sent);

      if (sent) {
        setInfo(
          'Registration successful. Please check your email (including spam) to confirm your email address.'
        );
      } else {
        setInfo(
          'Registration successful, but the confirmation email was not sent. Please click “Resend email” below.'
        );
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const r = await api.post('/api/auth/resend-verification', { email: email.trim() });

      if (!r.ok) {
        setMailSent(false);
        setError((r.data as any)?.message || r.error || 'Failed to resend email');
        // keep the "registered" page visible; just show error below
        return;
      }

      setMailSent(true);
      setInfo(
        (r.data as any)?.message ||
          'Verification email sent. Please check your inbox (and spam) and click the confirmation link.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-10 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Create account</h1>

      {registered ? (
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              mailSent
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            {info ||
              (mailSent
                ? 'Registration successful. Please check your email (including spam) to confirm your email address.'
                : 'Registration successful, but the confirmation email was not sent. Please click “Resend email” below.')}
          </div>

          {mailSent ? (
            <p className="text-sm text-gray-700">
              Once you click the confirmation link sent to your email, you’ll be redirected back to sign in.
            </p>
          ) : (
            <p className="text-sm text-gray-700">
              No stress — your account is created. Click <span className="font-medium">Resend email</span> below to
              send the confirmation link.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg px-3 py-2 bg-brand-blue text-white hover:bg-brand-red disabled:opacity-60"
              onClick={() => router.push('/login')}
              disabled={loading}
            >
              Go to login
            </button>

            <button
              type="button"
              className="flex-1 rounded-lg px-3 py-2 border border-brand-blue text-brand-blue hover:border-brand-red hover:text-brand-red disabled:opacity-60"
              onClick={resend}
              disabled={loading || !email.trim()}
              title={!email.trim() ? 'Enter your email first' : undefined}
            >
              {loading ? 'Sending…' : 'Resend email'}
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      ) : (
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

          {/* ✅ Password with eye toggle */}
          <div className="relative">
            <input
              className="w-full border rounded-lg px-3 py-2 pr-10"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-brand-blue transition-colors p-1"
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* ✅ Confirm password with eye toggle */}
          <div className="relative">
            <input
              className="w-full border rounded-lg px-3 py-2 pr-10"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-brand-blue transition-colors p-1"
              aria-label="Toggle confirm password visibility"
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

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
      )}
    </section>
  );
}