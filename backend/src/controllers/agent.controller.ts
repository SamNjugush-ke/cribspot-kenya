//controllers/agent.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { AgentStatus } from "@prisma/client";

/**
 * GET /api/agents
 * Public list of APPROVED agent profiles, with optional location filter + pagination
 */
export const getApprovedAgents = async (req: Request, res: Response) => {
  try {
    const { location, page = "1", perPage = "12" } = req.query as Record<string, string>;
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(perPage, 10) || 12, 1), 50);
    const skip = (p - 1) * take;

    const where = {
      status: AgentStatus.APPROVED,
      ...(location
        ? { location: { contains: String(location), mode: "insensitive" as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.agentProfile.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take,
        include: {
          user: { select: { id: true, name: true } },
        },
      }),
      prisma.agentProfile.count({ where }),
    ]);

    return res.json({
      items,
      pagination: { page: p, perPage: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch agents", error: err });
  }
};

/**
 * GET /api/agents/:id
 * Public get – only returns if APPROVED
 */
export const getAgentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await prisma.agentProfile.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!profile || profile.status !== AgentStatus.APPROVED) {
      return res.status(404).json({ message: "Agent not found" });
    }
    return res.json(profile);
  } catch (err) {
    return res.status(500).json({ message: "Failed to load agent", error: err });
  }
};

/**
 * GET /api/agents/me
 * Lister/Agent can view their own profile (any status)
 */
export const getMyAgentProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const profile = await prisma.agentProfile.findUnique({
      where: { userId },
    });
    return res.json(profile ?? null);
  } catch (err) {
    return res.status(500).json({ message: "Failed to load your profile", error: err });
  }
};

/**
 * POST /api/agents
 * Create (or upsert) your AgentProfile. Sets status -> PENDING for review.
 * Requires role: AGENT (enforced in routes).
 */
export const upsertMyAgentProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { name, location, dailyFee, phone, whatsapp, bio } = req.body as {
      name: string;
      location?: string;
      dailyFee?: number;
      phone: string;
      whatsapp?: string;
      bio?: string;
    };

    if (!name || !phone) {
      return res.status(400).json({ message: "name and phone are required" });
    }

    const existing = await prisma.agentProfile.findUnique({ where: { userId } });

    const data = {
      name,
      location,
      dailyFee: dailyFee ?? null,
      phone,
      whatsapp,
      bio,
      status: AgentStatus.PENDING, // Any edit re-triggers approval
    };

    const saved = existing
      ? await prisma.agentProfile.update({ where: { userId }, data })
      : await prisma.agentProfile.create({ data: { ...data, userId } });

    return res.status(existing ? 200 : 201).json(saved);
  } catch (err) {
    return res.status(500).json({ message: "Failed to save agent profile", error: err });
  }
};

/**
 * PATCH /api/agents/me
 * Update your profile fields; status set back to PENDING
 * Requires role: AGENT
 */
export const updateMyAgentProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { name, location, dailyFee, phone, whatsapp, bio } = req.body as {
      name?: string;
      location?: string;
      dailyFee?: number;
      phone?: string;
      whatsapp?: string;
      bio?: string;
    };

    const profile = await prisma.agentProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const updated = await prisma.agentProfile.update({
      where: { userId },
      data: {
        name: name ?? profile.name,
        location: location ?? profile.location,
        dailyFee: typeof dailyFee === "number" ? dailyFee : profile.dailyFee,
        phone: phone ?? profile.phone,
        whatsapp: whatsapp ?? profile.whatsapp,
        bio: bio ?? profile.bio,
        status: AgentStatus.PENDING, // Editing requires re-approval
      },
    });

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: "Failed to update profile", error: err });
  }
};

/**
 * PATCH /api/agents/:id/status
 * Admin approves/rejects an agent
 */
export const adminUpdateAgentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: AgentStatus };

    if (!Object.values(AgentStatus).includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updated = await prisma.agentProfile.update({
      where: { id },
      data: { status },
      include: { user: { select: { email: true, name: true } } },
    });

    // Optional: email the agent about the decision (if you wired mailer)
    // await sendMail({
    //   to: updated.user?.email!,
    //   subject: `Agent profile ${status.toLowerCase()}`,
    //   html: `<p>Hi ${updated.user?.name}, your agent profile is now <b>${status}</b>.</p>`,
    // });

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: "Failed to change status", error: err });
  }
};