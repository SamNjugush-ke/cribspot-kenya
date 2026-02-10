//backend/src/controllers/message.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { ConversationType, ParticipantRole, Role } from "@prisma/client";
import { io } from "../socket/server"; // uses your existing Socket.IO init

/** Small helper */
function now() { return new Date(); }

async function ensureDirectThread(a: string, b: string, subject?: string) {
  // Find an existing DIRECT with exactly participants a & b
  const existing = await prisma.conversation.findFirst({
    where: {
      type: ConversationType.DIRECT,
      participants: {
        every: { userId: { in: [a, b] } },
      },
    },
    include: { participants: true },
  });

  if (existing && existing.participants.length === 2) return existing;

  // Create new
  return prisma.conversation.create({
    data: {
      type: ConversationType.DIRECT,
      subject,
      participants: {
        create: [
          { userId: a, role: ParticipantRole.MEMBER },
          { userId: b, role: ParticipantRole.MEMBER },
        ],
      },
    },
  });
}

async function ensureSupportThread(userId: string, subject?: string) {
  // SUPPORT thread per user (one open thread)
  const existing = await prisma.conversation.findFirst({
    where: {
      type: ConversationType.SUPPORT,
      participants: { some: { userId } },
    },
  });
  if (existing) return existing;

  // Find an admin to “own” the thread (any is fine)
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } as any },
    select: { id: true },
  });


const participants: { userId: string; role: "MEMBER" | "ADMIN" }[] = [
  { userId, role: "MEMBER" },
];
if (admin) participants.push({ userId: admin.id, role: "ADMIN" });

return prisma.conversation.create({
  data: {
    type: ConversationType.SUPPORT,
    subject: subject ?? "Support",
    participants: { create: participants },
  },
});


  return prisma.conversation.create({
    data: {
      type: ConversationType.SUPPORT,
      subject: subject ?? "Support",
      participants: { create: participants },
    },
  });
}

/** GET /api/messages/threads */
export const listThreads = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id!;
    const threads = await prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { updatedAt: "desc" },
      include: {
        participants: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
        messages: { orderBy: { sentAt: "desc" }, take: 1 },
      },
    });

    // Compute unread per thread
    const data = await Promise.all(threads.map(async (t) => {
      const me = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: t.id, userId } },
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
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to load threads", error: err });
  }
};

/** GET /api/messages/unread-count */
export const userUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id!;
    const parts = await prisma.conversationParticipant.findMany({
      where: { userId },
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
    res.status(500).json({ message: "Failed to compute unread", error: err });
  }
};

/** POST /api/messages/threads  body: { toUserId?, propertyId?, type?, subject? } */
export const startDirectOrSupportThread = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id!;
    const { toUserId, propertyId, type, subject } = req.body as {
      toUserId?: string; propertyId?: string; type?: "DIRECT"|"SUPPORT"|"GROUP"; subject?: string
    };

    let convo;
    if (type === "SUPPORT" || (!toUserId && !propertyId)) {
      convo = await ensureSupportThread(userId, subject);
    } else if (toUserId) {
      convo = await ensureDirectThread(userId, toUserId, subject);
    } else if (propertyId) {
      // DM with the lister for a property
      const prop = await prisma.property.findUnique({ where: { id: propertyId }, select: { listerId: true } });
      if (!prop) return res.status(404).json({ message: "Property not found" });
      const base = await ensureDirectThread(userId, prop.listerId, subject ?? "Property inquiry");
      convo = await prisma.conversation.update({
        where: { id: base.id },
        data: { propertyId },
      });
    } else {
      return res.status(400).json({ message: "Provide toUserId or propertyId or type=SUPPORT" });
    }

    const full = await prisma.conversation.findUnique({
      where: { id: convo.id },
      include: {
        participants: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
        messages: { orderBy: { sentAt: "desc" }, take: 20 },
      },
    });

    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ message: "Failed to start thread", error: err });
  }
};

