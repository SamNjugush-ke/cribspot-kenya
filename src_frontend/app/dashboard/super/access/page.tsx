// frontend/src/app/dashboard/super/access/page.tsx
'use client';

import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/auth/Guard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import RoleBadge from "@/components/rbac/RoleBadge";
import PermGroup from "@/components/rbac/PermGroup";

import type { Role, Permission, RoleDefinition, UserLite } from "@/types/rbac";
import {
  PERMISSION_GROUPS,
  getRoleDefs,
  createRoleDef,
  updateRoleDef,
  deleteRoleDef,
  getUsers,
  setPrimaryRole,
  attachRoleDefToUser,
  getUserOverrides,
  setUserOverrides,
} from "@/lib/rbac";

import { adminFetch } from "@/lib/adminFetch";

type EffectiveRbac = {
  userId: string;
  role?: Role | string;
  roleDefs?: string[];
  allow?: Permission[];
  deny?: Permission[];
  effectivePermissions?: Permission[];
};

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

export default function AccessControl() {
  return (
    <Guard allowed={["SUPER_ADMIN"]}>
      <AccessInner />
    </Guard>
  );
}

function AccessInner() {
  // Roles tab
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [roleQuery, setRoleQuery] = useState("");
  const [activeRole, setActiveRole] = useState<RoleDefinition | null>(null);
  const [rolePerms, setRolePerms] = useState<Permission[]>([]);
  const [roleDirty, setRoleDirty] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleSavedAt, setRoleSavedAt] = useState<number | null>(null);

  // Create role dialog
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Users tab
  const [users, setUsers] = useState<UserLite[]>([]);
  const [userQ, setUserQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | string | "ALL">("ALL");
  const [usersLoading, setUsersLoading] = useState(false);

  // Effective RBAC cache for UI (shows attached role defs)
  const [effByUser, setEffByUser] = useState<Record<string, EffectiveRbac | null>>({});

  // Overrides dialog
  const [ovOpen, setOvOpen] = useState(false);
  const [ovUser, setOvUser] = useState<UserLite | null>(null);
  const [ovAllow, setOvAllow] = useState<Permission[]>([]);
  const [ovDeny, setOvDeny] = useState<Permission[]>([]);
  const [ovEffectiveBase, setOvEffectiveBase] = useState<Permission[]>([]);
  const [ovDirty, setOvDirty] = useState(false);
  const [ovSaving, setOvSaving] = useState(false);
  const [ovSavedAt, setOvSavedAt] = useState<number | null>(null);

  // Attach RoleDef dialog
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachUser, setAttachUser] = useState<UserLite | null>(null);
  const [attachRoleName, setAttachRoleName] = useState<string>("");
  const [attachSaving, setAttachSaving] = useState(false);
  const [attachSavedAt, setAttachSavedAt] = useState<number | null>(null);

  // Change primary role dialog
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeUser, setChangeUser] = useState<UserLite | null>(null);
  const [changeRoleName, setChangeRoleName] = useState<string>("");
  const [changeSaving, setChangeSaving] = useState(false);
  const [changeSavedAt, setChangeSavedAt] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [r, u] = await Promise.all([safeGetRoleDefs(), safeGetUsers()]);
      setRoles(r);
      setUsers(u);

      const ar = r.find((x) => x.name === "ADMIN") || r[0] || null;
      setActiveRole(ar);
      setRolePerms(ar?.permissions || []);
      setRoleDirty(false);

      // Prefetch effective for first visible users
      u.slice(0, 25).forEach((x) => void loadEffective(x.id));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function safeGetRoleDefs(): Promise<RoleDefinition[]> {
    const rRaw = await getRoleDefs();
    const r: RoleDefinition[] =
      Array.isArray(rRaw) ? rRaw :
      Array.isArray((rRaw as any)?.data) ? (rRaw as any).data :
      Array.isArray((rRaw as any)?.roles) ? (rRaw as any).roles :
      Array.isArray((rRaw as any)?.items) ? (rRaw as any).items :
      [];
    return [...r].sort((a, b) => a.name.localeCompare(b.name));
  }

  async function safeGetUsers(q?: string, role?: Role | string | "ALL"): Promise<UserLite[]> {
    const uRaw = await getUsers(q || undefined, role === "ALL" ? undefined : (role as any));
    const u: UserLite[] =
      Array.isArray(uRaw) ? uRaw :
      Array.isArray((uRaw as any)?.data) ? (uRaw as any).data :
      Array.isArray((uRaw as any)?.users) ? (uRaw as any).users :
      Array.isArray((uRaw as any)?.items) ? (uRaw as any).items :
      [];
    return u;
  }

  // ---------- Derived ----------
  const filteredRoles = useMemo(() => {
    const q = roleQuery.trim().toLowerCase();
    return roles.filter(r => !q || r.name.toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q));
  }, [roles, roleQuery]);

  const filteredUsers = useMemo(() => {
    const q = userQ.trim().toLowerCase();
    const base = users.filter(u => !q || ((u.name || "") + " " + u.email).toLowerCase().includes(q));
    return roleFilter === "ALL" ? base : base.filter(u => String(u.role) === String(roleFilter));
  }, [users, userQ, roleFilter]);

  const primaryRoleOptions = useMemo(() => {
    const set = new Set<string>();

    // Primary roles on users (real)
    for (const u of users) if (u?.role) set.add(String(u.role));

    // RoleDefs (new ones you create live here)
    for (const r of roles) if (r?.name) set.add(String(r.name));

    return ["ALL", ...Array.from(set).sort()];
  }, [users, roles]);

  const roleLocked = activeRole?.name === "SUPER_USER";

  // ---------- Effective RBAC cache ----------
  async function loadEffective(userId: string) {
    if (effByUser[userId] !== undefined) return effByUser[userId];
    try {
      const eff = await adminFetch<EffectiveRbac>(`/api/admin/rbac/effective/${userId}`);
      setEffByUser(prev => ({ ...prev, [userId]: eff }));
      return eff;
    } catch {
      setEffByUser(prev => ({ ...prev, [userId]: null }));
      return null;
    }
  }

  async function refreshEffective(userId: string) {
    setEffByUser(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    return loadEffective(userId);
  }

  useEffect(() => {
    // Prefetch effective for visible rows (avoid feeling "empty")
    filteredUsers.slice(0, 25).forEach((u) => { void loadEffective(u.id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredUsers.map(u => u.id).join("|")]);

  // ---------- Roles actions ----------
  const selectRole = (r: RoleDefinition) => {
    setActiveRole(r);
    setRolePerms(r.permissions || []);
    setRoleDirty(false);
    setRoleSavedAt(null);
  };

  const toggleRolePerm = (p: Permission) => {
    if (roleLocked) return;
    setRolePerms(arr => arr.includes(p) ? arr.filter(x => x !== p) : [...arr, p]);
    setRoleDirty(true);
  };

  const saveRole = async () => {
    if (!activeRole) return;
    if (roleLocked) return;

    setRoleSaving(true);
    try {
      const updated = await updateRoleDef(activeRole.name, {
        description: activeRole.description || "",
        permissions: rolePerms,
      });

      setRoles(arr => arr.map(r => r.name === activeRole.name ? updated : r));
      setActiveRole(updated);
      setRolePerms(updated.permissions || []);
      setRoleDirty(false);
      setRoleSavedAt(Date.now());

      const fresh = await safeGetRoleDefs();
      setRoles(fresh);
      const active = fresh.find(x => x.name === updated.name) || updated;
      setActiveRole(active);
      setRolePerms(active.permissions || []);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to save role");
    } finally {
      setRoleSaving(false);
    }
  };

  const createRole = async () => {
    const name = newName.trim().toUpperCase();
    if (!name) return;

    try {
      const created = await createRoleDef({
        name,
        description: newDesc.trim() || undefined,
        permissions: [],
      });

      const fresh = await safeGetRoleDefs();
      const merged = fresh.some(r => r.name === created.name)
        ? fresh
        : [...fresh, created].sort((a, b) => a.name.localeCompare(b.name));

      setRoles(merged);

      setCreating(false);
      setNewName("");
      setNewDesc("");

      const ar = merged.find(r => r.name === created.name) || created;
      setActiveRole(ar);
      setRolePerms(ar.permissions || []);
      setRoleDirty(false);
      setRoleSavedAt(null);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to create role");
    }
  };

  const doDeleteRole = async (name: string) => {
    if (name === "SUPER_ADMIN") return;
    const ok = confirm(`Delete role "${name}"? This cannot be undone.`);
    if (!ok) return;

    try {
      await deleteRoleDef(name);
      const fresh = (await safeGetRoleDefs()).filter(r => r.name !== name);
      setRoles(fresh);

      const next = fresh.find(r => r.name === "ADMIN") || fresh[0] || null;
      setActiveRole(next);
      setRolePerms(next?.permissions || []);
      setRoleDirty(false);
      setRoleSavedAt(null);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to delete role");
    }
  };

  // Seed default role definitions (no backend changes; uses existing createRoleDef)
  const seedDefaultRoles = async () => {
    try {
      const defaults = ["SUPER_ADMIN", "ADMIN", "EDITOR", "LISTER", "RENTER", "AGENT"];
      const existing = new Set(roles.map(r => r.name));

      for (const name of defaults) {
        if (!existing.has(name)) {
          await createRoleDef({ name, description: `${name} default role`, permissions: [] });
        }
      }

      const fresh = await safeGetRoleDefs();
      setRoles(fresh);

      const ar = fresh.find((x) => x.name === "ADMIN") || fresh[0] || null;
      setActiveRole(ar);
      setRolePerms(ar?.permissions || []);
      setRoleDirty(false);
      setRoleSavedAt(null);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to seed default roles");
    }
  };

  // ---------- Users actions ----------
  const refreshUsers = async () => {
    setUsersLoading(true);
    try {
      const u = await safeGetUsers(userQ || undefined, roleFilter);
      setUsers(u);
      // refresh effective cache for visible users
      u.slice(0, 25).forEach((x) => void refreshEffective(x.id));
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  };

  // ---------- Overrides: show EFFECTIVE permissions as checked ----------
  const openOverrides = async (u: UserLite) => {
    try {
      setOvUser(u);
      setOvDirty(false);
      setOvSavedAt(null);

      const o = await getUserOverrides(u.id);
      setOvAllow(Array.isArray(o?.allow) ? o.allow : []);
      setOvDeny(Array.isArray(o?.deny) ? o.deny : []);

      const eff = await adminFetch<EffectiveRbac>(`/api/admin/rbac/effective/${u.id}`);
      setOvEffectiveBase(Array.isArray(eff?.effectivePermissions) ? eff.effectivePermissions : []);

      setOvOpen(true);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to open overrides");
    }
  };

  const saveOverrides = async () => {
    if (!ovUser) return;
    setOvSaving(true);
    try {
      await setUserOverrides(ovUser.id, { allow: ovAllow, deny: ovDeny });
      setOvDirty(false);
      setOvSavedAt(Date.now());

      // Refresh effective baseline so next open reflects changes
      const eff = await adminFetch<EffectiveRbac>(`/api/admin/rbac/effective/${ovUser.id}`);
      setOvEffectiveBase(Array.isArray(eff?.effectivePermissions) ? eff.effectivePermissions : []);

      await refreshEffective(ovUser.id);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to save overrides");
    } finally {
      setOvSaving(false);
    }
  };

  const isEffective = (p: Permission) => {
    // effective = (base OR allow) AND NOT deny
    return (ovEffectiveBase.includes(p) || ovAllow.includes(p)) && !ovDeny.includes(p);
  };

  const toggleEffective = (p: Permission) => {
    const currentlyOn = isEffective(p);

    if (currentlyOn) {
      // Turning OFF:
      // - remove from allow if explicitly allowed
      // - otherwise deny it to override base
      setOvAllow(a => a.filter(x => x !== p));
      setOvDeny(d => d.includes(p) ? d : [...d, p]);
    } else {
      // Turning ON:
      // - remove deny
      // - if base doesn't include it, add allow
      setOvDeny(d => d.filter(x => x !== p));
      if (!ovEffectiveBase.includes(p)) {
        setOvAllow(a => a.includes(p) ? a : [...a, p]);
      }
    }

    setOvDirty(true);
  };

  // ---------- Attach RoleDef ----------
  const openAttach = (u: UserLite) => {
    setAttachUser(u);
    setAttachRoleName("");
    setAttachSavedAt(null);
    setAttachOpen(true);
  };

  const doAttach = async () => {
    if (!attachUser) return;
    const roleName = attachRoleName.trim();
    if (!roleName) {
      alert("Select a Role Definition to attach.");
      return;
    }

    setAttachSaving(true);
    try {
      await attachRoleDefToUser(attachUser.id, roleName);
      setAttachSavedAt(Date.now());
      await refreshEffective(attachUser.id);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to attach role definition");
    } finally {
      setAttachSaving(false);
    }
  };

  // ---------- Change primary role ----------
  const openChangeRole = (u: UserLite) => {
    setChangeUser(u);
    setChangeRoleName(String(u.role || ""));
    setChangeSavedAt(null);
    setChangeOpen(true);
  };

  const doChangeRole = async () => {
    if (!changeUser) return;
    const roleName = changeRoleName.trim();
    if (!roleName) return;

    setChangeSaving(true);
    try {
      await setPrimaryRole(changeUser.id, roleName);

      // update UI immediately
      setUsers(prev => prev.map(x => x.id === changeUser.id ? ({ ...x, role: roleName as any }) : x));
      setChangeSavedAt(Date.now());

      await refreshUsers();
      await refreshEffective(changeUser.id);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to change role");
    } finally {
      setChangeSaving(false);
    }
  };

  // ---------- UI ----------
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Access Control</h1>
          <p className="text-sm opacity-70">Manage Role Definitions, primary roles, role attachments, and per-user overrides.</p>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          {roleSavedAt && (
            <span className="text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              Saved
            </span>
          )}
          <Button variant="outline" onClick={() => setCreating(true)}>
            New Role
          </Button>
          <Button variant="outline" onClick={seedDefaultRoles}>
            Seed Default Roles
          </Button>
          <Button
            className="bg-brand-blue text-white"
            disabled={!activeRole || !roleDirty || roleSaving || roleLocked}
            onClick={saveRole}
          >
            {roleSaving ? "Saving..." : "Save Role Permissions"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        {/* ROLES TAB */}
        <TabsContent value="roles" className="mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="rounded-xl border bg-white p-4">
              <Label>Search roles</Label>
              <Input
                className="mt-1"
                value={roleQuery}
                onChange={(e) => setRoleQuery(e.target.value)}
                placeholder="e.g. EDITOR, REVIEWER..."
              />

              <div className="mt-3 text-xs opacity-70">
                {filteredRoles.length} role{filteredRoles.length === 1 ? "" : "s"}
              </div>

              <ul className="mt-2 space-y-1 max-h-[60vh] overflow-auto pr-1">
                {filteredRoles.map(r => (
                  <li key={r.name} className="flex items-center justify-between gap-2">
                    <button
                      className={cx(
                        "text-left flex-1 px-2 py-1 rounded-md hover:bg-brand-gray",
                        activeRole?.name === r.name && "bg-brand-gray"
                      )}
                      onClick={() => selectRole(r)}
                      title={r.description || r.name}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{r.name}</span>
                        <span className="text-[11px] opacity-60">{(r.permissions || []).length}</span>
                      </div>
                      {!!r.description && (
                        <div className="text-xs opacity-60 line-clamp-1">{r.description}</div>
                      )}
                    </button>

                    {r.name !== "SUPER_ADMIN" && (
                      <button className="text-xs text-red-600 hover:underline" onClick={() => doDeleteRole(r.name)}>
                        Delete
                      </button>
                    )}
                  </li>
                ))}

                {!filteredRoles.length && (
                  <li className="text-sm text-gray-500 py-6 text-center">No roles</li>
                )}
              </ul>
            </div>

            <div className="xl:col-span-2 rounded-xl border bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="font-semibold">
                  Role: <span className="font-mono">{activeRole?.name || "—"}</span>
                </div>

                {roleDirty && (
                  <span className="text-xs px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                    Unsaved changes
                  </span>
                )}
              </div>

              {roleLocked && (
                <div className="text-xs px-3 py-2 rounded-md border bg-amber-50 text-amber-800">
                  SUPER_USER is protected and cannot be edited.
                </div>
              )}

              <div className={cx("space-y-3", roleLocked && "opacity-60 pointer-events-none")}>
                {Object.entries(PERMISSION_GROUPS).map(([group, list]) => (
                  <PermGroup
                    key={group}
                    title={group}
                    items={list as Permission[]}
                    value={rolePerms}
                    onToggle={toggleRolePerm}
                  />
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  className="bg-brand-blue text-white"
                  disabled={!activeRole || !roleDirty || roleSaving || roleLocked}
                  onClick={saveRole}
                >
                  {roleSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users" className="mt-4">
          <div className="rounded-xl border bg-white p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Search users</Label>
                <Input value={userQ} onChange={(e) => setUserQ(e.target.value)} placeholder="name or email" />
              </div>

              <div>
                <Label>Primary role</Label>
                <select
                  className="rounded-md border px-3 py-2 w-full"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                >
                  {primaryRoleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={refreshUsers} disabled={usersLoading}>
                  {usersLoading ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredUsers.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>{u.name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{u.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <RoleBadge role={u.role as any} />
                          {(effByUser[u.id]?.roleDefs || []).map((rd) => (
                            <span
                              key={rd}
                              className="text-[11px] px-2 py-0.5 rounded-full border bg-white"
                              title="Attached Role Definition"
                            >
                              +{rd}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => openOverrides(u)}>
                            Overrides
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openChangeRole(u)}>
                            Change Role
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openAttach(u)}>
                            Attach RoleDef
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {!filteredUsers.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500 py-6">
                        No users
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Role Dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Role Definition</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. REVIEWER" />
              <div className="text-xs opacity-70 mt-1">Tip: use UPPERCASE role names.</div>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="optional" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button className="bg-brand-blue text-white" onClick={createRole}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overrides Dialog (effective permissions checked) */}
      <Dialog open={ovOpen} onOpenChange={(v) => { setOvOpen(v); if (!v) setOvDirty(false); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              User Overrides{ovUser ? ` — ${ovUser.email}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="text-xs opacity-70">
            Effective permissions currently: <span className="font-mono">{ovEffectiveBase.length}</span>
          </div>

          <div className="space-y-3 overflow-auto pr-1 max-h-[60vh]">
            {Object.entries(PERMISSION_GROUPS).map(([g, list]) => (
              <div key={g} className="rounded-md border p-3">
                <div className="text-sm font-medium mb-2">{g}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                  {(list as Permission[]).map(p => (
                    <label key={p} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isEffective(p)}
                        onChange={() => toggleEffective(p)}
                      />
                      <span className="font-mono text-[12px]">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {ovDirty && (
                <span className="text-xs px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                  Unsaved changes
                </span>
              )}
              {ovSavedAt && (
                <span className="text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Saved
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOvOpen(false)}>Close</Button>
              <Button
                className="bg-brand-blue text-white"
                onClick={saveOverrides}
                disabled={!ovUser || !ovDirty || ovSaving}
              >
                {ovSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attach RoleDef Dialog */}
      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Attach Role Definition{attachUser ? ` — ${attachUser.email}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Select Role Definition</Label>
              <select
                className="rounded-md border px-3 py-2 w-full"
                value={attachRoleName}
                onChange={(e) => setAttachRoleName(e.target.value)}
              >
                <option value="">— Select —</option>
                {roles.map(r => (
                  <option key={r.name} value={r.name}>{r.name}</option>
                ))}
              </select>
              <div className="text-xs opacity-70 mt-1">
                This attaches extra permissions on top of the primary role.
              </div>
            </div>

            {attachSavedAt && (
              <div className="text-sm px-3 py-2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                Saved ✓
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachOpen(false)}>Cancel</Button>
            <Button
              className="bg-brand-blue text-white"
              onClick={doAttach}
              disabled={!attachUser || !attachRoleName || attachSaving}
            >
              {attachSaving ? "Attaching..." : "Attach"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Primary Role Dialog */}
      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Change Primary Role{changeUser ? ` — ${changeUser.email}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Select primary role</Label>
              <select
                className="rounded-md border px-3 py-2 w-full"
                value={changeRoleName}
                onChange={(e) => setChangeRoleName(e.target.value)}
              >
                {primaryRoleOptions.filter(r => r !== "ALL").map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {changeSavedAt && (
              <div className="text-sm px-3 py-2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                Saved ✓
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOpen(false)}>Cancel</Button>
            <Button
              className="bg-brand-blue text-white"
              onClick={doChangeRole}
              disabled={!changeUser || !changeRoleName || changeSaving}
            >
              {changeSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}