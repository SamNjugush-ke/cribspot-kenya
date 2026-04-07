import api from "@/lib/api";
import EP from "@/lib/endpoints";
import type { Role, Permission, RoleDefinition, UserLite, UserRoleAttach, AuditEvent } from "@/types/rbac";
import { adminFetch } from "@/lib/adminFetch";

export const PERMISSION_GROUPS: Record<string, Permission[]> = {
  "Data & Analytics": ["ACCESS_FULL_ANALYTICS","VIEW_OWN_PERFORMANCE"],
  "Messaging & Leads": ["VIEW_ALL_MESSAGES","REPLY_MESSAGES","BULK_NOTIFICATIONS"],
  "Content": ["MANAGE_BLOG_SETTINGS","BLOG_CRUD","MODERATE_COMMENTS","SEND_ANNOUNCEMENTS"],
  "Payments & Finance": ["CONFIGURE_PAYMENT_GATEWAYS","VIEW_TRANSACTIONS_ALL","MANUAL_REFUND","VIEW_OWN_INVOICES"],
  "Subscriptions & Quotas": ["MANAGE_PACKAGES","ASSIGN_PACKAGES","ENFORCE_QUOTAS","VIEW_QUOTA_DASHBOARDS","VIEW_OWN_QUOTA"],
  "Listings & Moderation": ["APPROVE_LISTINGS","FEATURE_LISTINGS","REMOVE_FLAG_LISTINGS","CRUD_OWN_LISTINGS","PUBLISH_OWN_LISTINGS"],
  "Users & Access": ["MANAGE_LISTER_AGENT_ACCOUNTS","APPROVE_AGENT_PROFILES","MODERATE_RENTERS"],
  "Platform & Security": ["MANAGE_SUPER_ADMIN_ACCOUNTS","CHANGE_PLATFORM_SETTINGS","EDIT_ROLE_DEFINITIONS","VIEW_SYSTEM_LOGS","MAINTENANCE_BACKUPS"],
};

const mockRoles: RoleDefinition[] = [
  { id: "r1", name: "ADMIN", description: "Platform admin", permissions: ["VIEW_SYSTEM_LOGS","EDIT_ROLE_DEFINITIONS"] },
  { id: "r2", name: "EDITOR", description: "Blog editor", permissions: ["BLOG_CRUD","MODERATE_COMMENTS"] },
];

const mockUsers: UserLite[] = [
  { id: "1", name: "Super Admin", email: "super@rk.co.ke", role: "SUPER_ADMIN" },
  { id: "2", name: "Main Admin", email: "admin@rk.co.ke", role: "ADMIN" },
  { id: "3", name: "Mercy Lister", email: "lister@rk.co.ke", role: "LISTER" },
  { id: "4", name: "Jane Renter", email: "renter@rk.co.ke", role: "RENTER" },
];

export async function getRoleDefs(q?: string): Promise<RoleDefinition[]> {
  try {
    const res = await api.get(EP.roleDefs, { params: { q: q || "" } });
    return res.data as RoleDefinition[];
  } catch {
    return mockRoles.filter(r => !q || r.name.toLowerCase().includes((q||"").toLowerCase()));
  }
}

export async function createRoleDef(payload: { name: string; description?: string; permissions: Permission[]; }): Promise<RoleDefinition> {
  try {
    const res = await api.post(EP.roleDefs, payload);
    return res.data as RoleDefinition;
  } catch {
    return { id: Math.random().toString(36).slice(2), ...payload };
  }
}

export async function updateRoleDef(nameOrId: string, payload: { description?: string; permissions: Permission[]; }): Promise<RoleDefinition> {
  try {
    const res = await api.put(EP.roleDef(nameOrId), payload);
    return res.data as RoleDefinition;
  } catch {
    return { id: nameOrId, name: nameOrId, ...payload } as RoleDefinition;
  }
}

export async function deleteRoleDef(nameOrId: string): Promise<{ ok: true }> {
  if (nameOrId === "SUPER_ADMIN") throw new Error("SUPER_ADMIN role is protected and cannot be deleted");
  try { await api.delete(EP.roleDef(nameOrId)); return { ok: true }; } catch { return { ok: true }; }
}

export async function getUsers(q?: string, roleFilter?: Role | "ALL"): Promise<UserLite[]> {
  try {
    const res = await api.get(EP.users, { params: { q: q || "", role: roleFilter && roleFilter !== "ALL" ? roleFilter : "" } });
    return res.data as UserLite[];
  } catch {
    const base = mockUsers.filter(u => !q || (u.name + " " + u.email).toLowerCase().includes((q||"").toLowerCase()));
    return roleFilter && roleFilter !== "ALL" ? base.filter(u => u.role === roleFilter) : base;
  }
}

export async function attachRoleDefToUser(userId: string, roleName: string): Promise<UserRoleAttach> {
  try {
    const res = await api.post(EP.userRoleDefs(userId), { role: roleName });
    return res.data as UserRoleAttach;
  } catch {
    return { userId, roles: [roleName] };
  }
}

export async function setPrimaryRole(userId: string, role: Role | string) {
  return adminFetch(`/api/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}


export async function detachRoleDefFromUser(userId: string, roleName: string): Promise<UserRoleAttach> {
  try {
    const res = await api.delete(EP.userRoleDefs(userId), { data: { role: roleName } });
    return res.data as UserRoleAttach;
  } catch {
    return { userId, roles: [] };
  }
}

export async function getUserOverrides(userId: string): Promise<{ allow: Permission[]; deny: Permission[]; }> {
  try { const res = await api.get(EP.userOverrides(userId)); return res.data; } catch { return { allow: [], deny: [] }; }
}

export async function setUserOverrides(userId: string, payload: { allow: Permission[]; deny: Permission[]; }) {
  try { const res = await api.put(EP.userOverrides(userId), payload); return res.data; } catch { return payload; }
}

export async function getAudit(): Promise<AuditEvent[]> {
  try { const res = await api.get(EP.audit, { params: { limit: 25 } }); return res.data as AuditEvent[]; } 
  catch {
    const now = new Date().toISOString();
    return [
      { id: "a1", actorEmail: "super@rk.co.ke", action: "EDIT_ROLE_DEFINITIONS add BLOG_CRUD to EDITOR", createdAt: now },
      { id: "a2", actorEmail: "admin@rk.co.ke", action: "ATTACH ROLE ADMIN to jane@rk.co.ke", createdAt: now },
    ];
  }
}
