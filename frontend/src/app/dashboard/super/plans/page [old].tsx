//frontend/src/app/dashboard/super/plans/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/auth/Guard';
import { API_BASE } from '@/lib/api';

type Plan = {
  id: string;
  name: string;
  price: number;
  durationInDays: number;
  totalListings: number;
  featuredListings: number;
  isActive: boolean;
  createdAt: string;
};

type Coupon = {
  id: string;
  code: string;
  percentOff?: number | null;
  amountOff?: number | null;
  startsAt: string;
  endsAt?: string | null;
  isActive: boolean;
  createdAt: string;
  applicablePlans: { subscriptionPlan: Plan }[];
};

export default function Page() {
  return (
    <Guard allowed={['SUPER_ADMIN']}>
      <PlansPage />
    </Guard>
  );
}

function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  // Coupons
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponForm, setCouponForm] = useState<{
    id?: string;
    code: string;
    percentOff?: number | '';
    amountOff?: number | '';
    startsAt: string;
    endsAt?: string;
    isActive: boolean;
    planIds: string[];
  }>({
    code: '',
    percentOff: undefined,
    amountOff: undefined,
    startsAt: new Date().toISOString().slice(0, 16), // yyyy-mm-ddThh:mm
    endsAt: '',
    isActive: true,
    planIds: [],
  });

  const token = typeof window !== 'undefined' ? localStorage.getItem('rk_token') : null;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    (async () => {
      await Promise.all([loadPlans(), loadCoupons()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPlans() {
    const res = await fetch(`${API_BASE}/api/admin/plans`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    setPlans(json || []);
  }

  async function loadCoupons() {
    const res = await fetch(`${API_BASE}/api/admin/coupons`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    setCoupons(json || []);
  }

  const activePlans = useMemo(() => plans.filter(p => p.isActive), [plans]);
  const inactivePlans = useMemo(() => plans.filter(p => !p.isActive), [plans]);

  const filtered = (arr: Plan[]) =>
    arr.filter(p =>
      [p.name, String(p.price), String(p.durationInDays)].join(' ').toLowerCase().includes(q.toLowerCase()),
    );

  async function createPlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get('name')),
      price: Number(fd.get('price')),
      durationInDays: Number(fd.get('durationInDays')),
      totalListings: Number(fd.get('totalListings')),
      featuredListings: Number(fd.get('featuredListings')),
      isActive: Boolean(fd.get('isActive')),
    };
    const res = await fetch(`${API_BASE}/api/admin/plans`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) return alert('Failed to create plan');
    setShowNew(false);
    await loadPlans();
  }

  async function updatePlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    const body: Partial<Plan> = {
      name: String(fd.get('name')),
      price: Number(fd.get('price')),
      durationInDays: Number(fd.get('durationInDays')),
      totalListings: Number(fd.get('totalListings')),
      featuredListings: Number(fd.get('featuredListings')),
      isActive: Boolean(fd.get('isActive')),
    };
    const res = await fetch(`${API_BASE}/api/admin/plans/${editing.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
    if (!res.ok) return alert('Failed to update plan');
    setEditing(null);
    await loadPlans();
  }

  async function toggleActive(p: Plan) {
    const res = await fetch(`${API_BASE}/api/admin/plans/${p.id}`, { method: 'PATCH', headers, body: JSON.stringify({ isActive: !p.isActive }) });
    if (!res.ok) return alert('Failed to toggle');
    await loadPlans();
  }

  async function deletePlan(id: string) {
    if (!confirm('Delete this plan?')) return;
    const res = await fetch(`${API_BASE}/api/admin/plans/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return alert('Failed to delete');
    await loadPlans();
  }

  function openNewCoupon() {
    setCouponForm({
      code: '',
      percentOff: undefined,
      amountOff: undefined,
      startsAt: new Date().toISOString().slice(0, 16),
      endsAt: '',
      isActive: true,
      planIds: [],
    });
    setShowCouponModal(true);
  }

  async function saveCoupon(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { id, code, percentOff, amountOff, startsAt, endsAt, isActive, planIds } = couponForm;
    const body = {
      code,
      percentOff: percentOff === '' ? undefined : Number(percentOff),
      amountOff: amountOff === '' ? undefined : Number(amountOff),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      isActive,
      planIds,
    };
    const url = id ? `${API_BASE}/api/admin/coupons/${id}` : `${API_BASE}/api/admin/coupons`;
    const method = id ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
    if (!res.ok) return alert('Failed to save coupon');
    setShowCouponModal(false);
    await loadCoupons();
  }

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plans</h1>
        <div className="flex gap-2">
          <button
            onClick={openNewCoupon}
            className="px-4 py-2 rounded-md text-white"
            style={{ background: '#0b1320' }}
          >
            New Coupon
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 rounded-md text-white"
            style={{ background: '#0b1320' }}
          >
            Create Plan
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search plans…"
          className="border rounded px-3 py-2 w-full max-w-md"
        />
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          {/* Active */}
          <h2 className="text-lg font-semibold mt-2">Active Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filtered(activePlans).map(p => (
              <div key={p.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm text-gray-500">KES {p.price} • {p.durationInDays} days</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Listings: {p.totalListings} • Featured: {p.featuredListings}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive(p)}
                    className="text-xs px-2 py-1 rounded border"
                  >
                    Deactivate
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setEditing(p)}
                    className="px-3 py-1 rounded text-white"
                    style={{ background: '#0b1320' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deletePlan(p.id)}
                    className="px-3 py-1 rounded border text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {!filtered(activePlans).length && <div className="text-sm text-gray-500">No active plans.</div>}
          </div>

          {/* Inactive */}
          <h2 className="text-lg font-semibold mt-6">Inactive Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filtered(inactivePlans).map(p => (
              <div key={p.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm text-gray-500">KES {p.price} • {p.durationInDays} days</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Listings: {p.totalListings} • Featured: {p.featuredListings}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive(p)}
                    className="text-xs px-2 py-1 rounded border"
                  >
                    Activate
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setEditing(p)}
                    className="px-3 py-1 rounded text-white"
                    style={{ background: '#0b1320' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deletePlan(p.id)}
                    className="px-3 py-1 rounded border text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {!filtered(inactivePlans).length && <div className="text-sm text-gray-500">No inactive plans.</div>}
          </div>

          {/* Coupons */}
          <h2 className="text-lg font-semibold mt-8">Coupons</h2>
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Code</th>
                  <th className="text-left p-2">Discount</th>
                  <th className="text-left p-2">Starts</th>
                  <th className="text-left p-2">Ends</th>
                  <th className="text-left p-2">Plans</th>
                  <th className="text-right p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => {
                  const discount =
                    c.percentOff != null ? `${c.percentOff}%` :
                    c.amountOff != null ? `KES ${c.amountOff}` : '—';
                  const plansList = c.applicablePlans?.map(ap => ap.subscriptionPlan?.name).filter(Boolean).join(', ') || 'All / None linked';
                  return (
                    <tr key={c.id} className="border-t">
                      <td className="p-2">{c.code}</td>
                      <td className="p-2">{discount}</td>
                      <td className="p-2">{new Date(c.startsAt).toLocaleString()}</td>
                      <td className="p-2">{c.endsAt ? new Date(c.endsAt).toLocaleString() : '—'}</td>
                      <td className="p-2">{plansList}</td>
                      <td className="p-2 text-right">
                        <span className={`px-2 py-1 rounded text-xs ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {c.isActive ? 'Running' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!coupons.length && (
                  <tr><td className="p-3 text-gray-500" colSpan={6}>No coupons yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Create Plan Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={createPlan} className="bg-white rounded-lg w-full max-w-lg p-5 space-y-3">
            <div className="text-lg font-semibold">Create Plan</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Name<input name="name" required className="mt-1 border rounded w-full px-2 py-1" /></label>
              <label className="text-sm">Price (KES)<input name="price" type="number" required className="mt-1 border rounded w-full px-2 py-1" /></label>
              <label className="text-sm">Duration (days)<input name="durationInDays" type="number" required className="mt-1 border rounded w-full px-2 py-1" /></label>
              <label className="text-sm">Total Listings<input name="totalListings" type="number" required className="mt-1 border rounded w-full px-2 py-1" /></label>
              <label className="text-sm">Featured Listings<input name="featuredListings" type="number" required className="mt-1 border rounded w-full px-2 py-1" /></label>
              <label className="text-sm flex items-center gap-2 mt-6"><input name="isActive" type="checkbox" defaultChecked /> Active</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 rounded border">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded text-white" style={{ background: '#0b1320' }}>Save</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Plan Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={updatePlan} className="bg-white rounded-lg w-full max-w-lg p-5 space-y-3">
            <div className="text-lg font-semibold">Edit Plan</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Name<input name="name" defaultValue={editing.name} required className="mt-1 border rounded w-full px-2 py-1" /></label>
              <label className="text-sm">Price (KES)<input name="price" type="number" defaultValue={editing.price} required className="mt-1 border rounded w-full px-2 py-1" /></label>
              <label className="text-sm">Duration (days)<input name="durationInDays" type="number" defaultValue={editing.durationInDays} required className="mt-1 border rounded w-full px-2 py-1" /></label>
              <label className="text-sm">Total Listings<input name="totalListings" type="number" defaultValue={editing.totalListings} required className="mt-1 border rounded w-full px-2 py-1" /></label>
              <label className="text-sm">Featured Listings<input name="featuredListings" type="number" defaultValue={editing.featuredListings} required className="mt-1 border rounded w-full px-2 py-1" /></label>
              <label className="text-sm flex items-center gap-2 mt-6"><input name="isActive" type="checkbox" defaultChecked={editing.isActive} /> Active</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded border">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded text-white" style={{ background: '#0b1320' }}>Save</button>
            </div>
          </form>
        </div>
      )}

      {/* Coupon Modal */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={saveCoupon} className="bg-white rounded-lg w-full max-w-xl p-5 space-y-3">
            <div className="text-lg font-semibold">Create Coupon</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Code<input required className="mt-1 border rounded w-full px-2 py-1" value={couponForm.code} onChange={e => setCouponForm(v => ({ ...v, code: e.target.value }))} /></label>
              <label className="text-sm">% Off<input type="number" className="mt-1 border rounded w-full px-2 py-1" value={couponForm.percentOff ?? ''} onChange={e => setCouponForm(v => ({ ...v, percentOff: e.target.value === '' ? '' : Number(e.target.value) }))} /></label>
              <label className="text-sm">Amount Off (KES)<input type="number" className="mt-1 border rounded w-full px-2 py-1" value={couponForm.amountOff ?? ''} onChange={e => setCouponForm(v => ({ ...v, amountOff: e.target.value === '' ? '' : Number(e.target.value) }))} /></label>
              <label className="text-sm">Starts At<input type="datetime-local" className="mt-1 border rounded w-full px-2 py-1" value={couponForm.startsAt} onChange={e => setCouponForm(v => ({ ...v, startsAt: e.target.value }))} /></label>
              <label className="text-sm">Ends At<input type="datetime-local" className="mt-1 border rounded w-full px-2 py-1" value={couponForm.endsAt || ''} onChange={e => setCouponForm(v => ({ ...v, endsAt: e.target.value }))} /></label>
              <label className="text-sm flex items-center gap-2 mt-6"><input type="checkbox" checked={couponForm.isActive} onChange={e => setCouponForm(v => ({ ...v, isActive: e.target.checked }))} /> Active</label>
            </div>

            <div className="text-sm font-medium mt-3">Applicable Plans</div>
            <div className="max-h-40 overflow-auto border rounded p-2">
              {plans.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm py-1">
                  <input
                    type="checkbox"
                    checked={couponForm.planIds.includes(p.id)}
                    onChange={(e) =>
                      setCouponForm(v => ({
                        ...v,
                        planIds: e.target.checked ? [...v.planIds, p.id] : v.planIds.filter(x => x !== p.id),
                      }))
                    }
                  />
                  <span>{p.name} — KES {p.price}</span>
                </label>
              ))}
              {!plans.length && <div className="text-xs text-gray-500">No plans available.</div>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCouponModal(false)} className="px-4 py-2 rounded border">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded text-white" style={{ background: '#0b1320' }}>Save Coupon</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
