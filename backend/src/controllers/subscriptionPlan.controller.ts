import { Request, Response } from "express";
import prisma from "../utils/prisma";

function isFiniteNumber(v: any) {
  const n = Number(v);
  return Number.isFinite(n);
}

export const createPlan = async (req: Request, res: Response) => {
  try {
    const { name, price, durationInDays, totalListings, featuredListings } = req.body as {
      name?: string;
      price?: number;
      durationInDays?: number;
      totalListings?: number;
      featuredListings?: number;
    };

    if (!name?.trim()) return res.status(400).json({ message: "name is required" });
    if (![price, durationInDays, totalListings, featuredListings].every(isFiniteNumber)) {
      return res.status(400).json({
        message: "price, durationInDays, totalListings, featuredListings must be numbers",
      });
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: name.trim(),
        price: Number(price),
        durationInDays: Number(durationInDays),
        totalListings: Number(totalListings),
        featuredListings: Number(featuredListings),
      },
    });

    return res.status(201).json(plan);
  } catch (err) {
    console.error("createPlan error", err);
    return res.status(500).json({ message: "Failed to create plan" });
  }
};

export const getAllPlans = async (_req: Request, res: Response) => {
  try {
    // Public list: ONLY plans visible for new subscriptions
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return res.json(plans);
  } catch (err) {
    console.error("getAllPlans error", err);
    return res.status(500).json({ message: "Failed to fetch plans" });
  }
};

export const updatePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, price, durationInDays, totalListings, featuredListings } = req.body as {
      name?: string;
      price?: number;
      durationInDays?: number;
      totalListings?: number;
      featuredListings?: number;
    };

    const data: any = {};
    if (name !== undefined) data.name = String(name).trim();
    if (price !== undefined) {
      if (!isFiniteNumber(price)) return res.status(400).json({ message: "price must be a number" });
      data.price = Number(price);
    }
    if (durationInDays !== undefined) {
      if (!isFiniteNumber(durationInDays))
        return res.status(400).json({ message: "durationInDays must be a number" });
      data.durationInDays = Number(durationInDays);
    }
    if (totalListings !== undefined) {
      if (!isFiniteNumber(totalListings))
        return res.status(400).json({ message: "totalListings must be a number" });
      data.totalListings = Number(totalListings);
    }
    if (featuredListings !== undefined) {
      if (!isFiniteNumber(featuredListings))
        return res.status(400).json({ message: "featuredListings must be a number" });
      data.featuredListings = Number(featuredListings);
    }

    const updated = await prisma.subscriptionPlan.update({ where: { id }, data });
    return res.json(updated);
  } catch (err) {
    console.error("updatePlan error", err);
    return res.status(500).json({ message: "Failed to update plan" });
  }
};

/**
 * togglePlanStatus = "retire/reactivate" (strict)
 * - Blocks turning OFF if there are active subscriptions (your current behavior).
 */
export async function togglePlanStatus(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    // If trying to deactivate via toggle, block if there are active subscriptions
    if (plan.isActive) {
      const now = new Date();
      const activeSubs = await prisma.subscription.count({
        where: { planId: id, isActive: true, expiresAt: { gt: now } },
      });
      if (activeSubs > 0) {
        return res.status(400).json({
          error: "Plan has active subscriptions. Use suspension (sales off) approach instead.",
        });
      }
    }

    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: !plan.isActive },
    });

    return res.json(updated);
  } catch (err) {
    console.error("togglePlanStatus error", err);
    return res.status(500).json({ error: "Failed to toggle plan status" });
  }
}

/**
 * suspendPlan = "sales off" (lenient)
 * - Allowed even when there are active subscriptions.
 * - Makes plan invisible to new subscribers (public list filters isActive=true),
 *   but existing subscribers keep their planId unchanged.
 */
export const suspendPlan = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    if (!plan.isActive) {
      return res.json({ ...plan, message: "Plan is already suspended (sales off)." });
    }

    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: false },
    });

    return res.json({ ...updated, message: "Plan suspended. Existing subscribers remain unaffected." });
  } catch (err) {
    console.error("suspendPlan error", err);
    return res.status(500).json({ error: "Failed to suspend plan" });
  }
};

/**
 * resumePlan = "sales on"
 * - Re-enables a previously suspended plan so it becomes visible again to new subscribers.
 */
export const resumePlan = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    if (plan.isActive) {
      return res.json({ ...plan, message: "Plan is already active (sales on)." });
    }

    const updated = await prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: true },
    });

    return res.json({ ...updated, message: "Plan resumed (sales on). It is now visible for new subscriptions." });
  } catch (err) {
    console.error("resumePlan error", err);
    return res.status(500).json({ error: "Failed to resume plan" });
  }
};

/**
 * deletePlan
 * - If there are active subscriptions, we SUSPEND instead of deleting (as requested).
 * - If no active subs, we hard delete.
 */
export const deletePlan = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) return res.status(404).json({ error: "Plan not found" });

    const now = new Date();
    const activeSubs = await prisma.subscription.count({
      where: { planId: id, isActive: true, expiresAt: { gt: now } },
    });

    // If active subs exist: suspend (sales off) instead of delete
    if (activeSubs > 0) {
      const suspended = await prisma.subscriptionPlan.update({
        where: { id },
        data: { isActive: false },
      });

      return res.status(200).json({
        success: true,
        action: "suspended",
        message:
          "Plan has active subscriptions, so it cannot be deleted. It has been suspended (sales off) instead.",
        plan: suspended,
      });
    }

    await prisma.subscriptionPlan.delete({ where: { id } });

    return res.json({ success: true, action: "deleted", message: "Plan deleted successfully" });
  } catch (err) {
    console.error("deletePlan error", err);
    return res.status(500).json({ error: "Failed to delete plan" });
  }
};

export const getAllPlansAdmin = async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json(plans);
  } catch (err) {
    console.error("getAllPlansAdmin error", err);
    return res.status(500).json({ message: "Failed to fetch plans" });
  }
};

