// backend/src/utils/subscriptionQuota.ts
import prisma from "./prisma";
import { Prisma } from "@prisma/client";

/**
 * FIFO consumption: deduct from subscriptions expiring soonest first.
 * Use inside a Prisma transaction to avoid race conditions.
 */

// IMPORTANT: tx in prisma.$transaction(...) is a TransactionClient, not full PrismaClient.
type TxClient = Prisma.TransactionClient;

export type QuotaConsumeResult = {
  consumedFrom: Array<{
    subscriptionId: string;
    deductedListings: number;
    deductedFeatured: number;
  }>;
  remainingAfter: {
    totalRemainingListings: number;
    totalRemainingFeatured: number;
  };
};

export async function consumeQuotaFIFO(params: {
  tx: TxClient;
  userId: string;
  needListings: number; // usually 1
  needFeatured: number; // 1 if featured listing, else 0
}): Promise<QuotaConsumeResult> {
  const { tx, userId, needListings, needFeatured } = params;

  if (needListings < 0 || needFeatured < 0) {
    throw new Error("needListings/needFeatured must be >= 0");
  }
  if (needListings === 0 && needFeatured === 0) {
    // Return actual totals anyway (helpful + deterministic)
    const now0 = new Date();
    const after0 = await tx.subscription.aggregate({
      where: { userId, isActive: true, expiresAt: { gt: now0 } },
      _sum: { remainingListings: true, remainingFeatured: true },
    });
    return {
      consumedFrom: [],
      remainingAfter: {
        totalRemainingListings: after0._sum.remainingListings ?? 0,
        totalRemainingFeatured: after0._sum.remainingFeatured ?? 0,
      },
    };
  }

  const now = new Date();

  // FIFO: earliest expiry first
  const subs = await tx.subscription.findMany({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: now },
      OR: [{ remainingListings: { gt: 0 } }, { remainingFeatured: { gt: 0 } }],
    },
    orderBy: { expiresAt: "asc" },
    select: {
      id: true,
      remainingListings: true,
      remainingFeatured: true,
      expiresAt: true,
    },
  });

  const totalListings = subs.reduce((a, s) => a + (s.remainingListings ?? 0), 0);
  const totalFeatured = subs.reduce((a, s) => a + (s.remainingFeatured ?? 0), 0);

  if (needListings > totalListings) {
    const err: any = new Error("INSUFFICIENT_LISTING_QUOTA");
    err.code = "INSUFFICIENT_LISTING_QUOTA";
    err.meta = { need: needListings, have: totalListings };
    throw err;
  }
  if (needFeatured > totalFeatured) {
    const err: any = new Error("INSUFFICIENT_FEATURED_QUOTA");
    err.code = "INSUFFICIENT_FEATURED_QUOTA";
    err.meta = { need: needFeatured, have: totalFeatured };
    throw err;
  }

  let remainingToDeductListings = needListings;
  let remainingToDeductFeatured = needFeatured;

  const consumedFrom: QuotaConsumeResult["consumedFrom"] = [];

  for (const s of subs) {
    if (remainingToDeductListings === 0 && remainingToDeductFeatured === 0) break;

    const canTakeListings = Math.min(s.remainingListings ?? 0, remainingToDeductListings);
    const canTakeFeatured = Math.min(s.remainingFeatured ?? 0, remainingToDeductFeatured);

    if (canTakeListings === 0 && canTakeFeatured === 0) continue;

    const updated = await tx.subscription.update({
      where: { id: s.id },
      data: {
        remainingListings: (s.remainingListings ?? 0) - canTakeListings,
        remainingFeatured: (s.remainingFeatured ?? 0) - canTakeFeatured,
        isActive: true,
      },
      select: { id: true },
    });

    consumedFrom.push({
      subscriptionId: updated.id,
      deductedListings: canTakeListings,
      deductedFeatured: canTakeFeatured,
    });

    remainingToDeductListings -= canTakeListings;
    remainingToDeductFeatured -= canTakeFeatured;
  }

  const after = await tx.subscription.aggregate({
    where: { userId, isActive: true, expiresAt: { gt: now } },
    _sum: { remainingListings: true, remainingFeatured: true },
  });

  return {
    consumedFrom,
    remainingAfter: {
      totalRemainingListings: after._sum.remainingListings ?? 0,
      totalRemainingFeatured: after._sum.remainingFeatured ?? 0,
    },
  };
}