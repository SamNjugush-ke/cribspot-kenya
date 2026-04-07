// src/controllers/admin.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { Role } from "@prisma/client";

function actorRole(req: Request) {
  return String((req as any)?.user?.role || "").toUpperCase();
}

function isPrivileged(role?: string | null) {
  const r = String(role || "").toUpperCase();
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

const ADMIN_MANAGEABLE_ROLES: Role[] = [
  Role.LISTER,
  Role.RENTER,
  Role.AGENT,
  Role.EDITOR,
];

function isValidRole(value: string): value is Role {
  return Object.values(Role).includes(value as Role);
}

// List users visible to the current actor
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const role = actorRole(req);

    const where =
      role === "ADMIN"
        ? { role: { in: ADMIN_MANAGEABLE_ROLES } }
        : undefined;

    const users = await prisma.user.findMany({
      where,
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
  const nextRoleRaw = String(req.body?.role || req.body?.newRole || "").toUpperCase();
  const role = actorRole(req);

  try {
    if (!nextRoleRaw) {
      return res.status(400).json({ message: "role is required" });
    }

    if (!isValidRole(nextRoleRaw)) {
      return res.status(400).json({ message: "Invalid role provided" });
    }

    const nextRole: Role = nextRoleRaw;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (role === "ADMIN") {
      if (isPrivileged(target.role)) {
        return res.status(403).json({
          message: "Admins cannot change roles for admins or super admins",
        });
      }

      if (!ADMIN_MANAGEABLE_ROLES.includes(nextRole)) {
        return res.status(403).json({
          message: "Admins can only assign non-admin roles",
        });
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: nextRole },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isBanned: true,
        createdAt: true,
      },
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
  const role = actorRole(req);

  try {
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (role === "ADMIN" && isPrivileged(target.role)) {
      return res.status(403).json({
        message: "Admins cannot ban admins or super admins",
      });
    }

    await prisma.user.update({
      where: { id },
      data: { isBanned: !!isBanned },
    });

    res.json({
      message: `User ${isBanned ? "banned" : "unbanned"} successfully.`,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to update user ban status", error: err });
  }
};