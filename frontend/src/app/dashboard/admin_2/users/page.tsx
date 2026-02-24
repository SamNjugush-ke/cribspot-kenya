'use client';

import { useEffect, useMemo, useState } from 'react';
import Guard from '@/components/auth/Guard';
import RequirePermission from '@/components/super/RequirePermission';
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
import { toast } from 'sonner';

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

export default function AdminUsersPage() {
  return (
    <Guard allowed={['ADMIN', 'SUPER_ADMIN']}>
      <RequirePermission anyOf={['MANAGE_USERS']}>
        <UsersInner />
      </RequirePermission>
    </Guard>
  );
}

function UsersInner() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL');
  const [banFilter, setBanFilter] = useState<'ALL' | 'BANNED' | 'ACTIVE'>('ALL');

  const [createOpen, setCreateOpen] = useState(false);
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cRole, setCRole] = useState<Role>('LISTER');
  const [cPassword, setCPassword] = useState('');

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
      const json = await apiFetch<any>('/admin/users');
      const arr: UserRow[] = Array.isArray(json) ? json : (json?.items || json?.users || []);
      setItems(arr);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to load users');
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
      const okBan = banFilter === 'ALL' || (banFilter === 'BANNED' ? banned : !banned);
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
      toast.error(e?.message || 'Action failed');
    } finally {
      setConfirmBusy(false);
    }
  }

  async function createUser() {
    const name = cName.trim();
    const email = cEmail.trim().toLowerCase();
    const password = cPassword;

    if (!email || !password) {
      toast.error('Email + password are required');
      return;
    }

    try {
      await apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ name: name || undefined, email, role: cRole, password }),
      });
      setCreateOpen(false);
      setCName('');
      setCEmail('');
      setCRole('LISTER');
      setCPassword('');
      toast.success('User created');
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to create user');
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
        await apiFetch(`/admin/users/${u.id}/ban`, {
          method: 'PATCH',
          body: JSON.stringify({ reason: confirmReason || undefined }),
        });
        toast.success(next ? 'User banned' : 'User unbanned');
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
        await apiFetch(`/admin/users/${u.id}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role: nextRole, reason: confirmReason || undefined }),
        });
        toast.success('Role updated');
        await load();
      },
      reasonPlaceholder: 'Reason (recommended)',
    });
  }

  function askResetPassword(u: UserRow) {
    openConfirm({
      title: 'Reset password',
      body: (
        <div className="text-sm text-gray-700 space-y-2">
          <div>
            You’re about to reset password for <b>{u.email}</b>.
          </div>
          <div className="text-xs text-gray-500">
            This triggers your admin reset endpoint (and copies token/link if the backend returns one).
          </div>
        </div>
      ),
      action: async () => {
        const candidates = [
          `/admin/users/${u.id}/password/reset`,
          `/admin/users/${u.id}/password-reset`,
          `/admin/users/${u.id}/reset-password`,
          `/admin/users/${u.id}/password`,
        ];

        let lastErr: any = null;
        for (const path of candidates) {
          try {
            const res: any = await apiFetch(path, {
              method: 'POST',
              body: JSON.stringify({ reason: confirmReason || undefined }),
            });

            const token = res?.token || res?.resetToken || res?.data?.token;
            const link = res?.link || res?.resetLink || res?.data?.link;

            if (link) {
              await navigator.clipboard.writeText(String(link));
              toast.success('Reset link copied to clipboard');
            } else if (token) {
              await navigator.clipboard.writeText(String(token));
              toast.success('Reset token copied to clipboard');
            } else {
              toast.success('Password reset triggered');
            }
            return;
          } catch (e: any) {
            lastErr = e;
            if (String(e?.message || '').includes('(404)')) continue;
          }
        }
        throw lastErr || new Error('No reset endpoint matched');
      },
      reasonPlaceholder: 'Reason (recommended)',
    });
  }

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <div className="text-sm text-gray-600">{loading ? 'Loading…' : `Total: ${items.length}`}</div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>

          <Button className="bg-brand-blue text-white" onClick={() => setCreateOpen(true)}>
            New User
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name/email/role…"
          className="w-72"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select className="border rounded px-2 py-2" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
          <option value="ALL">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select className="border rounded px-2 py-2" value={banFilter} onChange={(e) => setBanFilter(e.target.value as any)}>
          <option value="ALL">All</option>
          <option value="ACTIVE">Active</option>
          <option value="BANNED">Banned</option>
        </select>
      </div>

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
                        <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs">BANNED</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs">ACTIVE</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex justify-end gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => askResetPassword(u)}>
                          Reset Password
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
              <select className="border rounded px-2 py-2 w-full" value={cRole} onChange={(e) => setCRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-500 mt-1">Primary role</div>
            </div>

            <div>
              <Input placeholder="Password" type="password" value={cPassword} onChange={(e) => setCPassword(e.target.value)} />
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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
          </DialogHeader>

          {confirmBody}

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Reason</div>
            <Input placeholder={confirmReasonPlaceholder} value={confirmReason} onChange={(e) => setConfirmReason(e.target.value)} />
            <div className="text-xs text-gray-500">(Captured for audit/debug; backend may ignore it until you enforce everywhere.)</div>
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
