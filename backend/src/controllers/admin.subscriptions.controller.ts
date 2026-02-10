// backend/src/controllers/admin.subscriptions.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { auditLog } from "../utils/audit";

// Helper: compute expiry
function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

const subscriptionInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isBanned: true,
      createdAt: true,
    },
  },
  plan: {
    select: {
      id: true,
      name: true,
      price: true,
      durationInDays: true,
      totalListings: true,
      featuredListings: true,
      isActive: true,
    },
  },
};

// GET /api/admin/subscriptions
export const adminListSubscriptions = async (req: Request, res: Response) => {
  try {
    const { q, userId, planId, active, expiringInDays, take, skip } = req.query as {
      q?: string;
      userId?: string;
      planId?: string;
      active?: string;
      expiringInDays?: string;
      take?: string;
      skip?: string;
    };

    const safeTake = Math.max(1, Math.min(Number(take) || 50, 200));
    const safeSkip = Math.max(0, Number(skip) || 0);

    const where: any = {};
    if (userId) where.userId = userId;
    if (planId) where.planId = planId;

    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;

    if (expiringInDays && Number.isFinite(Number(expiringInDays))) {
      const days = Number(expiringInDays);
      const now = new Date();
      const until = addDays(now, days);
      where.expiresAt = { gte: now, lte: until };
      where.isActive = true;
    }

    const qStr = (q || "").trim();
    if (qStr) {
      where.user = {
        OR: [
          { email: { contains: qStr, mode: "insensitive" } },
          { name: { contains: qStr, mode: "insensitive" } },
        ],
      };
    }

    const items = await prisma.subscription.findMany({
      where,
      take: safeTake,
      skip: safeSkip,
      orderBy: { expiresAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isBanned: true } },
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            durationInDays: true,
            totalListings: true,
            featuredListings: true,
          },
        },
      },
    });

    const total = await prisma.subscription.count({ where });

    return res.json({ items, meta: { total, take: safeTake, skip: safeSkip } });
  } catch (err) {
    console.error("adminListSubscriptions error", err);
    return res.status(500).json({ error: "Failed to list subscriptions" });
  }
};

