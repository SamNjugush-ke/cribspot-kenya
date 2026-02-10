'use client';

import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/auth/Guard';
import { API_BASE } from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDialogDesc,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import {
  Plus,
  RefreshCw,
  Search,
  MoreHorizontal,
  Pencil,
  PauseCircle,
  PlayCircle,
  Trash2,
  Power,
} from 'lucide-react';
import { toast } from 'sonner';

type Plan = {
  id: string;
  name: string;
  price: number;
  durationInDays: number;
  totalListings: number;
  featuredListings: number;
  isActive: boolean; // Active = Sales On, Suspended = Sales Off
  createdAt?: string;
};

type Sort = { field: keyof Plan; dir: 'asc' | 'desc' };

// ✅ First hit an admin-only “all plans” endpoint.
// (We’ll add this endpoint on backend below.)
const PLAN_LIST_ENDPOINT_CANDIDATES = [
  '/api/plans/admin',          // ✅ admin list (ALL plans)
  '/api/plans?scope=all',      // optional alternative if you prefer query based
  '/api/admin/plans',
  '/api/admin/subscriptions/plans',
  '/api/plans',                // public (ACTIVE only)
];

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('rk_token') : null;
}

async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    const msg = json?.error || json?.message || `Request failed (${res.status})`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json as T;
}

