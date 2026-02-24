'use client';

import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/auth/Guard';
import RequirePermission from '@/components/super/RequirePermission';
import { apiFetch } from '@/lib/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type TabKey = 'users' | 'listings' | 'payments' | 'subscriptions' | 'audit';

type AnyRow = Record<string, any>;

function uniqueValues(rows: AnyRow[], key: string) {
  const s = new Set<string>();
  for (const r of rows) {
    const v = r?.[key];
    if (v === null || v === undefined) continue;
    s.add(String(v));
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

function inDateRange(row: AnyRow, from?: string, to?: string) {
  if (!from && !to) return true;
  const candidates = ['createdAt', 'updatedAt', 'paidAt', 'expiresAt', 'endsAt', 'startAt'];
  const field = candidates.find((k) => row?.[k]) || Object.keys(row || {}).find((k) => /At$/.test(k) && row[k]);
  if (!field) return true;

  const dt = new Date(row[field]);
  if (Number.isNaN(dt.getTime())) return true;

  const fromDt = from ? new Date(from + 'T00:00:00.000Z') : null;
  const toDt = to ? new Date(to + 'T23:59:59.999Z') : null;

  if (fromDt && dt < fromDt) return false;
  if (toDt && dt > toDt) return false;
  return true;
}

function keywordHit(row: AnyRow, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  try {
    const text = JSON.stringify(row).toLowerCase();
    return text.includes(needle);
  } catch {
    return true;
  }
}

function toCsv(rows: AnyRow[]) {
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r || {}))));
  const esc = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(v);
    const needsQuotes = /[,"\n]/.test(s);
    const safe = s.replace(/"/g, '""');
    return needsQuotes ? `"${safe}"` : safe;
  };
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r?.[h])).join(','))];
  return lines.join('\n');
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function fetchTab(tab: TabKey) {
  const map: Record<TabKey, string> = {
    users: '/admin/users',
    listings: '/properties?status=ALL&limit=200&page=1',
    payments: '/payments',
    subscriptions: '/admin/subscriptions',
    audit: '/audit',
  };

  const path = map[tab];
  const data: any = await apiFetch<any>(path);
  if (Array.isArray(data)) return data as AnyRow[];
  if (Array.isArray(data?.items)) return data.items as AnyRow[];
  if (Array.isArray(data?.data)) return data.data as AnyRow[];
  if (Array.isArray(data?.rows)) return data.rows as AnyRow[];
  return [];
}

export default function AdminReportsPage() {
  return (
    <Guard allowed={['ADMIN', 'SUPER_ADMIN']}>
      <RequirePermission anyOf={['EXPORT_DATA', 'VIEW_SYSTEM_LOGS', 'VIEW_ANALYTICS', 'VIEW_TRANSACTIONS_ALL', 'MANAGE_USERS']}>
        <ReportsInner />
      </RequirePermission>
    </Guard>
  );
}

function ReportsInner() {
  const [tab, setTab] = useState<TabKey>('users');

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');

  const [rows, setRows] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>('');

  const [userRole, setUserRole] = useState('ALL');
  const [listingStatus, setListingStatus] = useState('ALL');
  const [paymentStatus, setPaymentStatus] = useState('ALL');

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr('');
        const r = await fetchTab(tab);
        if (!alive) return;
        setRows(Array.isArray(r) ? r : []);
      } catch (e: any) {
        if (!alive) return;
        setRows([]);
        setErr(e?.message || `Failed to load ${tab}`);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [tab]);

  const roleOptions = useMemo(() => uniqueValues(rows, 'role'), [rows]);
  const listingStatuses = useMemo(() => uniqueValues(rows, 'status'), [rows]);
  const paymentStatuses = useMemo(() => uniqueValues(rows, 'status'), [rows]);

  const visible = useMemo(() => {
    let out = [...rows];
    out = out.filter((r) => inDateRange(r, from || undefined, to || undefined));
    out = out.filter((r) => keywordHit(r, q));

    if (tab === 'users' && userRole !== 'ALL') out = out.filter((r) => String(r?.role) === userRole);
    if (tab === 'listings' && listingStatus !== 'ALL') out = out.filter((r) => String(r?.status) === listingStatus);
    if (tab === 'payments' && paymentStatus !== 'ALL') out = out.filter((r) => String(r?.status) === paymentStatus);

    return out;
  }, [rows, tab, from, to, q, userRole, listingStatus, paymentStatus]);

  const columns = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of visible.slice(0, 250)) {
      for (const k of Object.keys(r || {})) counts.set(k, (counts.get(k) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k)
      .slice(0, 12);
  }, [visible]);

  function exportVisible(fmt: 'csv' | 'json') {
    const date = new Date().toISOString().slice(0, 10);
    const base = `${tab}_${date}_visible_${visible.length}`;
    if (fmt === 'json') return downloadBlob(JSON.stringify(visible, null, 2), `${base}.json`, 'application/json');
    return downloadBlob(toCsv(visible), `${base}.csv`, 'text/csv;charset=utf-8');
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Exports download only what you’re currently seeing.</p>
        </div>

        <div className="flex gap-2">
          <Button className="bg-brand-blue text-white" onClick={() => exportVisible('csv')} disabled={loading}>
            Export CSV
          </Button>
          <Button className="bg-brand-blue text-white" onClick={() => exportVisible('json')} disabled={loading}>
            Export JSON
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <Card className="shadow-soft mt-4">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label>From</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <Label>To</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Keyword</Label>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="email / id / action / anything…" />
              </div>
            </div>

            <TabsContent value="users" className="m-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Role</Label>
                  <select className="w-full rounded-md border px-3 py-2" value={userRole} onChange={(e) => setUserRole(e.target.value)}>
                    <option value="ALL">All</option>
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="listings" className="m-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Status</Label>
                  <select className="w-full rounded-md border px-3 py-2" value={listingStatus} onChange={(e) => setListingStatus(e.target.value)}>
                    <option value="ALL">All</option>
                    {listingStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="payments" className="m-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Status</Label>
                  <select className="w-full rounded-md border px-3 py-2" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                    <option value="ALL">All</option>
                    {paymentStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </TabsContent>

            <div className="rounded-2xl border bg-white overflow-hidden">
              <div className="flex items-center justify-between gap-2 p-3 border-b">
                <div className="text-sm">
                  {loading ? (
                    <span className="opacity-70">Loading…</span>
                  ) : err ? (
                    <span className="text-red-600">{err}</span>
                  ) : (
                    <>
                      Showing <b>{visible.length.toLocaleString()}</b> rows
                    </>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(visible.slice(0, 5), null, 2))}
                >
                  Copy sample (5 rows)
                </Button>
              </div>

              <div className="max-h-[60vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((c) => (
                        <TableHead key={c} className="whitespace-nowrap">
                          {c}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {!loading && !visible.length ? (
                      <TableRow>
                        <TableCell colSpan={columns.length || 1} className="text-center py-8 text-muted-foreground">
                          No rows match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      visible.slice(0, 500).map((r, idx) => (
                        <TableRow key={r?.id ?? idx}>
                          {columns.map((c) => (
                            <TableCell key={c} className="align-top">
                              {String(r?.[c] ?? '') || <span className="opacity-50">—</span>}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {visible.length > 500 && (
                <div className="p-3 border-t text-xs text-muted-foreground">
                  Table shows first 500 rows for performance; export includes <b>all visible rows</b>.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </Tabs>
    </section>
  );
}
