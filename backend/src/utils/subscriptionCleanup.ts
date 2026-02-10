// src/utils/subscriptionCleanup.ts
import prisma from "./prisma";

export const deactivateExpiredSubscriptions = async () => {
  const now = new Date();

  // 1) Find expired subs that are still active
  const expiredSubs = await prisma.subscription.findMany({
    where: {
      expiresAt: { lt: now },
      isActive: true,
    },
    select: { id: true, userId: true },
  });

  if (!expiredSubs.length) {
    console.log("✔ Cleaned up 0 expired subscriptions.");
    return;
  }

  const expiredSubIds = expiredSubs.map(s => s.id);
  const affectedUserIds = Array.from(new Set(expiredSubs.map(s => s.userId)));

  // 2) Deactivate the expired subs
  await prisma.subscription.updateMany({
    where: { id: { in: expiredSubIds } },
    data: { isActive: false },
  });

  // 3) Determine which affected users STILL have any active subscription remaining
  const stillActive = await prisma.subscription.findMany({
    where: {
      userId: { in: affectedUserIds },
      isActive: true,
      expiresAt: { gt: now },
    },
    select: { userId: true },
  });

  const stillActiveUserIds = new Set(stillActive.map(s => s.userId));
  const usersWithNoActiveSubs = affectedUserIds.filter(uid => !stillActiveUserIds.has(uid));

  // 4) Only unpublish for users who have NO active subs remaining
  if (usersWithNoActiveSubs.length) {
    await prisma.property.updateMany({
      where: { listerId: { in: usersWithNoActiveSubs } },
      data: {
        status: "UNPUBLISHED",
        consumedSlot: false,
      },
    });
  }

  console.log(
    `✔ Cleaned up ${expiredSubs.length} expired subscriptions. Unpublished for ${usersWithNoActiveSubs.length} users with no active subs.`
  );
};