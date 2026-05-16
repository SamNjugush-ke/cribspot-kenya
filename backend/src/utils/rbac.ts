// backend/src/utils/rbac.ts
import prisma from "./prisma";
import { Permission, AgentStatus, Role } from "@prisma/client";

export type EffectivePermissionsResult = {
  userId: string;
  permissions: Permission[];
  sources: {
    baseRole: {
      role: Role;
      effectiveRoleForBundle: Role;
      note?: string;
      permissions: Permission[];
    };
    viaRoles: Permission[];
    allowOverrides: Permission[];
    denyOverrides: Permission[];
    roleDefinitions: Array<{
      roleId: string;
      roleName: string;
      grants: Array<{ permission: Permission; allow: boolean }>;
    }>;
  };
};

/**
 * Baseline permission bundles by "effective bundle role".
 * SUPER_ADMIN bypass is handled in requirePermission middleware.
 */
const BASE_ROLE_BUNDLES: Record<Role, Permission[]> = {
  SUPER_ADMIN: [],

  ADMIN: [
    Permission.MANAGE_USERS,
    Permission.VIEW_ANALYTICS,
    Permission.ACCESS_FULL_ANALYTICS,
    Permission.VIEW_TRANSACTIONS_ALL,
    Permission.VIEW_QUOTA_DASHBOARDS,
    Permission.MANAGE_PACKAGES,
    Permission.ASSIGN_PACKAGES,
    Permission.ENFORCE_QUOTAS,
    Permission.APPROVE_LISTINGS,
    Permission.FEATURE_LISTINGS,
    Permission.REMOVE_FLAG_LISTINGS,
    Permission.EXPORT_DATA,
    Permission.MANAGE_SETTINGS,
    Permission.IMPERSONATE_USER,
    Permission.MODERATE_RENTERS,
    Permission.MANAGE_LISTER_AGENT_ACCOUNTS,
    Permission.APPROVE_AGENT_PROFILES,
  ],

  EDITOR: [
    Permission.BLOG_CRUD,
    Permission.MODERATE_COMMENTS,
    Permission.SEND_ANNOUNCEMENTS,
    Permission.MANAGE_BLOG_SETTINGS,
  ],

  AGENT: [
    Permission.VIEW_OWN_PERFORMANCE,
    Permission.REPLY_MESSAGES,
  ],

  LISTER: [
    Permission.CRUD_OWN_LISTINGS,
    Permission.PUBLISH_OWN_LISTINGS,
    Permission.VIEW_OWN_QUOTA,
    Permission.VIEW_OWN_PERFORMANCE,
    Permission.VIEW_OWN_INVOICES,
  ],

  RENTER: [],
};

function asRole(value: any): Role {
  if (Object.values(Role).includes(value)) return value as Role;
  return Role.RENTER;
}

async function getEffectiveRoleForBundle(
  userId: string,
  role: Role
): Promise<{ effective: Role; note?: string }> {
  if (role !== Role.AGENT) return { effective: role };

  const profile = await prisma.agentProfile.findUnique({
    where: { userId },
    select: { status: true },
  });

  if (!profile) {
    return {
      effective: Role.RENTER,
      note: "AGENT role without AgentProfile; using RENTER baseline bundle.",
    };
  }

  if (profile.status !== AgentStatus.APPROVED) {
    return {
      effective: Role.RENTER,
      note: `Agent status is ${profile.status}; using RENTER baseline bundle until approved.`,
    };
  }

  return {
    effective: Role.AGENT,
    note: "Agent is APPROVED; using AGENT baseline bundle.",
  };
}

export async function resolveEffectivePermissions(
  userId: string
): Promise<EffectivePermissionsResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  const role = asRole(user?.role);
  const { effective: effectiveRoleForBundle, note } =
    await getEffectiveRoleForBundle(userId, role);

  const baseBundle = new Set<Permission>(
    BASE_ROLE_BUNDLES[effectiveRoleForBundle] ?? []
  );

  const roleDefs = await prisma.userRoleDefinition.findMany({
    where: { userId },
    include: {
      role: {
        include: { grants: true },
      },
    },
  });

  const viaRoles = new Set<Permission>();
  const roleDefinitions = roleDefs.map((rd) => {
    for (const g of rd.role.grants) {
      if (g.allow) viaRoles.add(g.permission);
    }

    return {
      roleId: rd.role.id,
      roleName: rd.role.name,
      grants: rd.role.grants.map((g) => ({
        permission: g.permission,
        allow: g.allow,
      })),
    };
  });

  const overrides = await prisma.userPermissionOverride.findMany({
    where: { userId },
  });

  const allowOverrides = new Set<Permission>();
  const denyOverrides = new Set<Permission>();

  for (const o of overrides) {
    if (o.allow) allowOverrides.add(o.permission);
    else denyOverrides.add(o.permission);
  }

  const effective = new Set<Permission>();

  for (const p of baseBundle) effective.add(p);
  for (const p of viaRoles) effective.add(p);
  for (const p of allowOverrides) effective.add(p);
  for (const p of denyOverrides) effective.delete(p);

  return {
    userId,
    permissions: Array.from(effective),
    sources: {
      baseRole: {
        role,
        effectiveRoleForBundle,
        note,
        permissions: Array.from(baseBundle),
      },
      viaRoles: Array.from(viaRoles),
      allowOverrides: Array.from(allowOverrides),
      denyOverrides: Array.from(denyOverrides),
      roleDefinitions,
    },
  };
}

export function hasPermissionFromResolved(
  resolved: EffectivePermissionsResult,
  permission: Permission
): boolean {
  return resolved.permissions.includes(permission);
}