// src/jobs/scheduler.ts
import cron from "node-cron";
import prisma from "../utils/prisma";
import { Notifications } from "../services/notification.service";
import { expireStalePayments } from "./paymentsTTL";
import { deactivateExpiredSubscriptions } from "../utils/subscriptionCleanup";


// DAILY 02:00 – expire subs, auto-unpublish listings, send expirations
cron.schedule("0 2 * * *", async () => {
  const now = new Date();

await prisma.property.updateMany({
  where: { featured: true, featuredUntil: { lt: new Date() } },
  data: { featured: false, featuredUntil: null },
});


  // expire subs
  const toExpire = await prisma.subscription.findMany({
    where: { isActive: true, expiresAt: { lt: now } },
    include: { user: true, plan: true },
  });

  for (const sub of toExpire) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { isActive: false },
    });

    // auto-unpublish all listings for this lister
    await prisma.property.updateMany({
      where: { listerId: sub.userId, status: "PUBLISHED" },
      data: { status: "UNPUBLISHED" },
    });

    await Notifications.subscriptionExpired(sub.user, sub as any);
  }

  // expiring soon (T-7, T-3, T-1)
  const days = [7, 3, 1];
  for (const d of days) {
    const from = new Date(now);
    const to = new Date(now);
    from.setDate(from.getDate() + d);
    to.setDate(to.getDate() + d);
    // +/- 24h window
    const expiring = await prisma.subscription.findMany({
      where: {
        isActive: true,
        expiresAt: { gte: from, lt: new Date(from.getTime() + 24 * 3600 * 1000) },
      },
      include: { user: true, plan: true },
    });
    for (const sub of expiring) {
      await Notifications.subscriptionExpiring(sub.user, sub as any, d);
    }
  }
});

// WEEKLY SUN 08:00 – digest (simple example)
cron.schedule("0 8 * * 0", async () => {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const newProps = await prisma.property.findMany({
    where: { status: "PUBLISHED", createdAt: { gte: since } },
    select: { title: true, location: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const html =
    newProps.length === 0
      ? "<p>No new listings this week.</p>"
      : `<h3>New listings</h3><ul>${newProps
          .map((p) => `<li>${p.title} — ${p.location}</li>`)
          .join("")}</ul>`;

  // send to all alert subscribers (or all users; adjust as needed)
  const recipients = await prisma.alert.findMany({
    select: { email: true },
    distinct: ["email"],
  });

  const to = recipients.map((r) => r.email).filter(Boolean);
  if (to.length) {
    await Notifications.broadcast(to, "Weekly rentals digest", html);
  }
});

  cron.schedule("*/15 * * * *", async () => {
    const now = new Date();
    const expired = await prisma.listingBoost.findMany({
      where: { status: "ACTIVE", endsAt: { lt: now } },
      select: { id: true, propertyId: true },
    });

    if (expired.length) {
      const ids = expired.map(e => e.id);
      await prisma.$transaction([
        prisma.listingBoost.updateMany({
          where: { id: { in: ids } }, data: { status: "EXPIRED" },
        }),
        prisma.property.updateMany({
          where: { id: { in: expired.map(e => e.propertyId) } },
          data: { featured: false },
        }),
      ]);
    }
  });

export function startSchedulers() {
  // this file auto-registers its cron jobs on import;
  // keeping a function in case you want to toggle later
  cron.schedule("*/10 * * * *", () => expireStalePayments());
  cron.schedule("*/15 * * * *", () => deactivateExpiredSubscriptions());
}