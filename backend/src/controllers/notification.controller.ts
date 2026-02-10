//backend/src/controllers/notification.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { Role } from "@prisma/client";
import { Notifications } from "../services/notification.service";
import { renderTemplate, TPL_NEWSLETTER } from "../utils/templates";
import { sendMail } from "../utils/mailer";

/** Helper: resolve audience to a list of recipient emails */
async function getAudienceEmails(audience?: {
  roles?: Role[];
  onlySubscribed?: boolean;
}): Promise<string[]> {
  // Base users set (filter by roles if provided)
  const users = await prisma.user.findMany({
    where: audience?.roles?.length ? { role: { in: audience.roles } } : undefined,
    select: { id: true, email: true },
  });

  // If we only want those with active subscriptions
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

/**
 * POST /api/notifications/test
 * Admin-only: send a test email to yourself (or to an explicit `to` in body)
 * Body: { to?: string }
 */
export const testEmail = async (req: Request, res: Response) => {
  try {
    let to: string | undefined = req.body?.to;

    // If no explicit recipient, use the authenticated user's email from DB
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
  } catch (err) {
    res.status(500).json({ message: "Failed to send test", error: err });
  }
};

/**
 * POST /api/notifications/broadcast/newsletter
 * Admin-only: send a templated newsletter (title + intro) to an audience.
 * Body:
 *  {
 *    "subject": "Monthly Digest",
 *    "title": "Hello, Listers!",
 *    "intro": "Here are new features...",
 *    "audience": { "roles": ["LISTER","RENTER"], "onlySubscribed": true }
 *  }
 */
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
  } catch (err) {
    res.status(500).json({ message: "Broadcast failed", error: err });
  }
};

/**
 * POST /api/notifications/broadcast/raw
 * Admin-only: send a raw HTML email to either explicit recipients or an audience filter.
 * Body:
 *  {
 *    "subject": "Hello",
 *    "html": "<p>Custom HTML</p>",
 *    "to": ["a@b.com","c@d.com"], // optional; if omitted, use `audience`
 *    "audience": { "roles": ["LISTER"], "onlySubscribed": true } // optional
 *  }
 */
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
  } catch (err) {
    res.status(500).json({ message: "Broadcast failed", error: err });
  }
};