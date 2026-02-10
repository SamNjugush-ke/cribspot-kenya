// backend/src/scripts/seedRbac.ts
import prisma from "../utils/prisma";
import { Permission } from "@prisma/client";

async function upsertRoleWithGrants(name: string, description: string, perms: Permission[]) {
  const role = await prisma.roleDefinition.upsert({
    where: { name },
    update: { description },
    create: { name, description },
  });

  // Ensure grants match perms (allow=true). We'll upsert each.
  for (const permission of perms) {
    await prisma.permissionGrant.upsert({
      where: { roleId_permission: { roleId: role.id, permission } },
      update: { allow: true },
      create: { roleId: role.id, permission, allow: true },
    });
  }

  return role;
}

async function main() {
  // Default RoleDefinitions (your suggested set)
  const adminOps = await upsertRoleWithGrants(
    "AdminOps",
    "Operational admin: users, listings moderation, exports, settings.",
    [
      Permission.MANAGE_USERS,
      Permission.APPROVE_LISTINGS,
      Permission.FEATURE_LISTINGS,
      Permission.EXPORT_DATA,
      Permission.MANAGE_SETTINGS,
      Permission.VIEW_ANALYTICS,
    ]
  );

  const contentEditor = await upsertRoleWithGrants(
    "ContentEditor",
    "Blog/CMS operations.",
    [
      Permission.BLOG_CRUD,
      Permission.MODERATE_COMMENTS,
      Permission.SEND_ANNOUNCEMENTS,
      Permission.MANAGE_BLOG_SETTINGS,
    ]
  );

  const finance = await upsertRoleWithGrants(
    "Finance",
    "Payments visibility + refunds + exports.",
    [
      Permission.VIEW_TRANSACTIONS_ALL,
      Permission.EXPORT_DATA,
      Permission.MANUAL_REFUND,
    ]
  );

  const support = await upsertRoleWithGrants(
    "Support",
    "Support tooling and messaging (expand later to ticket permissions).",
    [
      Permission.VIEW_ALL_MESSAGES,
      Permission.REPLY_MESSAGES,
      Permission.BULK_NOTIFICATIONS,
    ]
  );

  // Optional (SUPER_ADMIN bypass exists, so this is mostly documentary/assignment convenience)
  const superAdminOps = await upsertRoleWithGrants(
    "SuperAdminOps",
    "High privilege ops (use with caution).",
    [
      Permission.IMPERSONATE_USER,
      Permission.MANAGE_SUPER_ADMIN_ACCOUNTS,
      Permission.EDIT_ROLE_DEFINITIONS,
      Permission.VIEW_SYSTEM_LOGS,
      Permission.CHANGE_PLATFORM_SETTINGS,
    ]
  );

  // OPTIONAL: attach useful roles to existing known accounts by email (adjust as needed)
  const attach = async (email: string, roleId: string) => {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!u) return;

    await prisma.userRoleDefinition.upsert({
      where: { userId_roleId: { userId: u.id, roleId } },
      update: {},
      create: { userId: u.id, roleId },
    });
  };

  await attach("admin@rentalskenya.co.ke", adminOps.id);
  await attach("editor@rentalskenya.co.ke", contentEditor.id);
  await attach("superadmin@rentalskenya.co.ke", superAdminOps.id);
  // finance/support: attach when you have those accounts

  console.log("RBAC seed complete:", {
    adminOps: adminOps.id,
    contentEditor: contentEditor.id,
    finance: finance.id,
    support: support.id,
    superAdminOps: superAdminOps.id,
  });
}

main()
  .catch((e) => {
    console.error("seedRbac failed", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
