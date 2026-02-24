'use client';

import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/auth/Guard';
import RequirePermission from '@/components/super/RequirePermission';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type ListingStatus = 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';

type PropertyRow = {
  id: string;
  title: string;
  location: string;
  county?: string | null;
  constituency?: string | null;
  ward?: string | null;
  status: ListingStatus;
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
  listerId?: string;
};

export default function AdminListingsPage() {
  return (
    <Guard allowed={['ADMIN', 'SUPER_ADMIN']}>
      <RequirePermission anyOf={['APPROVE_LISTINGS', 'VIEW_ANALYTICS', 'EXPORT_DATA', 'MANAGE_USERS']}>
        <ListingsInner />
      </RequirePermission>
    </Guard>
  );
}

function pill(status: ListingStatus) {
  if (status === 'PUBLISHED') return <Badge>Published</Badge>;
  if (status === 'UNPUBLISHED') return <Badge variant="secondary">Unpublished</Badge>;
  return <Badge variant="outline">Draft</Badge>;
}

function ListingsInner() {
  const [items, setItems] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'ALL' | ListingStatus>('ALL');

  async function load() {
    try {
      setLoading(true);
      const usp = new URLSearchParams();
      usp.set('page', '1');
      usp.set('limit', '200');
      usp.set('status', status === 'ALL' ? 'ALL' : status);

      const res = await apiGet<any>(`/properties?${usp.toString()}`);
      const data = (res as any)?.data ?? (res as any)?.json ?? res;
      const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setItems(arr);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to load listings');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const displayed = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((p) => {
      const text = `${p.title} ${p.location} ${p.county ?? ''} ${p.constituency ?? ''} ${p.ward ?? ''} ${p.status}`.toLowerCase();
      const okQ = !needle || text.includes(needle);
      const okStatus = status === 'ALL' || p.status === status;
      return okQ && okStatus;
    });
  }, [items, q, status]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Listings</h1>
          <div className="text-sm text-muted-foreground">
            {loading ? 'Loading…' : `Showing ${displayed.length} of ${items.length}`}
          </div>
        </div>

        <Button variant="outline" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search title/location/county…"
          className="w-full md:w-[420px]"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="border rounded-md px-3 py-2 bg-white text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
        >
          <option value="ALL">All</option>
          <option value="PUBLISHED">Published</option>
          <option value="UNPUBLISHED">Unpublished</option>
          <option value="DRAFT">Draft</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>County</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : displayed.length ? (
              displayed.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>{p.location}</TableCell>
                  <TableCell>{p.county ?? '—'}</TableCell>
                  <TableCell>{pill(p.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => (window.location.href = `/properties/${p.id}`)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No listings match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        Note: moderation actions (approve/feature/unpublish) require your admin properties controller/routes.
      </div>
    </section>
  );
}
