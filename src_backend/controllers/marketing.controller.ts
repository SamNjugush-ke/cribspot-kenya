//backend/src/controllers/marketing.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";

export const boostListing = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;            // property id
    const { days = 7 } = req.body;        // paid days
    const until = new Date();
    until.setDate(until.getDate() + Number(days));

    const updated = await prisma.property.update({
      where: { id },
      data: { featured: true, featuredUntil: until },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to boost listing", error: err });
  }
};