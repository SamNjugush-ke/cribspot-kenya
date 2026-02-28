// backend/src/controllers/message.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { ConversationType, ParticipantRole, Role } from "@prisma/client";
import { io } from "../socket/server";

/**
 * Communication module v2
 * - DIRECT: two-way messages between users
 * - BROADCAST: one-way admin announcements (rendered as Notifications)
 *
 * NOTE: We enforce "no replies" for BROADCAST:
 *   Only ADMIN/SUPER_ADMIN can post messages into BROADCAST threads.
 */

function now() {
  return new Date();
}

function isAdminRole(role?: any) {
  const r = String(role || "").toUpperCase();
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

async function ensureDirectThread(a: string, b: string, subject?: string) {
  // Find DIRECT with exactly a & b (2 participants)
  const existing = await prisma.conversation.findFirst({
    where: {
      type: ConversationType.DIRECT,
      participants: { some: { userId: a } },
      AND: [{ participants: { some: { userId: b } } }],
    },
    include: { participants: true },
    orderBy: { updatedAt: "desc" },
  });

  if (existing && existing.participants.length === 2) return existing;

  return prisma.conversation.create({
    data: {
      type: ConversationType.DIRECT,
      subject: subject || null,
      participants: {
        create: [
          { userId: a, role: ParticipantRole.MEMBER },
          { userId: b, role: ParticipantRole.MEMBER },
        ],
      },
    },
  });
}

/**
 * GET /api/messages/threads?type=DIRECT|BROADCAST
 * - DIRECT: inbox threads
 * - BROADCAST: user notifications
 */
export const listThreads = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const type = String(req.query.type || "DIRECT").toUpperCase();
    const convoType =
      type === "BROADCAST" ? ConversationType.BROADCAST : ConversationType.DIRECT;

    const threads = await prisma.conversation.findMany({
      where: {
        type: convoType,
        participants: { some: { userId } },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        messages: { orderBy: { sentAt: "desc" }, take: 1 },
      },
      take: 100,
    });

    const out = await Promise.all(
      threads.map(async (t) => {
        const me = await prisma.conversationParticipant.findUnique({
          where: { conversationId_userId: { conversationId: t.id, userId } },
          select: { lastReadAt: true },
        });
        const lastRead = me?.lastReadAt ?? new Date(0);

        const unread = await prisma.message.count({
          where: {
            conversationId: t.id,
            sentAt: { gt: lastRead },
            senderId: { not: userId },
          },
        });

        return { ...t, unread };
      })
    );

    res.json(out);
  } catch (err) {
    res.status(500).json({ message: "Failed to load threads", error: String(err) });
  }
};

/**
 * GET /api/messages/unread-count?type=DIRECT|BROADCAST
 */
export const userUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const type = String(req.query.type || "DIRECT").toUpperCase();
    const convoType =
      type === "BROADCAST" ? ConversationType.BROADCAST : ConversationType.DIRECT;

    const parts = await prisma.conversationParticipant.findMany({
      where: {
        userId,
        conversation: { type: convoType },
      },
      select: { conversationId: true, lastReadAt: true },
    });

    let total = 0;
    for (const p of parts) {
      const count = await prisma.message.count({
        where: {
          conversationId: p.conversationId,
          sentAt: { gt: p.lastReadAt ?? new Date(0) },
          senderId: { not: userId },
        },
      });
      total += count;
    }

    res.json({ unread: total });
  } catch (err) {
    res.status(500).json({ message: "Failed to compute unread", error: String(err) });
  }
};

/**
 * GET /api/messages/threads/:id
 * Participant-only read
 */
export const getThread = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;

    const part = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId } },
    });
    if (!part) return res.status(403).json({ message: "Not a participant" });

    const convo = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        messages: { orderBy: { sentAt: "asc" }, take: 200 },
      },
    });

    res.json(convo);
  } catch (err) {
    res.status(500).json({ message: "Failed to load thread", error: String(err) });
  }
};

/**
 * POST /api/messages/threads/:id/messages
 * body: { content }
 *
 * - DIRECT: allowed for participants
 * - BROADCAST: ONLY admins can post (no replies from recipients)
 */
export const postMessageToThread = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { content } = req.body as { content?: string };

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "content required" });
    }

    const part = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId } },
      include: { conversation: true },
    });
    if (!part) return res.status(403).json({ message: "Not a participant" });

    if (part.conversation.type === ConversationType.BROADCAST && !isAdminRole(role)) {
      return res.status(403).json({ message: "Broadcasts cannot be replied to." });
    }

    // receiverId is legacy; for DIRECT we set "the other participant", else senderId
    let receiverId = userId;
    if (part.conversation.type === ConversationType.DIRECT) {
      const other = await prisma.conversationParticipant.findFirst({
        where: { conversationId: id, userId: { not: userId } },
        select: { userId: true },
      });
      receiverId = other?.userId ?? userId;
    }

    const msg = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: userId,
        receiverId,
        content: content.trim(),
      },
    });

    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: now() },
    });

    io.to(`convo:${id}`).emit("msg:new", { conversationId: id, message: msg });
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ message: "Failed to send message", error: String(err) });
  }
};

