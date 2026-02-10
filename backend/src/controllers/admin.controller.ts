//src/controllers/admin.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";

// List all users
export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true, 
        isBanned: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users", error: err });
  }
};

// Change user role
export const updateUserRole = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newRole } = req.body;

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: { role: newRole },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update role", error: err });
  }
};

// Ban or unban user
export const toggleBanUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isBanned } = req.body;

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: { isBanned },
    });
    res.json({ message: `User ${isBanned ? "banned" : "unbanned"} successfully.` });
  } catch (err) {
    res.status(500).json({ message: "Failed to update user ban status", error: err });
  }
};