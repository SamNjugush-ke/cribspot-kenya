// backend/src/utils/rbac.ts
import prisma from "./prisma";
import { Permission, AgentStatus, Role } from "@prisma/client";

export type EffectivePermissionsResult = {
  userId: string;
  permissions: Permission[];
  sources: {
    baseRole: {
      role: Role;
      effectiveRoleForBundle: Role; // e.g., AGENT pending -> RENTER
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
 * Baseline permission bundles by "effective bundle role"
 * (RoleDefinitions and overrides can add/remove beyond this.)
 */
const BASE_ROLE_BUNDLES: Record<Role, Permission[]> = {
  SUPER_ADMIN: [], // bypass handled in middleware; keep empty here
  ADMIN: [
    Permission.MANAGE_USERS,
    Permission.VIEW_ANALYTICS,
    Permission.VIEW_TRANSACTIONS_ALL,
    Permission.APPROVE_LISTINGS,
    Permission.FEATURE_LISTINGS,
    Permission.EXPORT_DATA,
    Permission.MANAGE_SETTINGS,
    Permission.IMPERSONATE_USER,
  ],
  EDITOR: [
    Permission.BLOG_CRUD,
    Permission.MODERATE_COMMENTS,
    Permission.SEND_ANNOUNCEMENTS,
    Permission.MANAGE_BLOG_SETTINGS,
  ],
  AGENT: [
    // When approved; pending agents do NOT get this bundle (see resolver)
    Permission.VIEW_OWN_PERFORMANCE,
    Permission.REPLY_MESSAGES,
  ],
  LISTER: [
    Permission.CRUD_OWN_LISTINGS,
    Permission.PUBLISH_OWN_LISTINGS,
    Permission.VIEW_OWN_QUOTA,
    Permission.VIEW_OWN_PERFORMANCE,
  ],
  RENTER: [
    // Minimal/none by default (you can add REPLY_MESSAGES later if renters can DM)
  ],
};

function asRole(value: any): Role {
  // Prisma Role enum at runtime is string values; this guards unknowns.
  if (Object.values(Role).includes(value)) return value as Role;
  return Role.RENTER;
}

async function getEffectiveRoleForBundle(userId: string, role: Role): Promise<{ effective: Role; note?: string }> {
  // Only special-case AGENT pending logic
  if (role !== Role.AGENT) return { effective: role };

  const profile = await prisma.agentProfile.findUnique({
    where: { userId },
    select: { status: true },
  });

  // If no profile or not approved, treat as baseline RENTER bundle (guest-like)
  if (!profile) {
    return { effective: Role.RENTER, note: "AGENT role without AgentProfile; using RENTER baseline bundle." };
  }
  if (profile.status !== AgentStatus.APPROVED) {
    return { effective: Role.RENTER, note: `Agent status is ${profile.status}; using RENTER baseline bundle until approved.` };
  }

  return { effective: Role.AGENT, note: "Agent is APPROVED; using AGENT baseline bundle." };
}

export async function resolveEffectivePermissions(userId: string): Promise<EffectivePermissionsResult> {
  // Fetch user's base role first (and to support AGENT gating)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  const role = asRole(user?.role);

  // Determine bundle role (AGENT pending -> RENTER)
  const { effective: effectiveRoleForBundle, note } = await getEffectiveRoleForBundle(userId, role);

  // Base bundle
  const baseBundle = new Set<Permission>(BASE_ROLE_BUNDLES[effectiveRoleForBundle] ?? []);

  // RoleDefinitions + grants
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
      grants: rd.role.grants.map((g) => ({ permission: g.permission, allow: g.allow })),
    };
  });

  // Per-user overrides
  const overrides = await prisma.userPermissionOverride.findMany({
    where: { userId },
  });

  const allowOverrides = new Set<Permission>();
  const denyOverrides = new Set<Permission>();

  for (const o of overrides) {
    if (o.allow) allowOverrides.add(o.permission);
    else denyOverrides.add(o.permission);
  }

  // Effective = (baseBundle ∪ viaRoles ∪ allowOverrides) \ denyOverrides
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

export function hasPermissionFromResolved(resolved: EffectivePermissionsResult, permission: Permission): boolean {
  return resolved.permissions.includes(permission);
}