/** GET /api/messages/threads/:id */
export const getThread = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id!;
    const { id } = req.params;

    // Auth: must be a participant
    const part = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId } },
    });
    if (!part) return res.status(403).json({ message: "Not a participant" });

    const convo = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
        messages: { orderBy: { sentAt: "asc" }, take: 100 }, // simple page
      },
    });
    res.json(convo);
  } catch (err) {
    res.status(500).json({ message: "Failed to load thread", error: err });
  }
};

/** POST /api/messages/threads/:id/messages  body: { content } */
export const postMessageToThread = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id!;
    const { id } = req.params;
    const { content } = req.body as { content?: string };

    if (!content || !content.trim()) return res.status(400).json({ message: "content required" });

    const part = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId } },
      include: { conversation: true },
    });
    if (!part) return res.status(403).json({ message: "Not a participant" });

    // For “legacy” fields, pick a receiver as “the other participant” in a DIRECT thread
    let receiverId = userId;
    if (part.conversation.type === "DIRECT") {
      const p = await prisma.conversationParticipant.findMany({
        where: { conversationId: id, userId: { not: userId } },
        select: { userId: true },
      });
      receiverId = p[0]?.userId ?? userId;
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

    // Socket push to all participants
    io.to(`convo:${id}`).emit("msg:new", { conversationId: id, message: msg });

    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ message: "Failed to send message", error: err });
  }
};

/** POST /api/messages/threads/:id/read */
export const markThreadRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id!;
    const { id } = req.params;

    const part = await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId } },
      data: { lastReadAt: now() },
    });

    io.to(`user:${userId}`).emit("msg:read", { conversationId: id, userId });

    res.json({ ok: true, lastReadAt: part.lastReadAt });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark read", error: err });
  }
};

export const listBroadcasts = async (req: Request, res: Response) => {
  try {
    const rows = await prisma.conversation.findMany({
      where: { type: ConversationType.BROADCAST },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        participants: {
          where: { role: ParticipantRole.ADMIN },
          include: { user: { select: { id: true, email: true, name: true } } },
          take: 1,
        },
        messages: { orderBy: { sentAt: "desc" }, take: 1 },
      },
    });

    const out = rows.map((c) => {
      const actor = c.participants?.[0]?.user;
      const last = c.messages?.[0];
      return {
        id: c.id,
        subject: c.subject,
        createdAt: c.createdAt,
        actorId: actor?.id,
        actorEmail: actor?.email,
        preview: last?.content ? String(last.content).slice(0, 140) : "",
      };
    });

    res.json(out);
  } catch (err) {
    res.status(500).json({ message: "Failed to list broadcasts", error: err });
  }
};


/** POST /api/messages/broadcast  (ADMIN) */
export const adminBroadcast = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.id!;
    const { subject, content, role } = req.body as { subject?: string; content?: string; role?: Role };

    if (!content?.trim()) return res.status(400).json({ message: "content required" });

    const targets = await prisma.user.findMany({
      where: role ? { role: role as any } : {},
      select: { id: true },
      take: 5000, // sanity
    });

    // One broadcast conversation per admin (you), with ADMIN role
    const broadcast = await prisma.conversation.create({
      data: {
        type: ConversationType.BROADCAST,
        subject: subject ?? "Announcement",
        participants: { create: [{ userId: adminId, role: ParticipantRole.ADMIN }] },
      },
    });

    // Send N messages (fan-out)
    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: broadcast.id,
          senderId: adminId,
          receiverId: adminId, // legacy; not used
          content: content.trim(),
        },
      }),
      ...targets.map(t => prisma.alert.create({
        data: {
          userId: t.id,
          email: "",        // optional; you already have Alerts model
          location: null,   // not used here
        },
      })),
    ]);

    io.emit("msg:broadcast", { conversationId: broadcast.id });

    res.status(201).json({ id: broadcast.id, recipients: targets.length });
  } catch (err) {
    res.status(500).json({ message: "Broadcast failed", error: err });
  }

  
};
