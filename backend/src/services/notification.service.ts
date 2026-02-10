// src/services/notification.service.ts
import { User, Property, Subscription, SubscriptionPlan } from "@prisma/client";
import { sendMail } from "../utils/mailer";

const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

export const Notifications = {
  async welcome(user: Pick<User, "email" | "name">) {
    await sendMail({
      to: user.email,
      subject: "Welcome to CribSpot Kenya",
      html: `<p>Hi ${user.name || "there"},</p>
             <p>Welcome to CribSpot Kenya. Start listing or find your next home.</p>
             <p><a href="${APP_BASE_URL}">Open CribSpot Kenya</a></p>`,
    });
  },

  async subscriptionPurchased(
    user: Pick<User, "email" | "name">,
    sub: Subscription & { plan: SubscriptionPlan }
  ) {
    await sendMail({
      to: user.email,
      subject: `Subscription Activated: ${sub.plan.name}`,
      html: `<p>Hi ${user.name || "there"},</p>
             <p>Your <b>${sub.plan.name}</b> plan is active until <b>${sub.expiresAt.toDateString()}</b>.</p>
             <p>Listings quota: ${sub.remainingListings}/${sub.plan.totalListings}</p>`,
    });
  },

  async subscriptionExpiring(
    user: Pick<User, "email" | "name">,
    sub: Subscription & { plan: SubscriptionPlan },
    daysLeft: number
  ) {
    await sendMail({
      to: user.email,
      subject: `Your subscription expires in ${daysLeft} day(s)`,
      html: `<p>Hi ${user.name || "there"},</p>
             <p>Your <b>${sub.plan.name}</b> plan expires in ${daysLeft} day(s): <b>${sub.expiresAt.toDateString()}</b>.</p>
             <p><a href="${APP_BASE_URL}/lister/subscriptions">Renew now</a></p>`,
    });
  },

  async subscriptionExpired(
    user: Pick<User, "email" | "name">,
    sub: Subscription & { plan: SubscriptionPlan }
  ) {
    await sendMail({
      to: user.email,
      subject: "Subscription expired",
      html: `<p>Hi ${user.name || "there"},</p>
             <p>Your <b>${sub.plan.name}</b> plan has expired. Listings may be unpublished.</p>
             <p><a href="${APP_BASE_URL}/lister/subscriptions">Renew to republish</a></p>`,
    });
  },

  async propertyStatus(
    user: Pick<User, "email" | "name">,
    property: Pick<Property, "title" | "status">
  ) {
    await sendMail({
      to: user.email,
      subject: `Property status changed: ${property.title}`,
      html: `<p>Hi ${user.name || "there"},</p>
             <p>Your property <b>${property.title}</b> is now <b>${property.status}</b>.</p>`,
    });
  },

  async newMessageEmail(toEmail: string, preview: string) {
    await sendMail({
      to: toEmail,
      subject: "You have a new message",
      html: `<p>${preview}</p><p><a href="${APP_BASE_URL}/messages">Open Inbox</a></p>`,
    });
  },

  async broadcast(to: string[], subject: string, html: string) {
    // keep it simple, one batch (for real prod: chunk + BCC)
    if (to.length === 0) return;
    await sendMail({ to, subject, html });
  },
};