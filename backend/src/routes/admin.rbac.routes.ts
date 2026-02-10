// backend/src/routes/admin.rbac.routes.ts
import { Router } from "express";
import { requirePermission } from "../middlewares/requirePermission";
import { resolveEffectivePermissions } from "../utils/rbac";
import prisma from "../utils/prisma";

const router = Router();

/**
 * GET /api/admin/rbac/effective/:userId
 * (you already have this somewhere; keep only one implementation in the codebase)
 */
router.get("/effective/:userId", requirePermission("MANAGE_USERS"), async (req, res) => {
  const { userId } = req.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, isBanned: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  const resolved = await resolveEffectivePermissions(userId);

  return res.json({
    user,
    permissions: resolved.permissions,
    sources: resolved.sources,
  });
});

/**
 * GET /api/admin/rbac/self-test/:userId
 * Runs a quick sanity report for this user:
 * - baseline bundle
 * - role definitions
 * - overrides precedence
 */
router.get("/self-test/:userId", requirePermission("MANAGE_USERS"), async (req, res) => {
  const { userId } = req.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });

  const resolved = await resolveEffectivePermissions(userId);

  // pick a few key permissions to report against
  const probes = [
    "CRUD_OWN_LISTINGS",
    "PUBLISH_OWN_LISTINGS",
    "VIEW_ANALYTICS",
    "VIEW_TRANSACTIONS_ALL",
    "MANAGE_USERS",
    "IMPERSONATE_USER",
    "EXPORT_DATA",
  ] as const;

  const probeResults = probes.map((p) => ({
    permission: p,
    has: resolved.permissions.includes(p as any),
    // source hints
    inBase: resolved.sources.baseRole.permissions.includes(p as any),
    inViaRoles: resolved.sources.viaRoles.includes(p as any),
    inAllowOverrides: resolved.sources.allowOverrides.includes(p as any),
    inDenyOverrides: resolved.sources.denyOverrides.includes(p as any),
  }));

  return res.json({
    user,
    summary: {
      totalEffective: resolved.permissions.length,
      baseRole: resolved.sources.baseRole,
      roleDefinitions: resolved.sources.roleDefinitions.map((r) => ({ roleId: r.roleId, roleName: r.roleName })),
      allowOverrides: resolved.sources.allowOverrides,
      denyOverrides: resolved.sources.denyOverrides,
    },
    probes: probeResults,
  });
});

export default router;
