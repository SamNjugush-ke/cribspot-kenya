// backend/src/controllers/subscription.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { getActiveSubscription, getPublishedCount } from "../utils/subscriptionUtils";

export const subscribeToPlan = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { planId } = req.body as { planId?: string };

    if (!userId) return res.status(401).json({ message: "Unauthorized: Missing userId" });
    if (!planId) return res.status(400).json({ message: "planId is required" });

    // Only allow subscribing to ACTIVE plans (sales on)
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId, isActive: true },
    });
    if (!plan) return res.status(400).json({ message: "Plan is not available" });

    const now = new Date();
    const endDate = new Date(now.getTime() + plan.durationInDays * 24 * 60 * 60 * 1000);

    const newSub = await prisma.subscription.create({
      data: {
        userId,
        planId,
        startedAt: now,
        expiresAt: endDate,
        remainingListings: plan.totalListings,
        remainingFeatured: plan.featuredListings,
        isActive: true,
      },
      include: { plan: true },
    });

    const snapshot = await getActiveSubscription(userId);

    return res.status(201).json({
      message: "Subscribed successfully",
      subscription: newSub,
      active: snapshot,
    });
  } catch (err) {
    console.error("subscribeToPlan error", err);
    return res.status(500).json({ message: "Subscription failed" });
  }
};

export const getMySubscription = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const active = await getActiveSubscription(userId);

    // Keep backward-friendly response:
    // - if none: message
    // - else: include full stacked subs + aggregate
    if (!active.aggregate.activeCount) {
      return res.json({ message: "No active subscription", active });
    }

    return res.json(active);
  } catch (err) {
    console.error("getMySubscription error", err);
    return res.status(500).json({ message: "Failed to fetch subscription" });
  }
};

// GET /api/subscriptions/usage
export const getUsage = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const active = await getActiveSubscription(userId);
    const usedPublished = await getPublishedCount(userId);

    return res.json({
      remainingListings: active.aggregate.remainingListings,
      remainingFeatured: active.aggregate.remainingFeatured,
      totalListings: active.aggregate.totalListings,
      totalFeatured: active.aggregate.totalFeatured,
      usedPublished,
      activeCount: active.aggregate.activeCount,
      expiresAtSoonest: active.aggregate.expiresAtSoonest,
    });
  } catch (err) {
    console.error("getUsage error", err);
    return res.status(500).json({ message: "Failed to fetch usage" });
  }
};