// backend/src/controllers/support.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Prisma } from "@prisma/client";

/**
 * Uploads served by backend as /uploads (per your setup)
 * Ticket files stored under:
 *   uploads/support/tickets/<ticketId>/<filename>
 */
const RAW_PUBLIC_BASE = process.env.PUBLIC_BASE_URL || "http://localhost:4000";
function pickPublicBase(raw: string) {
  const first = raw.split(",").map((s) => s.trim()).find(Boolean);
  return first || "http://localhost:4000";
}
const PUBLIC_BASE = pickPublicBase(RAW_PUBLIC_BASE);
const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeExt(original: string) {
  const ext = path.extname(original || "").toLowerCase();
  return ext && ext.length <= 10 ? ext : "";
}

function filePublicUrl(ticketId: string, filename: string) {
  return `${PUBLIC_BASE}/uploads/support/tickets/${ticketId}/${filename}`;
}

function normalizeStatus(input: any): "OPEN" | "CLOSED" {
  const v = String(input || "").toUpperCase().trim();
  return v === "CLOSED" ? "CLOSED" : "OPEN";
}

function isAdmin(user?: any) {
  return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}

/**
 * Ticket number: CRYYMMDD### (daily sequence, best-effort)
 * Example: CR260226001
 *
 * This is "best-effort" under concurrency (works great in practice).
 * You already have @unique on ticketNumber, so collisions will be retried.
 */
async function generateTicketNumberTx(tx: Prisma.TransactionClient, when = new Date()) {
  const yy = String(when.getFullYear()).slice(-2);
  const mm = String(when.getMonth() + 1).padStart(2, "0");
  const dd = String(when.getDate()).padStart(2, "0");
  const prefix = `CR${yy}${mm}${dd}`;

  const start = new Date(when);
  start.setHours(0, 0, 0, 0);
  const end = new Date(when);
  end.setHours(23, 59, 59, 999);

  const countToday = await tx.supportTicket.count({
    where: {
      createdAt: { gte: start, lte: end },
      ticketNumber: { startsWith: prefix },
    },
  });

  const seq = String(countToday + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

/**
 * Extract multer files (supports:
 * - upload.single("file") -> req.file
 * - upload.array("files") -> req.files as File[]
 * - upload.fields(...)    -> req.files as Record<string, File[]>
 *
 * Enforces max 2 files, 5MB each.
 */
function extractFiles(req: Request): Express.Multer.File[] {
  const out: Express.Multer.File[] = [];

  const single = (req as any).file as Express.Multer.File | undefined;
  if (single) out.push(single);

  const raw = (req as any).files;

  // upload.array(...) style: req.files is File[]
  if (Array.isArray(raw)) {
    out.push(...raw);
  }
  // upload.fields(...) style: req.files is { fieldName: File[] }
  else if (raw && typeof raw === "object") {
    for (const k of Object.keys(raw)) {
      const arr = raw[k];
      if (Array.isArray(arr)) out.push(...arr);
    }
  }

  const files = out.slice(0, 2);

  for (const f of files) {
    if (f.size > 5 * 1024 * 1024) {
      throw new Error(`FILE_TOO_LARGE:${f.originalname || "file"}`);
    }
  }

  return files;
}

/**
 * Persist files to disk; return attachment rows to insert in DB
 */
function saveTicketFiles(ticketId: string, files: Express.Multer.File[]) {
  if (!files.length) return [];

  const dir = path.join(UPLOADS_ROOT, "support", "tickets", ticketId);
  ensureDirSync(dir);

  const attachments: { url: string; name?: string; size?: number; mime?: string }[] = [];

  for (const f of files) {
    const ext = safeExt(f.originalname) || "";
    const fname = crypto.randomBytes(10).toString("hex") + ext;
    const abs = path.join(dir, fname);
    fs.writeFileSync(abs, f.buffer);

    attachments.push({
      url: filePublicUrl(ticketId, fname),
      name: f.originalname || fname,
      size: f.size,
      mime: f.mimetype || "application/octet-stream",
    });
  }

  return attachments;
}

/**
 * Helper: fetch ticket + messages + attachments (returned separately by messageId)
 * We do attachments separately so this works even if you didn't add reverse relation fields
 * on SupportMessage / SupportTicket.
 */
async function hydrateTicket(ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      createdBy: { select: { id: true, name: true, email: true, role: true } },
      assignedTo: { select: { id: true, name: true, email: true, role: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });

  if (!ticket) return null;

  const attachments = await prisma.supportAttachment.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
  });

  const attachmentsByMessageId: Record<string, typeof attachments> = {};
  for (const a of attachments) {
    (attachmentsByMessageId[a.messageId] ||= []).push(a);
  }

  return { ...ticket, attachmentsByMessageId };
}

/**
 * POST /api/support/tickets
 * multipart/form-data:
 * - subject
 * - category
 * - message
 * - file (single) OR files (multiple)
 *
 * Only LISTER can create tickets.
 */
