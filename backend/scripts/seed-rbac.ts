import { PrismaClient, Permission } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Upsert SUPER_ADMIN role definition
  const superAdmin = await prisma.roleDefinition.upsert({
    where: { name: "SUPER_ADMIN" },
    update: {},
    create: { name: "SUPER_ADMIN", description: "Platform super admin (protected)" },
  });

  // Grant ALL permissions to SUPER_ADMIN definition
  const perms: Permission[] = Object.values(Permission);
  for (const p of perms) {
    await prisma.permissionGrant.upsert({
      where: { roleId_permission: { roleId: superAdmin.id, permission: p } },
      update: { allow: true },
      create: { roleId: superAdmin.id, permission: p, allow: true },
    });
  }

  console.log("Seeded SUPER_ADMIN RoleDefinition with all permissions.");

  // Optional: attach RoleDefinition to an existing SUPER_ADMIN user by email
  const email = process.env.SEED_SUPER_EMAIL; // e.g., admin@rentalskenya.co.ke
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.userRoleDefinition.upsert({
        where: { userId_roleId: { userId: user.id, roleId: superAdmin.id } },
        update: {},
        create: { userId: user.id, roleId: superAdmin.id },
      });
      console.log(`Attached SUPER_ADMIN RoleDefinition to ${email}`);
    } else {
      console.log(`User ${email} not found; skip attach.`);
    }
  }
}

main().then(()=>prisma.$disconnect()).catch((e)=>{ console.error(e); prisma.$disconnect(); process.exit(1); });
