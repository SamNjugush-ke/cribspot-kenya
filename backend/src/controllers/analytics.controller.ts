// backend/src/controllers/analytics.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";

/**
 * GET /api/analytics/summary
 * Permission: VIEW_ANALYTICS
 *
 * Returns a compact dashboard summary for super/admin overview pages.
 */
export const getAnalyticsSummary = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // -----------------------
    // Users
    // -----------------------
    const [usersTotal, usersBanned, rolesAgg] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.user.groupBy({
        by: ["role"],
        _count: { role: true },
      }),
    ]);

    const roles: Record<string, number> = {};
    for (const r of rolesAgg) roles[String(r.role)] = r._count.role;

    // "active" (until you have lastLogin) = not banned
    const usersActive = usersTotal - usersBanned;

    // -----------------------
    // Listings
    // -----------------------
    const [listingsTotal, listingsByStatusAgg, featuredCount] = await Promise.all([
      prisma.property.count(),
      prisma.property.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.property.count({ where: { featured: true } }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const s of listingsByStatusAgg) byStatus[String(s.status)] = s._count.status;

    // ensure keys exist for frontend unions (safe default)
    const normalizedByStatus = {
      DRAFT: byStatus["DRAFT"] ?? 0,
      PUBLISHED: byStatus["PUBLISHED"] ?? 0,
      UNPUBLISHED: byStatus["UNPUBLISHED"] ?? 0,
      ARCHIVED: byStatus["ARCHIVED"] ?? 0,
    };

    // -----------------------
    // Payments
    // -----------------------
    // NOTE: not all schemas store amount as integer; we coerce to number safely.
    const [paymentsCount, paymentsSumAgg, paymentsByStatusAgg] = await Promise.all([
      prisma.payment.count(),
      prisma.payment.aggregate({
        _sum: { amount: true as any },
      }),
      prisma.payment.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    const paymentsByStatus: Record<string, number> = {};
    for (const p of paymentsByStatusAgg) paymentsByStatus[String(p.status)] = p._count.status;

    const totalAmountKes = Number((paymentsSumAgg as any)?._sum?.amount ?? 0);

    // -----------------------
    // Subscriptions
    // -----------------------
    const [subsActive, subsExpired, subsExpiringSoon] = await Promise.all([
      prisma.subscription.count({ where: { isActive: true } }),
      prisma.subscription.count({ where: { isActive: false } }),
      prisma.subscription.count({
        where: { isActive: true, expiresAt: { gte: now, lte: soon } },
      }),
    ]);

    // -----------------------
    // Audit
    // -----------------------
    // Your project uses auditLog; model name is usually AuditLog.
    // If your Prisma model is named differently, change prisma.auditLog -> prisma.<ModelName>.
    const auditLast24h = await prisma.auditLog.count({
      where: { createdAt: { gte: last24h } },
    });

    // -----------------------
    // Messages (optional, best-effort)
    // -----------------------
    // These are optional fields for the overview; keep them safe.
    let threads = 0;
    let unread = 0;

    try {
      const userId = req.user?.id;
      if (userId) {
        threads = await prisma.conversation.count({
          where: { participants: { some: { userId } } },
        });

        const parts = await prisma.conversationParticipant.findMany({
          where: { userId },
          select: { conversationId: true, lastReadAt: true },
        });

        let total = 0;
        for (const p of parts) {
          const count = await prisma.message.count({
            where: {
              conversationId: p.conversationId,
              sentAt: { gt: p.lastReadAt ?? new Date(0) },
              senderId: { not: userId },
            },
          });
          total += count;
        }
        unread = total;
      }
    } catch {
      // ignore; messages are optional on overview
    }

    return res.json({
      users: {
        total: usersTotal,
        active: usersActive,
        banned: usersBanned,
        roles,
      },
      listings: {
        total: listingsTotal,
        byStatus: normalizedByStatus,
        featured: featuredCount,
      },
      payments: {
        totalAmountKes,
        count: paymentsCount,
        byStatus: paymentsByStatus,
      },
      subscriptions: {
        active: subsActive,
        expired: subsExpired,
        expiringSoon: subsExpiringSoon,
      },
      audit: {
        last24h: auditLast24h,
      },
      messages: {
        threads,
        unread,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load analytics summary", error: err });
  }
};

/**
 * GET /api/analytics/revenue
 * Returns: [{ month: 'YYYY-MM', total: number }]
 * Uses SUCCESS payments only.
 */
export const getRevenueByMonth = async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const rows = await prisma.$queryRaw<{ month: string; total: number }[]>`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as month,
             COALESCE(SUM("amount"), 0)::int as total
      FROM "Payment"
      WHERE "status" = 'SUCCESS'
        AND "createdAt" >= ${start}
      GROUP BY 1
      ORDER BY 1 ASC;
    `;

    // Return all 12 months including zeros
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.month, Number(r.total || 0));

    const out: { month: string; total: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      out.push({ month: m, total: map.get(m) ?? 0 });
    }

    return res.json(out);
  } catch (err) {
    return res.status(500).json({ message: "Failed to load revenue", error: err });
  }
};

/**
 * GET /api/analytics/distribution/county
 * Returns raw Prisma groupBy shape; frontend normalizes _count safely.
 */
export const getDistributionByCounty = async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.property.groupBy({
      by: ["county"],
      _count: { _all: true },
      // Order by count of a specific scalar field (usually id)
      orderBy: { _count: { id: "desc" } },
    });

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: "Failed to load distribution", error: err });
  }
};

/**
 * GET /api/analytics/subscriptions/status
 * Returns { active: number, expired: number }
 */
export const getSubscriptionStatus = async (_req: Request, res: Response) => {
  try {
    const [active, expired] = await Promise.all([
      prisma.subscription.count({ where: { isActive: true } }),
      prisma.subscription.count({ where: { isActive: false } }),
    ]);
    return res.json({ active, expired });
  } catch (err) {
    return res.status(500).json({ message: "Failed to load subscription status", error: err });
  }
};
