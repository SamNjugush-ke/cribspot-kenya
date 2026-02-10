'use client';

import { useEffect, useState } from 'react';
import Guard from '@/components/auth/Guard';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { API_BASE } from '@/lib/api';
import { Role } from '@/types/user';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Mail } from 'lucide-react';

type User = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isBanned: boolean;
};

export default function UsersPage() {
  return (
    <Guard allowed={['SUPER_ADMIN']}>
      <UsersInner />
    </Guard>
  );
}

function UsersInner() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [edited, setEdited] = useState<Record<string, Partial<User>>>({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sort, setSort] = useState<{ field: keyof User; dir: 'asc' | 'desc' } | null>(null);

  // Create user modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'RENTER', password: '' });

  // Message modal
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgTarget, setMsgTarget] = useState<User | null>(null);
  const [msgText, setMsgText] = useState('');

  // Impersonation indicator
  const impersonating = typeof window !== 'undefined' ? localStorage.getItem('rk_impersonating') : null;

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const token = localStorage.getItem('rk_token');
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setUsers(json || []);
    } finally {
      setLoading(false);
    }
  }

  function markEdited(userId: string, changes: Partial<User>) {
    setEdited((prev) => ({ ...prev, [userId]: { ...prev[userId], ...changes } }));
  }

  async function saveChanges() {
    const token = localStorage.getItem('rk_token');
    await Promise.all(
      Object.entries(edited).map(([id, changes]) =>
        fetch(`${API_BASE}/api/admin/users/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(changes),
        })
      )
    );
    setEdited({});
    await loadUsers();
  }

  async function impersonate(user: User) {
    const token = localStorage.getItem('rk_token');
    const res = await fetch(`${API_BASE}/api/admin/users/${user.id}/impersonate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      alert('Failed to impersonate user');
      return;
    }
    const { token: newToken } = await res.json();
    localStorage.setItem('rk_impersonating', user.email);
    localStorage.setItem('rk_token', newToken);
    window.location.href = `/dashboard/${user.role.toLowerCase()}`;
  }

  async function stopImpersonate() {
    const token = localStorage.getItem('rk_token');
    const res = await fetch(`${API_BASE}/api/admin/users/impersonate/return`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const { token: adminToken } = await res.json();
    localStorage.removeItem('rk_impersonating');
    localStorage.setItem('rk_token', adminToken);
    window.location.href = '/dashboard/super/users';
  }

  async function createUser() {
    const token = localStorage.getItem('rk_token');
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newUser),
    });
    if (!res.ok) {
      alert('Failed to create user');
      return;
    }
    setCreateOpen(false);
    setNewUser({ name: '', email: '', role: 'RENTER', password: '' });
    await loadUsers();
  }

  async function sendMessage() {
    const token = localStorage.getItem('rk_token');
    await fetch(`${API_BASE}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        to: msgTarget?.id,
        body: msgText,
        from: 'ADMIN',
      }),
    });
    setMsgOpen(false);
    setMsgText('');
  }

  let displayed = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name || '').toLowerCase().includes(search.toLowerCase())
  );
  if (roleFilter !== 'ALL') displayed = displayed.filter((u) => u.role === roleFilter);
  if (statusFilter !== 'ALL') displayed = displayed.filter((u) => (u.isBanned ? 'BANNED' : 'ACTIVE') === statusFilter);
  if (sort) {
    displayed = [...displayed].sort((a, b) => {
      const v1 = a[sort.field] ?? '';
      const v2 = b[sort.field] ?? '';
      return sort.dir === 'asc'
        ? String(v1).localeCompare(String(v2))
        : String(v2).localeCompare(String(v1));
    });
  }

  return (
    <section className="space-y-6">
      {impersonating && (
        <div className="bg-red-600 text-white p-2 flex justify-between items-center">
          <span>Impersonating {impersonating}</span>
          <Button size="sm" onClick={stopImpersonate} variant="outline" className="bg-white text-red-600">
            Return
          </Button>
        </div>
      )}

      <h1 className="text-2xl font-bold">Users</h1>

      <div className="flex gap-2 items-center">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="ALL">All Roles</option>
          {['SUPER_ADMIN', 'ADMIN', 'LISTER', 'RENTER', 'AGENT', 'EDITOR'].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="BANNED">Banned</option>
        </select>
        <Button size="sm" onClick={() => setCreateOpen(true)}>+ Create User</Button>
        {Object.keys(edited).length > 0 && (
          <Button size="sm" onClick={saveChanges} className="bg-green-600 text-white">Save Changes</Button>
        )}
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {['Name', 'Email', 'Role', 'Status', 'Actions'].map((col) => (
                  <TableHead
                    key={col}
                    className="cursor-pointer"
                    onClick={() => {
                      if (col === 'Actions') return;
                      const field = col.toLowerCase() as keyof User;
                      setSort((prev) =>
                        prev && prev.field === field
                          ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                          : { field, dir: 'asc' }
                      );
                    }}
                  >
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name || '—'}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <select
                      value={edited[u.id]?.role ?? u.role}
                      onChange={(e) => markEdited(u.id, { role: e.target.value as Role })}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      {['SUPER_ADMIN', 'ADMIN', 'LISTER', 'RENTER', 'AGENT', 'EDITOR'].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={edited[u.id]?.isBanned ?? u.isBanned ? 'outline' : 'destructive'}
                      onClick={() => markEdited(u.id, { isBanned: !(edited[u.id]?.isBanned ?? u.isBanned) })}
                    >
                      {edited[u.id]?.isBanned ?? u.isBanned ? 'Banned' : 'Active'}
                    </Button>
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => impersonate(u)}>Impersonate</Button>
                    <Button size="sm" variant="outline" onClick={() => { setMsgTarget(u); setMsgOpen(true); }}>
                      <Mail className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!displayed.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Input placeholder="Name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
            <Input placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
              {['SUPER_ADMIN', 'ADMIN', 'LISTER', 'RENTER', 'AGENT', 'EDITOR'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <Input placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
            <Button onClick={createUser} className="bg-blue-600 text-white">Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Message {msgTarget?.email}</DialogTitle></DialogHeader>
          <Textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} placeholder="Write your message..." />
          <Button onClick={sendMessage} className="bg-blue-600 text-white">Send</Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}