export const createTicket = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (user.role !== "LISTER") {
      return res.status(403).json({ message: "Only listers can create support tickets." });
    }

    const subject = String((req.body as any)?.subject || "").trim() || "Support Request";
    const category = String((req.body as any)?.category || "").trim() || "General";
    const message = String((req.body as any)?.message || "").trim();
    if (!message) return res.status(400).json({ message: "Message required" });

    let files: Express.Multer.File[] = [];
    try {
      files = extractFiles(req);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.startsWith("FILE_TOO_LARGE:")) {
        return res.status(400).json({ message: `File too large. Max 5MB. (${msg.split(":")[1]})` });
      }
      throw e;
    }

    // Create ticket + first message in a transaction (DB part)
    const { ticketId, firstMessageId } = await prisma.$transaction(async (tx) => {
      let tries = 0;
      let ticketNumber = await generateTicketNumberTx(tx);

      while (tries < 6) {
        try {
          const ticket = await tx.supportTicket.create({
            data: {
              ticketNumber,
              subject,
              category,
              createdById: user.id,
              status: "OPEN",
            },
          });

          const firstMsg = await tx.supportMessage.create({
            data: {
              ticketId: ticket.id,
              senderId: user.id,
              content: message,
            },
          });

          return { ticketId: ticket.id, firstMessageId: firstMsg.id };
        } catch (err: any) {
          tries++;
          // if unique collision on ticketNumber, bump suffix and retry
          const bump =
            String((Number(ticketNumber.slice(-3)) || 1) + 1 + Math.floor(Math.random() * 3)).padStart(3, "0");
          ticketNumber = ticketNumber.slice(0, -3) + bump;

          if (tries >= 6) throw err;
        }
      }

      // should never hit
      throw new Error("Failed to create ticket");
    });

    // Save files to disk (FS part)
    const saved = saveTicketFiles(ticketId, files);

    // Persist attachments (DB part)
    if (saved.length) {
      await prisma.supportAttachment.createMany({
        data: saved.map((a) => ({
          ticketId,
          messageId: firstMessageId,
          url: a.url,
          name: a.name ?? null,
          size: a.size ?? null,
          mime: a.mime ?? null,
        })),
      });

      // bump updatedAt for ticket ordering
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() },
      });
    }

    const full = await hydrateTicket(ticketId);
    return res.status(201).json(full);
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to create ticket", error: String(err?.message || err) });
  }
};

/**
 * GET /api/support/tickets?status=OPEN|CLOSED&q=...
 * - Lister: only own tickets
 * - Admin/Super: all tickets + search
 */
export const listTickets = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) return res.status(401).json({ message: "Unauthorized" });

    const status = req.query.status ? normalizeStatus(req.query.status) : undefined;
    const q = String(req.query.q || "").trim();

    const where: any = {};
    if (!isAdmin(user)) where.createdById = user.id;
    if (status) where.status = status;

    if (isAdmin(user) && q) {
      where.OR = [
        { ticketNumber: { contains: q, mode: "insensitive" } },
        { subject: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { createdBy: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const tickets = await prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        messages: { take: 1, orderBy: { createdAt: "desc" }, include: { sender: { select: { id: true, name: true, email: true, role: true } } } },
      },
      take: 500,
    });

    res.json(tickets);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to list tickets", error: String(err?.message || err) });
  }
};

/**
 * GET /api/support/tickets/:id
 */
export const getTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user?.id) return res.status(401).json({ message: "Unauthorized" });

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ message: "Not found" });

    if (!isAdmin(user) && ticket.createdById !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const full = await hydrateTicket(id);
    return res.json(full);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch ticket", error: String(err?.message || err) });
  }
};

/**
 * POST /api/support/tickets/:id/messages
 * multipart/form-data (recommended) OR JSON:
 *  - content
 *  - file OR files
 *
 * Rules:
 * - If someone replies to CLOSED ticket => OPEN again
 * - Admin/Super auto-assign themselves if unassigned
 */
export const replyToTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user?.id) return res.status(401).json({ message: "Unauthorized" });

    const content = String((req.body as any)?.content || "").trim();
    if (!content) return res.status(400).json({ message: "Message required" });

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (!isAdmin(user) && ticket.createdById !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    let files: Express.Multer.File[] = [];
    try {
      files = extractFiles(req);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.startsWith("FILE_TOO_LARGE:")) {
        return res.status(400).json({ message: `File too large. Max 5MB. (${msg.split(":")[1]})` });
      }
      throw e;
    }

    // Create message + ticket updates in transaction
    const msg = await prisma.$transaction(async (tx) => {
      // auto-assign admin/super if none assigned
      if (isAdmin(user) && !ticket.assignedToId) {
        await tx.supportTicket.update({ where: { id }, data: { assignedToId: user.id } });
      }

      // reopen if closed
      if (ticket.status === "CLOSED") {
        await tx.supportTicket.update({ where: { id }, data: { status: "OPEN" } });
      }

      const created = await tx.supportMessage.create({
        data: { ticketId: id, senderId: user.id, content },
        include: { sender: { select: { id: true, name: true, email: true, role: true } } },
      });

      await tx.supportTicket.update({ where: { id }, data: { updatedAt: new Date() } });

      return created;
    });

    // Save files to disk + persist attachments
    const saved = saveTicketFiles(id, files);
    if (saved.length) {
      await prisma.supportAttachment.createMany({
        data: saved.map((a) => ({
          ticketId: id,
          messageId: msg.id,
          url: a.url,
          name: a.name ?? null,
          size: a.size ?? null,
          mime: a.mime ?? null,
        })),
      });

      await prisma.supportTicket.update({ where: { id }, data: { updatedAt: new Date() } });
    }

    return res.status(201).json(msg);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to reply", error: String(err?.message || err) });
  }
};

/**
 * PATCH /api/support/tickets/:id/status
 * body: { status: "OPEN"|"CLOSED" }
 *
 * Admin/Super or owner can close/open.
 */
export const changeTicketStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user?.id) return res.status(401).json({ message: "Unauthorized" });

    const status = normalizeStatus((req.body as any)?.status);

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (!isAdmin(user) && ticket.createdById !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { status },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to update status", error: String(err?.message || err) });
  }
};