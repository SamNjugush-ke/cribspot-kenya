//backend/src/controllers/notification.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { Role } from "@prisma/client";
import { Notifications } from "../services/notification.service";
import { renderTemplate, TPL_NEWSLETTER } from "../utils/templates";
import { sendMail } from "../utils/mailer";
import { auditLog } from "../utils/audit";

/** Helper: resolve audience to a list of recipient emails */
async function getAudienceEmails(audience?: {
  roles?: Role[];
  onlySubscribed?: boolean;
}): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: audience?.roles?.length ? { role: { in: audience.roles } } : undefined,
    select: { id: true, email: true },
  });

  if (audience?.onlySubscribed) {
    const subs = await prisma.subscription.findMany({
      where: { isActive: true },
      select: { userId: true },
      distinct: ["userId"],
    });
    const allowed = new Set(subs.map((s) => s.userId));
    return users.filter((u) => allowed.has(u.id)).map((u) => u.email).filter(Boolean) as string[];
  }

  return users.map((u) => u.email).filter(Boolean) as string[];
}

/** Helper: resolve audience to userIds (for in-app notifications) */
async function getAudienceUserIds(audience?: {
  roles?: Role[];
  userIds?: string[];
  onlySubscribed?: boolean;
}): Promise<string[]> {
  let users = await prisma.user.findMany({
    where: {
      ...(audience?.roles?.length ? { role: { in: audience.roles } } : {}),
      ...(audience?.userIds?.length ? { id: { in: audience.userIds } } : {}),
    },
    select: { id: true },
    take: 10000,
  });

  if (audience?.onlySubscribed) {
    const subs = await prisma.subscription.findMany({
      where: { isActive: true },
      select: { userId: true },
      distinct: ["userId"],
    });
    const allowed = new Set(subs.map((s) => s.userId));
    users = users.filter((u) => allowed.has(u.id));
  }

  return users.map((u) => u.id);
}

/**
 * ==========================
 * IN-APP NOTIFICATIONS (BELL)
 * ==========================
 */

/**
 * GET /api/notifications/mine?includeRead=true|false
 * Returns latest notifications for current user.
 */
export const listMyNotifications = async (req: Request, res: Response) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const includeRead = String(req.query.includeRead ?? "true").toLowerCase() === "true";

    const items = await prisma.notification.findMany({
      where: {
        userId: uid,
        ...(includeRead ? {} : { readAt: null }),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return res.json({ items });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to load notifications", error: String(err?.message || err) });
  }
};

/**
 * GET /api/notifications/unread-count
 */
export const unreadNotificationsCount = async (req: Request, res: Response) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const count = await prisma.notification.count({
      where: { userId: uid, readAt: null },
    });

    return res.json({ count });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to count notifications", error: String(err?.message || err) });
  }
};

/**
 * POST /api/notifications/:id/read
 */
export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;

    // Only mark if it belongs to this user
    const updated = await prisma.notification.updateMany({
      where: { id, userId: uid, readAt: null },
      data: { readAt: new Date() },
    });

    return res.json({ ok: true, updated: updated.count });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to mark read", error: String(err?.message || err) });
  }
};

/**
 * POST /api/notifications/broadcast
 * Admin-only (enforced in routes)
 * Creates Notification rows (bell system).
 * Body:
 *  { title?: string, body: string, link?: string, audience: { roles?: Role[], userIds?: string[], onlySubscribed?: boolean } }
 */
export const createInAppBroadcast = async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.id;
    if (!actorId) return res.status(401).json({ message: "Unauthorized" });

    const {
      title,
      body,
      link,
      audience,
    }: {
      title?: string;
      body: string;
      link?: string;
      audience?: { roles?: Role[]; userIds?: string[]; onlySubscribed?: boolean };
    } = req.body || {};

    if (!body?.trim()) return res.status(400).json({ message: "body required" });

    const recipientIds = await getAudienceUserIds(audience);
    if (!recipientIds.length) return res.json({ created: 0 });

    await prisma.notification.createMany({
      data: recipientIds.map((uid) => ({
        userId: uid,
        title: title?.trim() || "Announcement",
        body: body.trim(),
        link: link?.trim() || "/dashboard/notifications",
      })),
    });

    await auditLog(req, {
      action: "BROADCAST_SENT",
      targetType: "NOTIFICATION",
      targetId: "inapp",
      metadata: {
        title: title ?? null,
        link: link ?? "/dashboard/notifications",
        audience,
        recipients: recipientIds.length,
        preview: body.trim().slice(0, 200),
      },
    });

    return res.status(201).json({ created: recipientIds.length });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to broadcast", error: String(err?.message || err) });
  }
};

/**
 * ==========================
 * EMAIL HELPERS (EXISTING)
 * ==========================
 */

/**
 * POST /api/notifications/test
 * Admin-only: send a test email to yourself (or to an explicit `to` in body)
 * Body: { to?: string }
 */
export const testEmail = async (req: Request, res: Response) => {
  try {
    let to: string | undefined = req.body?.to;

    if (!to && req.user?.id) {
      const me = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { email: true },
      });
      to = me?.email;
    }

    if (!to) return res.status(400).json({ message: "No recipient email found" });

    await sendMail({ to, subject: "Test email", html: "<p>This is a test.</p>" });
    res.json({ ok: true, to });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to send test", error: String(err?.message || err) });
  }
};

export const broadcastNewsletter = async (req: Request, res: Response) => {
  try {
    const {
      subject,
      title,
      intro,
      audience,
    }: {
      subject: string;
      title: string;
      intro: string;
      audience?: { roles?: Role[]; onlySubscribed?: boolean };
    } = req.body || {};

    if (!subject || !title || !intro) {
      return res.status(400).json({ message: "subject, title and intro are required" });
    }

    const to = await getAudienceEmails(audience);
    if (to.length === 0) return res.json({ sent: 0 });

    const html = renderTemplate(TPL_NEWSLETTER, { title, intro });
    await Notifications.broadcast(to, subject, html);
    res.json({ sent: to.length });
  } catch (err: any) {
    res.status(500).json({ message: "Broadcast failed", error: String(err?.message || err) });
  }
};

export const broadcastRaw = async (req: Request, res: Response) => {
  try {
    const {
      subject,
      html,
      to: explicitTo,
      audience,
    }: {
      subject: string;
      html: string;
      to?: string[];
      audience?: { roles?: Role[]; onlySubscribed?: boolean };
    } = req.body || {};

    if (!subject || !html) {
      return res.status(400).json({ message: "subject and html are required" });
    }

    let recipients: string[] = Array.isArray(explicitTo) ? explicitTo.filter(Boolean) : [];
    if (!recipients.length) {
      recipients = await getAudienceEmails(audience);
    }
    if (!recipients.length) return res.json({ sent: 0 });

    await Notifications.broadcast(recipients, subject, html);
    res.json({ sent: recipients.length });
  } catch (err: any) {
    res.status(500).json({ message: "Broadcast failed", error: String(err?.message || err) });
  }
};