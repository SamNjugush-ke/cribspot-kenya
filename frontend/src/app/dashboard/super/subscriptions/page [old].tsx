//frontend/src/app/dashboard/super/subscription/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/auth/Guard';
import { API_BASE } from '@/lib/api';

type Sub = {
  id: string;
  userId: string;
  planId: string;
  startedAt: string;
  expiresAt: string;
  isActive: boolean;
  user?: { id: string; name: string; email: string };
  plan?: { id: string; name: string };
};

export default function Page() {
  return (
    <Guard allowed={['SUPER_ADMIN']}>
      <SubscriptionsPage />
    </Guard>
  );
}

function SubscriptionsPage() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [sortKey, setSortKey] = useState<'user' | 'plan' | 'start' | 'end'>('start');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [messageFor, setMessageFor] = useState<Sub | null>(null);
  const [messageBody, setMessageBody] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('rk_token') : null;
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    (async () => {
      // Prefer a backend endpoint that returns subs with user & plan included.
      // If your /api/subscriptions already returns relations, great. If not, this will still work with basic fields.
      const res = await fetch(`${API_BASE}/api/subscriptions`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setSubs(json?.items || json || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let arr = [...subs];
    if (status !== 'all') {
      arr = arr.filter(s => (status === 'active' ? s.isActive : !s.isActive));
    }
    if (q) {
      const qq = q.toLowerCase();
      arr = arr.filter(s => {
        const u = `${s.user?.name || ''} ${s.user?.email || ''}`.toLowerCase();
        const p = `${s.plan?.name || ''}`.toLowerCase();
        return u.includes(qq) || p.includes(qq) || s.id.toLowerCase().includes(qq);
      });
    }
    arr.sort((a, b) => {
      let A = '', B = '';
      if (sortKey === 'user') { A = a.user?.name || a.user?.email || ''; B = b.user?.name || b.user?.email || ''; }
      if (sortKey === 'plan') { A = a.plan?.name || ''; B = b.plan?.name || ''; }
      if (sortKey === 'start') { A = a.startedAt; B = b.startedAt; }
      if (sortKey === 'end') { A = a.expiresAt; B = b.expiresAt; }
      return (A > B ? 1 : A < B ? -1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
    return arr;
  }, [subs, q, status, sortKey, sortDir]);

  function sortBy(k: typeof sortKey) {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  }

  function openMessage(s: Sub) {
    setMessageFor(s);
    const name = s.user?.name || s.user?.email || 'there';
    const plan = s.plan?.name || '[Plan]';
    const start = new Date(s.startedAt).toLocaleDateString();
    const end = new Date(s.expiresAt).toLocaleDateString();
    setMessageBody(`Greetings ${name},\n\nThis is regarding your subscription to the plan "${plan}", which runs between ${start} and ${end}.\n\nRegards,\nAdmin`);
  }

  async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!messageFor?.userId) return alert('Missing receiver');
    const res = await fetch(`${API_BASE}/api/messages`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ receiverId: messageFor.userId, content: messageBody }),
    });
    if (!res.ok) return alert('Failed to send');
    setMessageFor(null);
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Subscriptions</h1>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by user, plan, ID…"
          className="border rounded px-3 py-2 w-full max-w-md"
        />
        <select value={status} onChange={e => setStatus(e.target.value as any)} className="border rounded px-3 py-2">
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2 cursor-pointer" onClick={() => sortBy('user')}>User</th>
              <th className="text-left p-2 cursor-pointer" onClick={() => sortBy('plan')}>Plan</th>
              <th className="text-left p-2 cursor-pointer" onClick={() => sortBy('start')}>Start</th>
              <th className="text-left p-2 cursor-pointer" onClick={() => sortBy('end')}>End</th>
              <th className="text-left p-2">Status</th>
              <th className="text-right p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-t">
                <td className="p-2">{s.user?.name || s.user?.email || s.userId}</td>
                <td className="p-2">{s.plan?.name || s.planId}</td>
                <td className="p-2">{new Date(s.startedAt).toLocaleString()}</td>
                <td className="p-2">{new Date(s.expiresAt).toLocaleString()}</td>
                <td className="p-2">
                  <span className={`px-2 py-1 rounded text-xs ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {s.isActive ? 'Active' : 'Expired'}
                  </span>
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => openMessage(s)}
                    className="px-3 py-1 rounded text-white"
                    style={{ background: '#0b1320' }}
                  >
                    Message
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td className="p-3 text-gray-500" colSpan={6}>No subscriptions found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Message modal */}
      {messageFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={sendMessage} className="bg-white rounded-lg w-full max-w-lg p-5 space-y-3">
            <div className="text-lg font-semibold">Message {messageFor.user?.name || messageFor.user?.email || messageFor.userId}</div>
            <textarea
              value={messageBody}
              onChange={e => setMessageBody(e.target.value)}
              rows={8}
              className="w-full border rounded px-2 py-2"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMessageFor(null)} className="px-4 py-2 rounded border">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded text-white" style={{ background: '#0b1320' }}>Send</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
