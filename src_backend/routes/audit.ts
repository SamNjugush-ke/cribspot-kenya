// backend/src/routes/audit.ts
import { Router } from "express";
import prisma from "../utils/prisma";
import { requirePermission } from "../middlewares/requirePermission";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.use(verifyToken, requireAuth);


/**
 * GET /api/audit?take=20&skip=0
 * Optional filters:
 * - action, actorId, targetType, targetId
 * - from, to (ISO dates)
 *
 * Access:
 * - VIEW_SYSTEM_LOGS only (grant to SUPER_ADMIN + privileged admins)
 */
router.get("/", requirePermission("VIEW_SYSTEM_LOGS"), async (req, res) => {
  try {
    const take = Math.max(1, Math.min(Number(req.query.take) || 25, 200));
    const skip = Math.max(0, Number(req.query.skip) || 0);

    const action = (req.query.action as string | undefined)?.trim();
    const actorId = (req.query.actorId as string | undefined)?.trim();
    const targetType = (req.query.targetType as string | undefined)?.trim();
    const targetId = (req.query.targetId as string | undefined)?.trim();

    const fromRaw = (req.query.from as string | undefined)?.trim();
    const toRaw = (req.query.to as string | undefined)?.trim();

    const where: any = {};
    if (action) where.action = action;
    if (actorId) where.actorId = actorId;
    if (targetType) where.targetType = targetType;
    if (targetId) where.targetId = targetId;

    if (fromRaw || toRaw) {
      const createdAt: any = {};
      if (fromRaw) {
        const d = new Date(fromRaw);
        if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Invalid from date" });
        createdAt.gte = d;
      }
      if (toRaw) {
        const d = new Date(toRaw);
        if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Invalid to date" });
        createdAt.lte = d;
      }
      where.createdAt = createdAt;
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: {
          actor: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return res.json({ items, meta: { total, take, skip } });
  } catch (err) {
    console.error("audit list error", err);
    return res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

export default router;