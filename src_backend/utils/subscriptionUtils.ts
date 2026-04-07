// backend/src/utils/subscriptionUtils.ts
import prisma from "./prisma";

export type ActiveSubsAggregate = {
  userId: string;
  now: string;
  subscriptions: Array<{
    id: string;
    planId: string;
    startedAt: Date;
    expiresAt: Date;
    remainingListings: number;
    remainingFeatured: number;
    isActive: boolean;
    plan: {
      id: string;
      name: string;
      price: number;
      durationInDays: number;
      totalListings: number;
      featuredListings: number;
      isActive: boolean;
    };
  }>;
  aggregate: {
    activeCount: number;
    remainingListings: number;
    remainingFeatured: number;
    totalListings: number;     // sum of plan.totalListings across active subs
    totalFeatured: number;     // sum of plan.featuredListings across active subs
    expiresAtSoonest: string | null;
  };
  primary: ActiveSubsAggregate["subscriptions"][number] | null; // soonest-expiring active sub
};

export const getActiveSubscription = async (userId: string): Promise<ActiveSubsAggregate> => {
  const now = new Date();

  const subscriptions = await prisma.subscription.findMany({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: now },
    },
    orderBy: { expiresAt: "asc" }, // FIFO: soonest expiry first
    include: { plan: true },
  });

  const aggregate = subscriptions.reduce(
    (acc, s) => {
      acc.activeCount += 1;
      acc.remainingListings += s.remainingListings ?? 0;
      acc.remainingFeatured += s.remainingFeatured ?? 0;

      // totals from plan definitions (useful for UI)
      acc.totalListings += s.plan?.totalListings ?? 0;
      acc.totalFeatured += s.plan?.featuredListings ?? 0;
      return acc;
    },
    {
      activeCount: 0,
      remainingListings: 0,
      remainingFeatured: 0,
      totalListings: 0,
      totalFeatured: 0,
      expiresAtSoonest: subscriptions[0]?.expiresAt ? subscriptions[0].expiresAt.toISOString() : null,
    }
  );

  return {
    userId,
    now: now.toISOString(),
    subscriptions: subscriptions as any,
    aggregate,
    primary: (subscriptions[0] as any) ?? null,
  };
};

export const getPublishedCount = async (userId: string) => {
  return prisma.property.count({
    where: {
      listerId: userId,
      status: "PUBLISHED",
    },
  });
};