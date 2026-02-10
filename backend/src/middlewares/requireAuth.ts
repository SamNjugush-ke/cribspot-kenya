// src/middlewares/requireAuth.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../utils/prisma";

export async function requireAuth(req: any, res: any, next: any) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });

  const dbUser = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!dbUser) return res.status(401).json({ error: "Unauthorized" });

  if (dbUser.isBanned) {
    return res.status(403).json({ error: "Banned Account, contact admin" });
  }

  next();
}