// backend/src/controllers/admin.rbac.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { resolveEffectivePermissions } from "../utils/rbac";

/**
 * GET /api/admin/rbac/effective/:userId
 * Admin debug: show effective permissions + sources.
 */
export const getEffectivePermissionsForUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isBanned: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    // SUPER_ADMIN bypass (transparent in debug response)
    if (user.role === "SUPER_ADMIN") {
      return res.json({
        user,
        effective: "ALL_PERMISSIONS",
        note: "User is SUPER_ADMIN (bypass).",
      });
    }

    const resolved = await resolveEffectivePermissions(userId);

    return res.json({
      user,
      permissions: resolved.permissions,
      sources: resolved.sources,
    });
  } catch (err) {
    console.error("getEffectivePermissionsForUser error", err);
    return res.status(500).json({ error: "Failed to resolve permissions" });
  }
};

export const searchUsers = async (req: Request, res: Response) => {
  const q = String(req.query.q || "").trim();
  const role = String(req.query.role || "").trim();
  const take = Math.min(Number(req.query.take || 20), 50);

  const where: any = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }
  if (role) where.role = role;

  const users = await prisma.user.findMany({
    where,
    take,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true },
  });

  res.json({ items: users });
};