async function tryEndpoints<T>(
  fn: (path: string) => Promise<T>
): Promise<{ path: string; data: T }> {
  let lastErr: any = null;
  for (const path of PLAN_LIST_ENDPOINT_CANDIDATES) {
    try {
      const data = await fn(path);
      return { path, data };
    } catch (e: any) {
      if ([401, 403, 404].includes(e?.status)) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error('No plans endpoint matched');
}

function moneyKES(n: number) {
  const v = Number(n || 0);
  return `KES ${v.toLocaleString()}`;
}

function StatusPill({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs">
      <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
      ACTIVE (Sales On)
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
      SUSPENDED (Sales Off)
    </span>
  );
}

export default function PlansPage() {
  return (
    <Guard allowed={['SUPER_ADMIN']}>
      <PlansInner />
    </Guard>
  );
}

function PlansInner() {
  const [items, setItems] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listSource, setListSource] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [sort, setSort] = useState<Sort>({ field: 'createdAt' as any, dir: 'desc' });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  // form
  const [fName, setFName] = useState('');
  const [fPrice, setFPrice] = useState<number>(0);
  const [fDuration, setFDuration] = useState<number>(30);
  const [fTotal, setFTotal] = useState<number>(10);
  const [fFeatured, setFFeatured] = useState<number>(0);
  const [reason, setReason] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      setLoading(true);
      const { path, data } = await tryEndpoints<any>((p) => authedFetch<any>(p, { method: 'GET' }));

      const arr: Plan[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : [];

      setListSource(path);
      setItems(arr);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to load plans');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((p) => p.isActive).length;
    const suspended = items.filter((p) => !p.isActive).length;
    return { total, active, suspended };
  }, [items]);

  const displayed = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = items.filter((p) => {
      const text = `${p.name} ${p.price} ${p.durationInDays} ${p.totalListings} ${p.featuredListings}`.toLowerCase();
      const okQ = !needle || text.includes(needle);
      const okStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' ? p.isActive : !p.isActive);
      return okQ && okStatus;
    });

    out = [...out].sort((a, b) => {
      const v1: any = (a as any)[sort.field];
      const v2: any = (b as any)[sort.field];
      const A = v1 === null || v1 === undefined ? '' : String(v1);
      const B = v2 === null || v2 === undefined ? '' : String(v2);
      return sort.dir === 'asc' ? A.localeCompare(B) : B.localeCompare(A);
    });

    return out;
  }, [items, q, statusFilter, sort]);

  function openCreate() {
    setEditing(null);
    setFName('');
    setFPrice(0);
    setFDuration(30);
    setFTotal(10);
    setFFeatured(0);
    setReason('');
    setCreateOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditing(plan);
    setFName(plan.name);
    setFPrice(plan.price);
    setFDuration(plan.durationInDays);
    setFTotal(plan.totalListings);
    setFFeatured(plan.featuredListings);
    setReason('');
    setEditOpen(true);
  }

  function validateForm() {
    const name = fName.trim();
    if (!name) return 'Plan name is required';
    if (Number(fPrice) < 0) return 'Price cannot be negative';
    if (Number(fDuration) <= 0) return 'Duration must be > 0';
    if (Number(fTotal) < 0) return 'Total listings cannot be negative';
    if (Number(fFeatured) < 0) return 'Featured listings cannot be negative';
    if (Number(fFeatured) > Number(fTotal)) return 'Featured listings cannot exceed total listings';
    return null;
  }

  async function doCreate() {
    const err = validateForm();
    if (err) return toast.error(err);

    setSaving(true);
    try {
      await authedFetch(`/api/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fName.trim(),
          price: Number(fPrice),
          durationInDays: Number(fDuration),
          totalListings: Number(fTotal),
          featuredListings: Number(fFeatured),
          reason: reason || undefined,
        }),
      });
      toast.success('Plan created');
      setCreateOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create plan');
    } finally {
      setSaving(false);
    }
  }

  async function doUpdate() {
    if (!editing) return;
    const err = validateForm();
    if (err) return toast.error(err);

    setSaving(true);
    try {
      await authedFetch(`/api/plans/${editing.id}`, {
        method: 'PUT', // matches your route
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fName.trim(),
          price: Number(fPrice),
          durationInDays: Number(fDuration),
          totalListings: Number(fTotal),
          featuredListings: Number(fFeatured),
          reason: reason || undefined,
        }),
      });

      toast.success('Plan updated');
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update plan');
    } finally {
      setSaving(false);
    }
  }

  async function doSuspend(plan: Plan) {
    setSaving(true);
    try {
      await authedFetch(`/api/plans/${plan.id}/suspend`, { method: 'PATCH' });
      toast.success(`Suspended: ${plan.name}`);
      await load(); // will still show suspended because admin list returns all
    } catch (e: any) {
      toast.error(e?.message || 'Failed to suspend plan');
    } finally {
      setSaving(false);
    }
  }

  async function doResume(plan: Plan) {
    setSaving(true);
    try {
      await authedFetch(`/api/plans/${plan.id}/resume`, { method: 'PATCH' });
      toast.success(`Resumed: ${plan.name}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to resume plan');
    } finally {
      setSaving(false);
    }
  }

  async function doDelete(plan: Plan) {
    setSaving(true);
    try {
      const resp: any = await authedFetch(`/api/plans/${plan.id}`, { method: 'DELETE' });
      if (resp?.action === 'suspended') {
        toast.message('Not deletable — suspended instead', {
          description: `“${plan.name}” has active subscriptions, so it was suspended.`,
        });
      } else {
        toast.success(`Deleted: ${plan.name}`);
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete plan');
    } finally {
      setSaving(false);
    }
  }

  async function doStrictToggle(plan: Plan) {
    setSaving(true);
    try {
      await authedFetch(`/api/plans/${plan.id}/toggle`, { method: 'PATCH' });
      toast.success(`Toggled: ${plan.name}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to toggle plan');
    } finally {
      setSaving(false);
    }
  }

  const head = (label: string, field: keyof Plan | 'actions') => (
    <TableHead
      className={field !== 'actions' ? 'cursor-pointer select-none' : ''}
      onClick={() => {
        if (field === 'actions') return;
        setSort((prev) =>
          prev.field === field
            ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
            : { field, dir: 'asc' }
        );
      }}
    >
      {label}
    </TableHead>
  );

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Plans</h1>
          <div className="text-sm text-muted-foreground">
            {loading ? 'Loading…' : `Showing ${displayed.length} of ${items.length}`}
          </div>
          {listSource && (
            <div className="text-xs text-muted-foreground">
              Source: <code className="rounded bg-muted px-1 py-0.5">{listSource}</code>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading || saving}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openCreate} disabled={saving}>
            <Plus className="mr-2 h-4 w-4" />
            New Plan
          </Button>
        </div>
      </div>

      {/* Counters */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-muted-foreground">Total plans</div>
          <div className="text-2xl font-semibold">{stats.total}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-muted-foreground">Active (Sales On)</div>
          <div className="text-2xl font-semibold">{stats.active}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-muted-foreground">Suspended (Sales Off)</div>
          <div className="text-2xl font-semibold">{stats.suspended}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full md:w-[360px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, price, duration…"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <select
          className="border rounded-md px-3 py-2 bg-white text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active (Sales On)</option>
          <option value="SUSPENDED">Suspended (Sales Off)</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              {head('Name', 'name')}
              {head('Price', 'price')}
              {head('Duration', 'durationInDays')}
              {head('Listings', 'totalListings')}
              {head('Featured', 'featuredListings')}
              {head('Status', 'isActive')}
              {head('Actions', 'actions')}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : displayed.length ? (
              displayed.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{moneyKES(p.price)}</TableCell>
                  <TableCell className="whitespace-nowrap">{p.durationInDays} days</TableCell>
                  <TableCell>{p.totalListings}</TableCell>
                  <TableCell>{p.featuredListings}</TableCell>
                  <TableCell><StatusPill isActive={p.isActive} /></TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)} disabled={saving}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" disabled={saving}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          {p.isActive ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                                  <PauseCircle className="mr-2 h-4 w-4" />
                                  Suspend (Sales Off)
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Suspend this plan?</AlertDialogTitle>
                                  <AlertDialogDesc>
                                    It will be hidden from new subscribers, but current subscriptions remain valid.
                                  </AlertDialogDesc>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => doSuspend(p)}>Suspend</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                                  <PlayCircle className="mr-2 h-4 w-4" />
                                  Resume (Sales On)
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Resume this plan?</AlertDialogTitle>
                                  <AlertDialogDesc>
                                    It will become visible again to new subscribers.
                                  </AlertDialogDesc>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => doResume(p)}>Resume</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}

                          <DropdownMenuSeparator />

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="cursor-pointer text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
                                <AlertDialogDesc>
                                  If it has active subscriptions, it cannot be deleted and will be suspended instead.
                                </AlertDialogDesc>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => doDelete(p)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <DropdownMenuSeparator />

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                                <Power className="mr-2 h-4 w-4" />
                                Strict Toggle
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Strict toggle?</AlertDialogTitle>
                                <AlertDialogDesc>
                                  Deactivation is blocked if there are active subscriptions (by design).
                                </AlertDialogDesc>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => doStrictToggle(p)}>Toggle</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No plans match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create new plan</DialogTitle>
            <DialogDescription>
              This plan will be available to new subscribers immediately (Sales On).
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 space-y-1">
              <Label>Plan name</Label>
              <Input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="e.g. Starter" />
            </div>

            <div className="space-y-1">
              <Label>Price (KES)</Label>
              <Input type="number" value={String(fPrice)} onChange={(e) => setFPrice(Number(e.target.value || 0))} />
            </div>

            <div className="space-y-1">
              <Label>Duration (days)</Label>
              <Input type="number" value={String(fDuration)} onChange={(e) => setFDuration(Number(e.target.value || 0))} />
            </div>

            <div className="space-y-1">
              <Label>Total listings quota</Label>
              <Input type="number" value={String(fTotal)} onChange={(e) => setFTotal(Number(e.target.value || 0))} />
            </div>

            <div className="space-y-1">
              <Label>Featured listings quota</Label>
              <Input type="number" value={String(fFeatured)} onChange={(e) => setFFeatured(Number(e.target.value || 0))} />
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label>Reason (optional)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional admin note" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={doCreate} disabled={saving}>
              {saving ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit plan</DialogTitle>
            <DialogDescription>
              Changes apply globally (DB is the source of truth).
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 space-y-1">
              <Label>Plan name</Label>
              <Input value={fName} onChange={(e) => setFName(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Price (KES)</Label>
              <Input type="number" value={String(fPrice)} onChange={(e) => setFPrice(Number(e.target.value || 0))} />
            </div>

            <div className="space-y-1">
              <Label>Duration (days)</Label>
              <Input type="number" value={String(fDuration)} onChange={(e) => setFDuration(Number(e.target.value || 0))} />
            </div>

            <div className="space-y-1">
              <Label>Total listings quota</Label>
              <Input type="number" value={String(fTotal)} onChange={(e) => setFTotal(Number(e.target.value || 0))} />
            </div>

            <div className="space-y-1">
              <Label>Featured listings quota</Label>
              <Input type="number" value={String(fFeatured)} onChange={(e) => setFFeatured(Number(e.target.value || 0))} />
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label>Reason (optional)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={doUpdate} disabled={saving || !editing}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}