// POST /api/admin/subscriptions/grant
export const adminGrantSubscription = async (req: Request, res: Response) => {
  try {
    const { userId, planId, startsAt, expiresAt, extendIfActive } = req.body as {
      userId?: string;
      planId?: string;
      startsAt?: string;
      expiresAt?: string;
      extendIfActive?: boolean;
    };

    if (!userId || !planId) {
      return res.status(400).json({ error: "userId and planId are required" });
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    const now = new Date();
    const start = startsAt ? new Date(startsAt) : now;
    const computedExpiry = expiresAt ? new Date(expiresAt) : addDays(start, plan.durationInDays);

    // Find active subscription (if any)
    const activeSub = await prisma.subscription.findFirst({
      where: { userId, isActive: true },
      orderBy: { expiresAt: "desc" },
    });

    // If active exists and we are extending
    if (activeSub && (extendIfActive ?? true)) {
      const base = activeSub.expiresAt > now ? activeSub.expiresAt : now;
      const newExpiry = expiresAt ? computedExpiry : addDays(base, plan.durationInDays);

      const updated = await prisma.subscription.update({
        where: { id: activeSub.id },
        data: {
          expiresAt: newExpiry,
          isActive: true,
          remainingListings: activeSub.remainingListings + plan.totalListings,
          remainingFeatured: activeSub.remainingFeatured + plan.featuredListings,
          // NOTE: planId remains unchanged by design
        },
        include: subscriptionInclude,
      });

      // AUDIT (C): grant -> extended existing
      await auditLog(req, {
        action: "SUBSCRIPTION_EXTENDED_BY_GRANT",
        targetType: "SUBSCRIPTION",
        targetId: updated.id,
        metadata: {
          mode: "extended",
          userId,
          requestedPlanId: planId,
          keptPlanId: updated.planId,
          before: {
            expiresAt: activeSub.expiresAt,
            remainingListings: activeSub.remainingListings,
            remainingFeatured: activeSub.remainingFeatured,
          },
          after: {
            expiresAt: updated.expiresAt,
            remainingListings: updated.remainingListings,
            remainingFeatured: updated.remainingFeatured,
          },
        },
      });

      return res.json({
        mode: "extended",
        note: "Active subscription extended; planId remains unchanged (quotas topped up).",
        subscription: updated,
      });
    }

    // Otherwise create a new subscription
    const created = await prisma.subscription.create({
      data: {
        userId,
        planId,
        startedAt: start,
        expiresAt: computedExpiry,
        remainingListings: plan.totalListings,
        remainingFeatured: plan.featuredListings,
        isActive: true,
      },
      include: subscriptionInclude,
    });

    // AUDIT (C): grant -> created new
    await auditLog(req, {
      action: "SUBSCRIPTION_GRANTED",
      targetType: "SUBSCRIPTION",
      targetId: created.id,
      metadata: {
        mode: "created",
        userId,
        planId,
        startedAt: created.startedAt,
        expiresAt: created.expiresAt,
        remainingListings: created.remainingListings,
        remainingFeatured: created.remainingFeatured,
      },
    });

    return res.json({ mode: "created", subscription: created });
  } catch (err) {
    console.error("adminGrantSubscription error", err);
    return res.status(500).json({ error: "Failed to grant subscription" });
  }
};

// PATCH /api/admin/subscriptions/:id/extend
export const adminExtendSubscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { days, expiresAt } = req.body as { days?: number; expiresAt?: string };

    const sub = await prisma.subscription.findUnique({ where: { id }, include: { plan: true } });
    if (!sub) return res.status(404).json({ error: "Subscription not found" });

    const beforeExpiresAt = sub.expiresAt;

    const now = new Date();
    let newExpiry: Date;

    if (expiresAt) {
      const d = new Date(expiresAt);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Invalid expiresAt" });
      newExpiry = d;
    } else {
      const d = Number(days);
      if (!Number.isFinite(d) || d <= 0) return res.status(400).json({ error: "days must be a positive number" });
      const base = sub.expiresAt > now ? sub.expiresAt : now;
      newExpiry = addDays(base, d);
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: { expiresAt: newExpiry, isActive: true },
      include: subscriptionInclude,
    });

    // AUDIT (C): extend
    await auditLog(req, {
      action: "SUBSCRIPTION_EXTENDED",
      targetType: "SUBSCRIPTION",
      targetId: updated.id,
      metadata: {
        beforeExpiresAt,
        afterExpiresAt: updated.expiresAt,
        method: expiresAt ? "absolute" : "days",
        days: expiresAt ? undefined : Number(days),
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error("adminExtendSubscription error", err);
    return res.status(500).json({ error: "Failed to extend subscription" });
  }
};

// PATCH /api/admin/subscriptions/:id/reset-usage
export const adminResetSubscriptionUsage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { remainingListings, remainingFeatured, resetToPlanDefaults } = req.body as {
      remainingListings?: number;
      remainingFeatured?: number;
      resetToPlanDefaults?: boolean;
    };

    const sub = await prisma.subscription.findUnique({ where: { id }, include: { plan: true } });
    if (!sub) return res.status(404).json({ error: "Subscription not found" });

    const before = {
      remainingListings: sub.remainingListings,
      remainingFeatured: sub.remainingFeatured,
    };

    const data: any = {};
    if (resetToPlanDefaults) {
      data.remainingListings = sub.plan.totalListings;
      data.remainingFeatured = sub.plan.featuredListings;
    } else {
      if (remainingListings !== undefined) {
        const v = Number(remainingListings);
        if (!Number.isFinite(v) || v < 0) {
          return res.status(400).json({ error: "remainingListings must be >= 0" });
        }
        data.remainingListings = v;
      }
      if (remainingFeatured !== undefined) {
        const v = Number(remainingFeatured);
        if (!Number.isFinite(v) || v < 0) {
          return res.status(400).json({ error: "remainingFeatured must be >= 0" });
        }
        data.remainingFeatured = v;
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No valid fields provided" });
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data,
      include: subscriptionInclude,
    });

    // AUDIT (C): reset usage
    await auditLog(req, {
      action: "SUBSCRIPTION_USAGE_RESET",
      targetType: "SUBSCRIPTION",
      targetId: updated.id,
      metadata: {
        resetToPlanDefaults: Boolean(resetToPlanDefaults),
        before,
        after: {
          remainingListings: updated.remainingListings,
          remainingFeatured: updated.remainingFeatured,
        },
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error("adminResetSubscriptionUsage error", err);
    return res.status(500).json({ error: "Failed to reset subscription usage" });
  }
};