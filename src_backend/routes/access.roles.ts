//src/routes/access.roles.ts
import { Router } from "express";
import { Permission } from "@prisma/client";
import prisma from "../utils/prisma";
import { requirePermission } from "../middlewares/requirePermission";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.use(verifyToken, requireAuth);

// GET /api/access/roles
router.get("/", requirePermission("EDIT_ROLE_DEFINITIONS"), async (_req, res) => {
  const defs = await prisma.roleDefinition.findMany({ include: { grants: true }, orderBy: { name: "asc" } });
  const mapped = defs.map(d => ({
    id: d.id, name: d.name, description: d.description,
    permissions: d.grants.filter(g => g.allow).map(g => g.permission),
    createdAt: d.createdAt, updatedAt: d.updatedAt
  }));
  res.json(mapped);
});

// POST /api/access/roles
router.post("/", requirePermission("EDIT_ROLE_DEFINITIONS"), async (req, res) => {
  const { name, description, permissions } = req.body as { name: string; description?: string; permissions?: Permission[] };
  if (!name) return res.status(400).json({ message: "name required" });

  const created = await prisma.roleDefinition.create({ data: { name, description: description || null } });
  if (permissions?.length) {
    await prisma.permissionGrant.createMany({ data: permissions.map(p => ({ roleId: created.id, permission: p, allow: true })), skipDuplicates: true });
  }
  const grants = await prisma.permissionGrant.findMany({ where: { roleId: created.id } });
  res.json({ id: created.id, name: created.name, description: created.description, permissions: grants.filter(g => g.allow).map(g => g.permission) });
});

// PUT /api/access/roles/:idOrName
router.put("/:idOrName", requirePermission("EDIT_ROLE_DEFINITIONS"), async (req, res) => {
  const { idOrName } = req.params;
  const { description, permissions } = req.body as { description?: string; permissions: Permission[] };

  const role = await prisma.roleDefinition.findFirst({ where: { OR: [{ id: idOrName }, { name: idOrName }] } });
  if (!role) return res.status(404).json({ message: "Role not found" });

  await prisma.roleDefinition.update({ where: { id: role.id }, data: { description: description ?? role.description } });
  await prisma.permissionGrant.deleteMany({ where: { roleId: role.id } });
  if (permissions?.length) {
    await prisma.permissionGrant.createMany({ data: permissions.map(p => ({ roleId: role.id, permission: p, allow: true })) });
  }
  const grants = await prisma.permissionGrant.findMany({ where: { roleId: role.id } });
  res.json({ id: role.id, name: role.name, description: description ?? role.description, permissions: grants.filter(g => g.allow).map(g => g.permission) });
});

// DELETE /api/access/roles/:idOrName
router.delete("/:idOrName", requirePermission("EDIT_ROLE_DEFINITIONS"), async (req, res) => {
  const { idOrName } = req.params;
  if (idOrName === "SUPER_ADMIN") return res.status(400).json({ message: "SUPER_ADMIN is protected" });

  const role = await prisma.roleDefinition.findFirst({ where: { OR: [{ id: idOrName }, { name: idOrName }] }, include: { users: true } });
  if (!role) return res.status(404).json({ message: "Role not found" });
  if (role.users.length) return res.status(400).json({ message: "Unassign role from users first" });

  await prisma.permissionGrant.deleteMany({ where: { roleId: role.id } });
  await prisma.roleDefinition.delete({ where: { id: role.id } });
  res.json({ ok: true });
});

export default router;
