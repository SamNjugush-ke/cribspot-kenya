"use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/auth/Guard";
import { apiGet, apiPatch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ShieldBan, UserCheck, Users } from "lucide-react";

type Role = "LISTER" | "RENTER" | "AGENT" | "EDITOR";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: Role | string;
  isBanned?: boolean;
  createdAt?: string;
};

const ROLES: Role[] = ["LISTER", "RENTER", "AGENT", "EDITOR"];

function fmtDate(v?: string) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return "—";
  }
}

export default function AdminUsersPage() {
  return (
    <Guard allowed={["ADMIN", "SUPER_ADMIN"]}>
      <AdminUsersInner />
    </Guard>
  );
}

function AdminUsersInner() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const [banFilter, setBanFilter] = useState<"ALL" | "BANNED" | "ACTIVE">("ALL");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [target, setTarget] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiGet<any>("/admin/users");
      const data = (res as any)?.data ?? (res as any)?.json ?? (res as any);
      const arr: UserRow[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.users)
        ? data.users
        : [];
      setItems(arr);
    } catch (e: any) {
      setItems([]);
      setErr(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const displayed = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((u) => ["ADMIN", "SUPER_ADMIN"].indexOf(String(u.role).toUpperCase()) === -1)
      .filter((u) => {
        const text = `${u.name ?? ""} ${u.email} ${u.role}`.toLowerCase();
        const okQ = !needle || text.includes(needle);
        const okRole = roleFilter === "ALL" || u.role === roleFilter;
        const banned = !!u.isBanned;
        const okBan = banFilter === "ALL" || (banFilter === "BANNED" ? banned : !banned);
        return okQ && okRole && okBan;
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [items, q, roleFilter, banFilter]);

  const counts = useMemo(() => {
    const filtered = items.filter((u) => ["ADMIN", "SUPER_ADMIN"].indexOf(String(u.role).toUpperCase()) === -1);
    return {
      total: filtered.length,
      banned: filtered.filter((u) => u.isBanned).length,
      active: filtered.filter((u) => !u.isBanned).length,
    };
  }, [items]);

  function askToggleBan(u: UserRow) {
    setTarget(u);
    setConfirmOpen(true);
  }

  async function toggleBan() {
    if (!target) return;
    setBusy(true);
    try {
      const res = await apiPatch(`/admin/users/${target.id}/ban`, { isBanned: !target.isBanned } as any);
      if (!res.ok) throw new Error((res.data as any)?.message || res.error || "Failed to update user");
      setConfirmOpen(false);
      setTarget(null);
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to update user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Users</h1>
            <p className="text-sm text-muted-foreground mt-1">Admins cannot view fellow admins here, which saves both clutter and office politics.</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>Refresh</Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border p-4"><div className="text-sm text-muted-foreground">Managed accounts</div><div className="mt-1 text-3xl font-bold">{counts.total}</div></div>
          <div className="rounded-2xl border p-4"><div className="text-sm text-muted-foreground">Active accounts</div><div className="mt-1 text-3xl font-bold">{counts.active}</div></div>
          <div className="rounded-2xl border p-4"><div className="text-sm text-muted-foreground">Banned accounts</div><div className="mt-1 text-3xl font-bold">{counts.banned}</div></div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name, email, role..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <select className="border rounded-xl px-3 py-2 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
            <option value="ALL">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>

          <select className="border rounded-xl px-3 py-2 text-sm" value={banFilter} onChange={(e) => setBanFilter(e.target.value as any)}>
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="BANNED">Banned</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border bg-white shadow-sm ring-1 ring-black/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : displayed.length ? (
              displayed.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700"><Users className="h-4 w-4" /></div>
                      <div>
                        <div className="font-medium">{u.name || "Unnamed user"}</div>
                        <div className="text-sm text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                  <TableCell>
                    {u.isBanned ? (
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Banned</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDate(u.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className={u.isBanned ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}
                        onClick={() => askToggleBan(u)}
                      >
                        {u.isBanned ? <UserCheck className="mr-2 h-4 w-4" /> : <ShieldBan className="mr-2 h-4 w-4" />}
                        {u.isBanned ? "Unban" : "Ban"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No users match your filters.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {err ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div> : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target?.isBanned ? "Unban user" : "Ban user"}</DialogTitle>
            <DialogDescription>
              {target?.isBanned
                ? "This user will regain access to log in and use the site."
                : "You are about to ban this user. They will be unable to log in until unbanned."}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border bg-slate-50 p-4 text-sm">
            <div className="font-medium">{target?.name || "Unnamed user"}</div>
            <div className="text-muted-foreground">{target?.email}</div>
            <div className="mt-2">Role: <span className="font-medium">{target?.role}</span></div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={toggleBan} disabled={busy} className={target?.isBanned ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}>
              {busy ? (target?.isBanned ? "Unbanning..." : "Banning...") : target?.isBanned ? "Confirm Unban" : "Confirm Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