/**
 * POST /api/messages/threads/:id/read
 */
export const markThreadRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;

    const part = await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId } },
      data: { lastReadAt: now() },
    });

    io.to(`user:${userId}`).emit("msg:read", { conversationId: id, userId });
    res.json({ ok: true, lastReadAt: part.lastReadAt });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark read", error: String(err) });
  }
};

/**
 * POST /api/messages/start-direct
 * body: { email, subject? }
 * Validates recipient by email (no hints) and opens/creates DIRECT convo.
 */
export const startDirectByEmail = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { email, subject } = req.body as { email?: string; subject?: string };
    const toEmail = String(email || "").trim().toLowerCase();
    if (!toEmail) return res.status(400).json({ message: "email required" });

    const target = await prisma.user.findUnique({
      where: { email: toEmail },
      select: { id: true },
    });
    if (!target?.id) return res.status(404).json({ message: "No such user" });

    if (target.id === userId) return res.status(400).json({ message: "Cannot message yourself" });

    const convo = await ensureDirectThread(userId, target.id, subject);

    const full = await prisma.conversation.findUnique({
      where: { id: convo.id },
      include: {
        participants: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
        messages: { orderBy: { sentAt: "asc" }, take: 200 },
      },
    });

    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ message: "Failed to start message", error: String(err) });
  }
};

/**
 * GET /api/messages/validate-recipient?email=
 * Returns { ok: true } if exists (no hints / no suggestions).
 */
export const validateRecipientEmail = async (req: Request, res: Response) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "email required" });

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user?.id) return res.status(404).json({ ok: false });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to validate recipient", error: String(err) });
  }
};

/**
 * POST /api/messages/broadcast  (ADMIN/SUPER_ADMIN)
 * body:
 *  - subject?
 *  - content (required)
 *  - role? (optional single role audience)
 *  - userIds? (optional array to target specific users)
 *
 * Creates a BROADCAST conversation with participants = recipients (MEMBER) + sender (ADMIN)
 * Then adds ONE message.
 */
export const adminBroadcast = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.id;
    const role = req.user?.role;
    if (!adminId) return res.status(401).json({ message: "Unauthorized" });
    if (!isAdminRole(role)) return res.status(403).json({ message: "Forbidden" });

    const body = req.body as {
      subject?: string;
      content?: string;
      audienceRole?: Role;
      userIds?: string[];
    };

    const content = String(body.content || "").trim();
    if (!content) return res.status(400).json({ message: "content required" });

    const audienceRole = body.audienceRole;
    const userIds = Array.isArray(body.userIds) ? body.userIds.filter(Boolean) : [];

    let targets: { id: string }[] = [];
    if (userIds.length > 0) {
      targets = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true },
        take: 5000,
      });
    } else if (audienceRole) {
      targets = await prisma.user.findMany({
        where: { role: audienceRole as any },
        select: { id: true },
        take: 5000,
      });
    } else {
      // if no audience filters, default: ALL users (still capped)
      targets = await prisma.user.findMany({
        select: { id: true },
        take: 5000,
      });
    }

    // Ensure we don't add sender twice if included in targets
    const uniqueTargetIds = Array.from(new Set(targets.map((t) => t.id).filter((x) => x !== adminId)));

    const convo = await prisma.conversation.create({
      data: {
        type: ConversationType.BROADCAST,
        subject: body.subject?.trim() || "Announcement",
        participants: {
          create: [
            { userId: adminId, role: ParticipantRole.ADMIN },
            ...uniqueTargetIds.map((id) => ({ userId: id, role: ParticipantRole.MEMBER })),
          ],
        },
      },
    });

    const msg = await prisma.message.create({
      data: {
        conversationId: convo.id,
        senderId: adminId,
        receiverId: adminId, // legacy field; ignored for broadcast
        content,
      },
    });

    // push to recipients (UI will pull unread counts)
    io.emit("broadcast:new", { conversationId: convo.id, messageId: msg.id });

    res.status(201).json({ id: convo.id, recipients: uniqueTargetIds.length });
  } catch (err) {
    res.status(500).json({ message: "Broadcast failed", error: String(err) });
  }
};

// ADD THIS EXPORT in backend/src/controllers/message.controller.ts
export const validateRecipient = async (req: Request, res: Response) => {
  try {
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "email is required" });

    const meId = req.user?.id;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (meId && user.id === meId)
      return res.status(400).json({ message: "You cannot message yourself." });

    return res.json({ user });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to validate recipient", error: String(err?.message || err) });
  }
};