import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { Role, ConversationType, ParticipantRole } from "@prisma/client";
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

    // must specify roles OR userIds (not neither)
    const hasRoles = !!audience?.roles?.length;
    const hasUsers = !!audience?.userIds?.length;
    if (!hasRoles && !hasUsers) {
      return res.status(400).json({ message: "Audience must include roles[] or userIds[]" });
    }

    const resolved = await resolveAudience(audience);

    // Audit
    await auditLog(req, {
      action: "BROADCAST_SEND_REQUEST",
      targetType: "BROADCAST",
      targetId: "broadcast",
      metadata: {
        channels: { inApp: useInApp, email: useEmail },
        audience,
        resolvedCount: resolved.ids.length,
      },
    });

    let inApp = { conversationId: null as string | null, recipients: 0 };
    let email = { sent: 0 };

    // -----------------------
    // In-app broadcast
    // -----------------------
    if (useInApp) {
      const convo = await prisma.conversation.create({
        data: {
          type: ConversationType.BROADCAST,
          subject: subject ?? "Announcement",
          participants: { create: [{ userId: adminId, role: ParticipantRole.ADMIN }] },
        },
        select: { id: true },
      });

      await prisma.message.create({
        data: {
          conversationId: convo.id,
          senderId: adminId,
          receiverId: adminId, // legacy
          content: content.trim(),
        },
      });

      // If you have an Alerts/Notifications table, create per-user rows here (optional).
      // For now we just create conversation + message and rely on UI to show broadcast history.

      inApp = { conversationId: convo.id, recipients: resolved.ids.length };
    }

    // -----------------------
    // Email broadcast
    // -----------------------
    if (useEmail) {
      if (!resolved.emails.length) {
        email = { sent: 0 };
      } else {
        // render the newsletter template using content as intro
        const html = renderTemplate(TPL_NEWSLETTER, {
          title: subject ?? "Announcement",
          intro: content.trim(),
        });
        await Notifications.broadcast(resolved.emails, subject ?? "Announcement", html);
        email = { sent: resolved.emails.length };
      }
    }

    await auditLog(req, {
      action: "BROADCAST_SENT",
      targetType: "BROADCAST",
      targetId: inApp.conversationId || "email_only",
      metadata: {
        channels: { inApp: useInApp, email: useEmail },
        audience,
        inApp,
        email,
      },
    });

    res.status(201).json({
      ok: true,
      channels: { inApp: useInApp, email: useEmail },
      inApp,
      email,
      audienceCount: resolved.ids.length,
    });
  } catch (err) {
    res.status(500).json({ message: "Broadcast failed", error: err });
  }
};
