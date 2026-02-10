//src/routes/access.users.ts
import { Router } from "express";
import { Permission } from "@prisma/client";
import prisma from "../utils/prisma";
import { requirePermission } from "../middlewares/requirePermission";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";


const router = Router();

router.use(verifyToken, requireAuth);

// POST /api/access/users/:id/roles  { role: string }
router.post("/:id/roles", requirePermission("EDIT_ROLE_DEFINITIONS"), async (req, res) => {
  const { id } = req.params; const { role } = req.body as { role: string };
  if (!role) return res.status(400).json({ message: "role required" });
  const rd = await prisma.roleDefinition.findFirst({ where: { name: role } });
  if (!rd) return res.status(404).json({ message: "RoleDefinition not found" });

  await prisma.userRoleDefinition.upsert({ where: { userId_roleId: { userId: id, roleId: rd.id } }, update: {}, create: { userId: id, roleId: rd.id } });
  res.json({ userId: id, roles: [role] });
});

// DELETE /api/access/users/:id/roles  body: { role }
router.delete("/:id/roles", requirePermission("EDIT_ROLE_DEFINITIONS"), async (req, res) => {
  const { id } = req.params; const { role } = req.body as { role: string };
  if (!role) return res.status(400).json({ message: "role required" });
  const rd = await prisma.roleDefinition.findFirst({ where: { name: role } });
  if (!rd) return res.status(404).json({ message: "RoleDefinition not found" });

  await prisma.userRoleDefinition.deleteMany({ where: { userId: id, roleId: rd.id } });
  res.json({ userId: id, roles: [] });
});

// GET /api/access/users/:id/overrides
router.get("/:id/overrides", requirePermission("EDIT_ROLE_DEFINITIONS"), async (req, res) => {
  const { id } = req.params;
  const ovr = await prisma.userPermissionOverride.findMany({ where: { userId: id } });
  res.json({ allow: ovr.filter(o => o.allow).map(o => o.permission), deny: ovr.filter(o => !o.allow).map(o => o.permission) });
});

// PUT /api/access/users/:id/overrides  { allow: Permission[], deny: Permission[] }
router.put("/:id/overrides", requirePermission("EDIT_ROLE_DEFINITIONS"), async (req, res) => {
  const { id } = req.params; const { allow, deny } = req.body as { allow: Permission[]; deny: Permission[] };
  await prisma.userPermissionOverride.deleteMany({ where: { userId: id } });
  const data = [
    ...(allow || []).map(p => ({ userId: id, permission: p, allow: true })),
    ...(deny  || []).map(p => ({ userId: id, permission: p, allow: false })),
  ];
  if (data.length) await prisma.userPermissionOverride.createMany({ data });
  res.json({ allow: allow || [], deny: deny || [] });
});

export default router;
