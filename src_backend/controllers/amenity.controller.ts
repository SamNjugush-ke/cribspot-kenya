//backend/src/controllers/amenity.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";

/** GET /api/amenities
 *  Returns all amenities (alphabetical).
 */
export const listAmenities = async (_req: Request, res: Response) => {
  try {
    const items = await prisma.amenity.findMany({
      orderBy: { name: "asc" },
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Failed to load amenities", error: err });
  }
};

/** POST /api/amenities
 *  Body: { name: string }
 *  Protected (ADMIN / SUPER_ADMIN typically) – you can tighten with your RBAC if you like.
 */
export const createAmenity = async (req: Request, res: Response) => {
  try {
    const { name } = req.body as { name?: string };
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Amenity name is required" });
    }
    const item = await prisma.amenity.create({
      data: { name: name.trim() },
    });
    res.status(201).json(item);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ message: "Amenity already exists" });
    }
    res.status(500).json({ message: "Failed to create amenity", error: err });
  }
};