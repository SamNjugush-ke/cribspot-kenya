'use client';

import { useState } from 'react';
import api, { apiGet } from '@/lib/api';
import { useRouter } from 'next/navigation';

type Role = 'LISTER' | 'RENTER' | 'AGENT';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<Role>('LISTER');

  // Agent extra fields
  const [location, setLocation] = useState('');
  const [dailyFee, setDailyFee] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState<'yes' | 'no'>('no');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: any = { name, email, password, role, phone };

      if (role === 'AGENT') {
        payload.agentProfile = {
          location,
          dailyFee: dailyFee ? Number(dailyFee) : null,
          phone,
          whatsapp: whatsapp === 'yes',
        };
      }

      const res = await api.post<any>('/api/auth/signup', payload);

      // Some backends return {token, user}; others only return {user} then you login.
      const token = res.data?.token || res.data?.data?.token;
      const user = res.data?.user || res.data?.data?.user;

      if (token) {
        localStorage.setItem('rk_token', token);
        if (user?.id) localStorage.setItem('rk_user', JSON.stringify(user));
        else {
          const me = await apiGet<{ user: any }>('/api/auth/me');
          if (me.ok && me.data?.user) localStorage.setItem('rk_user', JSON.stringify(me.data.user));
        }
        localStorage.setItem('rk_last_activity', String(Date.now()));
      } else {
        // No token returned -> immediately login using same credentials
        const login = await api.post<{ token: string; user: any }>('/api/auth/login', { email, password });
        if (!login.ok || !login.data?.token) throw new Error((login.data as any)?.message || 'Signup/login failed');
        localStorage.setItem('rk_token', login.data.token);
        if (login.data.user) localStorage.setItem('rk_user', JSON.stringify(login.data.user));
        localStorage.setItem('rk_last_activity', String(Date.now()));
      }

      if (role === 'AGENT') {
        alert('Your agent account has been created and is pending approval by admin.');
        router.replace('/');
      } else if (role === 'LISTER') {
        router.replace('/dashboard/lister');
      } else {
        router.replace('/dashboard/renter');
      }
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
            />
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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