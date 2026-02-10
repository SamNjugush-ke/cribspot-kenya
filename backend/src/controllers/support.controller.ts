//backend/src/controllers/support.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import crypto from "crypto";

// Helper: generate human-readable ticket numbers
function generateTicketNumber() {
  return "TCK-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

// POST /api/support/tickets
export const createTicket = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { subject, category, message } = req.body;
    if (!message) return res.status(400).json({ message: "Message required" });

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber: generateTicketNumber(),
        subject: subject || "Support Request",
        category: category || "General",
        createdById: userId,
        messages: {
          create: { senderId: userId, content: message },
        },
      },
      include: { messages: { include: { sender: true } } },
    });

    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ message: "Failed to create ticket", error: err });
  }
};

// GET /api/support/tickets
export const listTickets = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    let where: any = {};
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      // see all
    } else {
      where.createdById = user.id;
    }

    const tickets = await prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: "Failed to list tickets", error: err });
  }
};

// GET /api/support/tickets/:id
export const getTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: { include: { sender: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } },
        createdBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    if (!ticket) return res.status(404).json({ message: "Not found" });

    if (
      user.role !== "ADMIN" &&
      user.role !== "SUPER_ADMIN" &&
      ticket.createdById !== user.id
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(ticket);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch ticket", error: err });
  }
};

// POST /api/support/tickets/:id/messages
export const replyToTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { content } = req.body;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (!content) return res.status(400).json({ message: "Message required" });

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    // Admin can assign themselves automatically
    if ((user.role === "ADMIN" || user.role === "SUPER_ADMIN") && !ticket.assignedToId) {
      await prisma.supportTicket.update({
        where: { id },
        data: { assignedToId: user.id },
      });
    }

    const msg = await prisma.supportMessage.create({
      data: { ticketId: id, senderId: user.id, content },
      include: { sender: true },
    });

    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ message: "Failed to reply", error: err });
  }
};

// PATCH /api/support/tickets/:id/status
export const changeTicketStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (
      user.role !== "ADMIN" &&
      user.role !== "SUPER_ADMIN" &&
      ticket.createdById !== user.id
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { status },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update status", error: err });
  }
};
