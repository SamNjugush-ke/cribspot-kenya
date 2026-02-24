"use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/auth/Guard";
import { apiGet, apiPatch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Role = "SUPER_ADMIN" | "ADMIN" | "LISTER" | "RENTER" | "AGENT" | "EDITOR";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isBanned?: boolean;
  createdAt?: string;
};

const ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "LISTER", "RENTER", "AGENT", "EDITOR"];

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
    return items.filter((u) => {
      const text = `${u.name ?? ""} ${u.email} ${u.role}`.toLowerCase();
      const okQ = !needle || text.includes(needle);
      const okRole = roleFilter === "ALL" || u.role === roleFilter;
      const banned = !!u.isBanned;
      const okBan =
        banFilter === "ALL" || (banFilter === "BANNED" ? banned : !banned);
      return okQ && okRole && okBan;
    });
  }, [items, q, roleFilter, banFilter]);

  async function toggleBan(u: UserRow) {
    try {
      await apiPatch(`/admin/users/${u.id}/ban`, {
        isBanned: !u.isBanned,
      } as any);
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to update user");
    }
  }

  async function changeRole(u: UserRow, nextRole: Role) {
    if (nextRole === u.role) return;
    try {
      await apiPatch(`/admin/users/${u.id}/role`, { role: nextRole } as any);
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to change role");
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <div className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `Total: ${items.length}`}
          </div>
          {err && <div className="text-sm text-red-600">{err}</div>}
        </div>

        <Button variant="outline" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

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
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : displayed.length ? (
              displayed.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name || "—"}</TableCell>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>
                    <select
                      className="border rounded px-2 py-1.5 text-sm"
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
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
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className={u.isBanned ? "border-green-300 text-green-700" : "border-red-300 text-red-700"}
                        onClick={() => toggleBan(u)}
                      >
                        {u.isBanned ? "Unban" : "Ban"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No users match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
