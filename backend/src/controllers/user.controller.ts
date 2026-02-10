import { Request, Response } from "express";
import prisma from "../utils/prisma";

/**
 * PATCH /api/users/:id
 * Update own profile (name, phone).
 * Only the user themselves can update.
 */
export const updateMyProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId || userId !== id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { name, phone } = req.body as { name?: string; phone?: string };

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile", error: err });
  }
};
