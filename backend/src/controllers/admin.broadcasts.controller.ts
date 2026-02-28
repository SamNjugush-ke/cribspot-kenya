import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { Role } from "@prisma/client";
import { Notifications } from "../services/notification.service";
import { renderTemplate, TPL_NEWSLETTER } from "../utils/templates";
import { auditLog } from "../utils/audit";

type Audience = {
  roles?: Role[];
  userIds?: string[];
  onlySubscribed?: boolean;
};

async function resolveAudience(audience: Audience): Promise<{ ids: string[]; emails: string[] }> {
  let users = await prisma.user.findMany({
    where: {
      ...(audience.roles?.length ? { role: { in: audience.roles } } : {}),
      ...(audience.userIds?.length ? { id: { in: audience.userIds } } : {}),
    },
    select: { id: true, email: true },
    take: 5000,
  });

  if (audience.onlySubscribed) {
    const subs = await prisma.subscription.findMany({
      where: { isActive: true },
      select: { userId: true },
      distinct: ["userId"],
    });
    const ok = new Set(subs.map((s) => s.userId));
    users = users.filter((u) => ok.has(u.id));
  }

  return {
    ids: users.map((u) => u.id),
    emails: users.map((u) => u.email).filter(Boolean) as string[],
  };
}

/**
 * POST /api/admin/broadcasts/send
 * body:
 *  {
 *    subject?: string,
 *    content: string,
 *    channels: { inApp?: boolean, email?: boolean },
 *    audience: { roles?: Role[], userIds?: string[], onlySubscribed?: boolean }
 *  }
 */
export const sendBroadcast = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ message: "Unauthorized" });

    const {
      subject,
      content,
      channels,
      audience,
    }: {
      subject?: string;
      content: string;
      channels: { inApp?: boolean; email?: boolean };
      audience: Audience;
    } = req.body || {};

    if (!content?.trim()) return res.status(400).json({ message: "content required" });
    const useInApp = !!channels?.inApp;
    const useEmail = !!channels?.email;
    if (!useInApp && !useEmail) return res.status(400).json({ message: "Select at least one channel" });

    const hasRoles = !!audience?.roles?.length;
    const hasUsers = !!audience?.userIds?.length;
    if (!hasRoles && !hasUsers) {
      return res.status(400).json({ message: "Audience must include roles[] or userIds[]" });
    }

    const resolved = await resolveAudience(audience);

    // AUDIT: request
    await auditLog(req, {
      action: "BROADCAST_SEND_REQUEST",
      targetType: "BROADCAST",
      targetId: "broadcast",
      metadata: {
        subject: subject ?? null,
        channels: { inApp: useInApp, email: useEmail },
        audience,
        resolvedCount: resolved.ids.length,
      },
    });

    let inApp = { recipients: 0 };
    let email = { sent: 0 };

    // -----------------------
    // In-app broadcast
    // -----------------------
    if (useInApp) {
      if (resolved.ids.length) {
        // Create one Notification row per recipient.
        // This powers the bell + /dashboard/notifications.
        await prisma.notification.createMany({
          data: resolved.ids.map((uid) => ({
            userId: uid,
            title: subject?.trim() || "Announcement",
            body: content.trim(),
            link: "/dashboard/notifications",
          })),
        });
      }

      inApp = { recipients: resolved.ids.length };
    }

    // -----------------------
    // Email broadcast (BCC-style)
    // -----------------------
    if (useEmail) {
      if (!resolved.emails.length) {
        email = { sent: 0 };
      } else {
        const html = renderTemplate(TPL_NEWSLETTER, {
          title: subject ?? "Announcement",
          intro: content.trim(),
        });

        await Notifications.broadcast(resolved.emails, subject ?? "Announcement", html);
        email = { sent: resolved.emails.length };
      }
    }

    // AUDIT: sent
    await auditLog(req, {
      action: "BROADCAST_SENT",
      targetType: "BROADCAST",
      targetId: "broadcast",
      metadata: {
        subject: subject ?? null,
        contentPreview: content.trim().slice(0, 200),
        channels: { inApp: useInApp, email: useEmail },
        audience,
        inApp,
        email,
        audienceCount: resolved.ids.length,
      },
    });

    res.status(201).json({
      ok: true,
      channels: { inApp: useInApp, email: useEmail },
      inApp,
      email,
      audienceCount: resolved.ids.length,
    });
  } catch (err: any) {
    res.status(500).json({ message: "Broadcast failed", error: String(err?.message || err) });
  }
};

/**
 * GET /api/admin/broadcasts/history
 * Returns recent BROADCAST_SENT audit entries.
 */
export const listBroadcastHistory = async (req: Request, res: Response) => {
  try {
    const actorId = req.user?.id;
    if (!actorId) return res.status(401).json({ message: "Unauthorized" });

    const items = await prisma.auditLog.findMany({
      where: { action: "BROADCAST_SENT" },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { actor: { select: { id: true, email: true, name: true, role: true } } },
    });

    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to load broadcast history", error: String(err?.message || err) });
  }
};
