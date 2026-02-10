//frontend/src/app/dashboard/super/reports/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/auth/Guard';
import { API_BASE } from '@/lib/api';

type User = { id: string; name: string; email: string; role: string; createdAt: string };
type Payment = { id: string; amount: number; status: string; provider: string; externalRef?: string | null; createdAt: string };
type Sub = { id: string; userId: string; planId: string; isActive: boolean; startedAt: string; expiresAt: string };
type Plan = { id: string; name: string; price: number; isActive: boolean; createdAt: string };
type Listing = { id: string; title: string; county?: string | null; status: string; featured: boolean; createdAt: string };

type Tab = 'Users' | 'Payments' | 'Subscriptions' | 'Plans' | 'Listings';

export default function Page() {
  return (
    <Guard allowed={['SUPER_ADMIN']}>
      <ReportsPage />
    </Guard>
  );
}

function ReportsPage() {
  const [tab, setTab] = useState<Tab>('Users');
  const [q, setQ] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const token = typeof window !== 'undefined' ? localStorage.getItem('rk_token') : null;

  // data buckets
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const auth = { Authorization: `Bearer ${token}` };

  // Load minimal previews per tab
  useEffect(() => {
    (async () => {
      if (tab === 'Users') {
        const r = await fetch(`${API_BASE}/api/admin/users`, { headers: auth });
        setUsers((await r.json()) || []);
      } else if (tab === 'Payments') {
        const r = await fetch(`${API_BASE}/api/admin/payments`, { headers: auth });
        setPayments((await r.json())?.items || (await r.json()) || []); // support either shape
      } else if (tab === 'Subscriptions') {
        const r = await fetch(`${API_BASE}/api/admin/subscriptions`, { headers: auth });
        const js = await r.json();
        setSubs(js?.items || js || []);
      } else if (tab === 'Plans') {
        const r = await fetch(`${API_BASE}/api/admin/plans`, { headers: auth });
        setPlans((await r.json()) || []);
      } else if (tab === 'Listings') {
        const r = await fetch(`${API_BASE}/api/admin/properties`, { headers: auth });
        const js = await r.json();
        setListings(js?.items || js || []);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filteredUsers = useFilter(users, q, dateFrom, dateTo, (u) => u.createdAt);
  const filteredPayments = useFilter(payments, q, dateFrom, dateTo, (p) => p.createdAt);
  const filteredSubs = useFilter(subs, q, dateFrom, dateTo, (s) => s.startedAt);
  const filteredPlans = useFilter(plans, q, dateFrom, dateTo, (p) => p.createdAt);
  const filteredListings = useFilter(listings, q, dateFrom, dateTo, (l) => l.createdAt);

  function exportResource(res: string, format: 'csv' | 'xlsx') {
    const url = `${API_BASE}/api/admin/reports/${res}?format=${format}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b">
        {(['Users', 'Payments', 'Subscriptions', 'Plans', 'Listings'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 -mb-px border-b-2 ${tab === t ? 'border-[#0b1320] text-[#0b1320] font-medium' : 'border-transparent text-gray-600'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-xs text-gray-600 mb-1">Search</div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Type to search…" className="border rounded px-3 py-2 w-64" />
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">From</div>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border rounded px-3 py-2" />
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">To</div>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border rounded px-3 py-2" />
        </div>

        <div className="ml-auto flex gap-2">
          <button onClick={() => exportResource(tab.toLowerCase(), 'csv')} className="px-4 py-2 rounded text-white" style={{ background: '#0b1320' }}>
            Export CSV
          </button>
          <button onClick={() => exportResource(tab.toLowerCase(), 'xlsx')} className="px-4 py-2 rounded border">
            Export Excel
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === 'Users' && (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Role</th>
                <th className="text-left p-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.slice(0, 50).map(u => (
                <tr key={u.id} className="border-t">
                  <td className="p-2">{u.name}</td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2">{new Date(u.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!filteredUsers.length && <tr><td className="p-3 text-gray-500" colSpan={4}>No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Payments' && (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Amount</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Provider</th>
                <th className="text-left p-2">External Ref</th>
                <th className="text-left p-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.slice(0, 50).map(p => (
                <tr key={p.id} className="border-t">
                  <td className="p-2">KES {p.amount}</td>
                  <td className="p-2">{p.status}</td>
                  <td className="p-2">{p.provider}</td>
                  <td className="p-2">{p.externalRef || '—'}</td>
                  <td className="p-2">{new Date(p.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!filteredPayments.length && <tr><td className="p-3 text-gray-500" colSpan={5}>No payments found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Subscriptions' && (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">User</th>
                <th className="text-left p-2">Plan</th>
                <th className="text-left p-2">Start</th>
                <th className="text-left p-2">End</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubs.slice(0, 50).map(s => (
                <tr key={s.id} className="border-t">
                  <td className="p-2">{s.userId}</td>
                  <td className="p-2">{s.planId}</td>
                  <td className="p-2">{new Date(s.startedAt).toLocaleString()}</td>
                  <td className="p-2">{new Date(s.expiresAt).toLocaleString()}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.isActive ? 'Active' : 'Expired'}
                    </span>
                  </td>
                </tr>
              ))}
              {!filteredSubs.length && <tr><td className="p-3 text-gray-500" colSpan={5}>No subscriptions found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Plans' && (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Price</th>
                <th className="text-left p-2">Active</th>
                <th className="text-left p-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.slice(0, 50).map(p => (
                <tr key={p.id} className="border-t">
                  <td className="p-2">{p.name}</td>
                  <td className="p-2">KES {p.price}</td>
                  <td className="p-2">{p.isActive ? 'Yes' : 'No'}</td>
                  <td className="p-2">{new Date(p.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!filteredPlans.length && <tr><td className="p-3 text-gray-500" colSpan={4}>No plans found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Listings' && (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Title</th>
                <th className="text-left p-2">County</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Featured</th>
                <th className="text-left p-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredListings.slice(0, 50).map(l => (
                <tr key={l.id} className="border-t">
                  <td className="p-2">{l.title}</td>
                  <td className="p-2">{l.county || '—'}</td>
                  <td className="p-2">{l.status}</td>
                  <td className="p-2">{l.featured ? 'Yes' : 'No'}</td>
                  <td className="p-2">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!filteredListings.length && <tr><td className="p-3 text-gray-500" colSpan={5}>No listings found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ----- helpers -----
function useFilter<T>(
  rows: T[],
  q: string,
  from: string,
  to: string,
  dateGetter: (row: T) => string,
) {
  return useMemo(() => {
    const qq = q.toLowerCase();
    const fromTs = from ? new Date(from).getTime() : 0;
    const toTs = to ? new Date(to).getTime() + 24 * 3600 * 1000 : Number.MAX_SAFE_INTEGER;

    return rows.filter((r: any) => {
      // date filter
      const ts = new Date(dateGetter(r)).getTime();
      if (ts < fromTs || ts > toTs) return false;
      // search (stringify row shallowly)
      if (!q) return true;
      const bag = Object.values(r).map(v => (v == null ? '' : typeof v === 'object' ? '' : String(v))).join(' ').toLowerCase();
      return bag.includes(qq);
    });
  }, [rows, q, from, to, dateGetter]);
}
