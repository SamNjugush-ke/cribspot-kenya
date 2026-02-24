'use client';

import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/auth/Guard';
import RequirePermission from '@/components/super/RequirePermission';
import { apiFetch } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type PaymentRow = {
  id: string;
  userId?: string;
  planId?: string;
  amount: number;
  status: string;
  provider?: string;
  transactionCode?: string | null;
  externalRef?: string | null;
  createdAt?: string;
};

function moneyKES(n: number) {
  const v = Number(n || 0);
  return `KES ${v.toLocaleString()}`;
}

export default function AdminPaymentsPage() {
  return (
    <Guard allowed={['ADMIN', 'SUPER_ADMIN']}>
      <RequirePermission anyOf={['VIEW_TRANSACTIONS_ALL', 'VIEW_OWN_INVOICES']}>
        <PaymentsInner />
      </RequirePermission>
    </Guard>
  );
}

function PaymentsInner() {
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'ALL' | string>('ALL');
  const [provider, setProvider] = useState<'ALL' | string>('ALL');

  async function load() {
    try {
      setLoading(true);
      const json = await apiFetch<any>('/payments', { method: 'GET' });
      const arr: PaymentRow[] = Array.isArray(json) ? json : json?.items || json?.payments || [];
      setItems(arr);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to load payments');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const statusOptions = useMemo(
    () => Array.from(new Set(items.map((p) => String(p.status || '')).filter(Boolean))).sort(),
    [items]
  );
  const providerOptions = useMemo(
    () => Array.from(new Set(items.map((p) => String(p.provider || '')).filter(Boolean))).sort(),
    [items]
  );

  const displayed = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((p) => {
      const text = `${p.id} ${p.userId ?? ''} ${p.planId ?? ''} ${p.status} ${p.provider ?? ''} ${p.transactionCode ?? ''} ${p.externalRef ?? ''}`.toLowerCase();
      const okQ = !needle || text.includes(needle);
      const okStatus = status === 'ALL' || String(p.status) === status;
      const okProv = provider === 'ALL' || String(p.provider) === provider;
      return okQ && okStatus && okProv;
    });
  }, [items, q, status, provider]);

  const total = useMemo(() => displayed.reduce((s, p) => s + Number(p.amount || 0), 0), [displayed]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <div className="text-sm text-muted-foreground">
            {loading ? 'Loading…' : `Showing ${displayed.length} • Total ${moneyKES(total)}`}
          </div>
        </div>

        <Button variant="outline" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search id / userId / transaction code…"
          className="w-full md:w-[420px]"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select className="border rounded-md px-3 py-2 bg-white text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select className="border rounded-md px-3 py-2 bg-white text-sm" value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="ALL">All providers</option>
          {providerOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Tx Code</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : displayed.length ? (
              displayed.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.id}</TableCell>
                  <TableCell className="whitespace-nowrap">{moneyKES(p.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={String(p.status).toUpperCase() === 'SUCCESS' ? 'default' : 'secondary'}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{p.provider ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{p.transactionCode ?? '—'}</TableCell>
                  <TableCell>{p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No payments match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
