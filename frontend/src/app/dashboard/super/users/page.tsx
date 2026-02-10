// src/app/dashboard/super/users/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/auth/Guard';
import { apiFetch } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'LISTER' | 'RENTER' | 'AGENT' | 'EDITOR';

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isBanned?: boolean;
  createdAt?: string;
};

const ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'LISTER', 'RENTER', 'AGENT', 'EDITOR'];

function clearImpersonationKeys() {
  // Support both conventions used across the project
  localStorage.removeItem('rk_token_impersonator');
  localStorage.removeItem('rk_impersonator_user');
  localStorage.removeItem('rk_impersonated_user');

  localStorage.removeItem('rk_impersonator_token');
  localStorage.removeItem('rk_impersonating');
}

export default function UsersPage() {
  return (
    <Guard allowed={['SUPER_ADMIN']}>
      <UsersInner />
    </Guard>
  );
}

function UsersInner() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL');
  const [banFilter, setBanFilter] = useState<'ALL' | 'BANNED' | 'ACTIVE'>('ALL');

  // create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cRole, setCRole] = useState<Role>('LISTER');
  const [cPassword, setCPassword] = useState('');

  // confirm modal (ban / impersonate / role change)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmBody, setConfirmBody] = useState<React.ReactNode>(null);
  const [confirmReason, setConfirmReason] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | (() => Promise<void>)>(null);
  const [confirmReasonPlaceholder, setConfirmReasonPlaceholder] = useState('Short reason (logged/audited)');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const json = await apiFetch<any>('/api/admin/users');
      const arr: UserRow[] = Array.isArray(json) ? json : (json?.items || json?.users || []);
      setItems(arr);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to load users');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const displayed = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((u) => {
      const text = `${u.name ?? ''} ${u.email} ${u.role}`.toLowerCase();
      const okQ = !needle || text.includes(needle);
      const okRole = roleFilter === 'ALL' || u.role === roleFilter;
      const banned = !!u.isBanned;
      const okBan =
        banFilter === 'ALL' ||
        (banFilter === 'BANNED' ? banned : !banned);

      return okQ && okRole && okBan;
    });
  }, [items, q, roleFilter, banFilter]);

  function openConfirm(opts: {
    title: string;
    body?: React.ReactNode;
    action: () => Promise<void>;
    reasonPlaceholder?: string;
  }) {
    setConfirmTitle(opts.title);
    setConfirmBody(opts.body ?? null);
    setConfirmAction(() => opts.action);
    setConfirmReason('');
    setConfirmReasonPlaceholder(opts.reasonPlaceholder || 'Short reason (logged/audited)');
    setConfirmOpen(true);
  }

  async function runConfirm() {
    if (!confirmAction) return;
    try {
      setConfirmBusy(true);
      await confirmAction();
      setConfirmOpen(false);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Action failed');
    } finally {
      setConfirmBusy(false);
    }
  }

  async function createUser() {
    const name = cName.trim();
    const email = cEmail.trim().toLowerCase();
    const password = cPassword;

    if (!email || !password) {
      alert('Email + password are required');
      return;
    }

    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ name: name || undefined, email, role: cRole, password }),
      });
      setCreateOpen(false);
      setCName('');
      setCEmail('');
      setCRole('LISTER');
      setCPassword('');
      await load();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to create user');
    }
  }

  function askToggleBan(u: UserRow) {
    const next = !u.isBanned;
    openConfirm({
      title: next ? 'Ban user' : 'Unban user',
      body: (
        <div className="text-sm text-gray-700 space-y-1">
          <div>
            <b>{u.email}</b>
          </div>
          <div>{next ? 'They will be blocked from using the platform.' : 'They will regain access.'}</div>
        </div>
      ),
      action: async () => {
        await apiFetch(`/api/admin/users/${u.id}/ban`, {
          method: 'PATCH',
          body: JSON.stringify({ reason: confirmReason || undefined }),
        });
        await load();
      },
      reasonPlaceholder: next ? 'Reason for ban (recommended)' : 'Reason (optional)',
    });
  }

  function askChangeRole(u: UserRow, nextRole: Role) {
    if (nextRole === u.role) return;

    openConfirm({
      title: 'Change user role',
      body: (
        <div className="text-sm text-gray-700 space-y-1">
          <div>
            <b>{u.email}</b>
          </div>
          <div>
            {u.role} → <b>{nextRole}</b>
          </div>
        </div>
      ),
      action: async () => {
        await apiFetch(`/api/admin/users/${u.id}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role: nextRole, reason: confirmReason || undefined }),
        });
        await load();
      },
      reasonPlaceholder: 'Reason (recommended)',
    });
  }

  function askImpersonate(u: UserRow) {
    openConfirm({
      title: 'Impersonate user',
      body: (
        <div className="text-sm text-gray-700 space-y-2">
          <div>
            You’re about to impersonate <b>{u.email}</b>.
          </div>
          <div className="text-xs text-gray-500">
            This should be used for support/debug. It will be audited server-side.
          </div>
        </div>
      ),
      action: async () => {
        const res = await apiFetch<{ token: string }>(`/api/admin/users/${u.id}/impersonate`, {
          method: 'POST',
          body: JSON.stringify({ reason: confirmReason || undefined }),
        });

        if (!res?.token) throw new Error('No token returned from impersonation');

        // 1) Preserve original token (impersonator) if not already stored
        const currentToken = localStorage.getItem('rk_token');
        if (currentToken) {
          // If already impersonating, we don't overwrite the original; keep the first one.
          if (!localStorage.getItem('rk_token_impersonator') && !localStorage.getItem('rk_impersonator_token')) {
            localStorage.setItem('rk_token_impersonator', currentToken);
            localStorage.setItem('rk_impersonator_token', currentToken);
          }
        }

        // 2) Preserve impersonator identity (best-effort)
        const rawMe = localStorage.getItem('rk_user');
        if (rawMe) {
          if (!localStorage.getItem('rk_impersonator_user')) localStorage.setItem('rk_impersonator_user', rawMe);
          localStorage.setItem('rk_impersonating', '1');
        }

        // 3) Store impersonated identity (best-effort for UI/banner)
        localStorage.setItem(
          'rk_impersonated_user',
          JSON.stringify({ id: u.id, email: u.email, name: u.name, role: u.role })
        );

        // 4) Swap token -> now you are impersonated
        localStorage.setItem('rk_token', res.token);

        // 5) Force re-hydration of /me (your AuthBootstrap will repopulate rk_user)
        localStorage.removeItem('rk_user');

        // 6) Activity baseline (avoid immediate idle logout)
        localStorage.setItem('rk_last_activity', String(Date.now()));

        // 7) Go to dashboard; header will show impersonation banner via rk_token_impersonator
        window.location.href = '/dashboard';
      },
      reasonPlaceholder: 'Reason for impersonation (recommended)',
    });
  }

  function askStopImpersonation() {
    // Optional helper if you ever want a stop button here too
    openConfirm({
      title: 'Stop impersonating',
      body: (
        <div className="text-sm text-gray-700 space-y-2">
          <div>You’re about to revert back to your original account.</div>
        </div>
      ),
      action: async () => {
        const original =
          localStorage.getItem('rk_token_impersonator') ||
          localStorage.getItem('rk_impersonator_token');

        if (!original) {
          clearImpersonationKeys();
          alert('No original token found (you may not be impersonating).');
          return;
        }

        localStorage.setItem('rk_token', original);
        localStorage.removeItem('rk_user');
        clearImpersonationKeys();
        localStorage.setItem('rk_last_activity', String(Date.now()));
        window.location.href = '/dashboard';
      },
      reasonPlaceholder: 'Reason (optional)',
    });
  }

  const isImpersonating = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return !!(localStorage.getItem('rk_token_impersonator') || localStorage.getItem('rk_impersonator_token'));
  }, []);

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <div className="text-sm text-gray-600">
            {loading ? 'Loading…' : `Total: ${items.length}`}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>

          {isImpersonating && (
            <Button variant="outline" className="border-red-300 text-red-700" onClick={askStopImpersonation}>
              Stop Impersonating
            </Button>
          )}

          <Button className="bg-brand-blue text-white" onClick={() => setCreateOpen(true)}>
            New User
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name/email/role…"
          className="w-72"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select
          className="border rounded px-2 py-2"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
        >
          <option value="ALL">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select
          className="border rounded px-2 py-2"
          value={banFilter}
          onChange={(e) => setBanFilter(e.target.value as any)}
        >
          <option value="ALL">All</option>
          <option value="ACTIVE">Active</option>
          <option value="BANNED">Banned</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-gray-500">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (
              <>
                {displayed.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.name || '—'}</TableCell>
                    <TableCell className="font-medium">{u.email}</TableCell>

                    <TableCell>
                      <select
                        className="border rounded px-2 py-1.5 text-sm"
                        value={u.role}
                        onChange={(e) => askChangeRole(u, e.target.value as Role)}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </TableCell>

                    <TableCell>
                      {u.isBanned ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs">
                          BANNED
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs">
                          ACTIVE
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex justify-end gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => askImpersonate(u)}>
                          Impersonate
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className={u.isBanned ? 'border-green-300 text-green-700' : 'border-red-300 text-red-700'}
                          onClick={() => askToggleBan(u)}
                        >
                          {u.isBanned ? 'Unban' : 'Ban'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {!displayed.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-gray-500">
                      No users match your filters
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New User</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Input placeholder="Name (optional)" value={cName} onChange={(e) => setCName(e.target.value)} />
            </div>

            <div className="md:col-span-2">
              <Input placeholder="Email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
            </div>

            <div>
              <select
                className="border rounded px-2 py-2 w-full"
                value={cRole}
                onChange={(e) => setCRole(e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-500 mt-1">Primary role</div>
            </div>

            <div>
              <Input
                placeholder="Password"
                type="password"
                value={cPassword}
                onChange={(e) => setCPassword(e.target.value)}
              />
              <div className="text-xs text-gray-500 mt-1">Temporary password</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-brand-blue text-white" onClick={createUser}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
          </DialogHeader>

          {confirmBody}

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Reason</div>
            <Input
              placeholder={confirmReasonPlaceholder}
              value={confirmReason}
              onChange={(e) => setConfirmReason(e.target.value)}
            />
            <div className="text-xs text-gray-500">
              (Captured for audit/debug; backend may ignore it until you enforce everywhere.)
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={confirmBusy}>
              Cancel
            </Button>
            <Button className="bg-brand-blue text-white" onClick={runConfirm} disabled={confirmBusy}>
              {confirmBusy ? 'Working…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
