import { Request, Response } from "express";
import prisma from "../utils/prisma";

// POST /api/favorites/:propertyId
export const addFavorite = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { propertyId } = req.params;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // ensure property exists
    const prop = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!prop) return res.status(404).json({ message: "Property not found" });

    // upsert to avoid duplicates even if unique constraint not added
    const fav = await prisma.favorite.upsert({
      where: { userId_propertyId: { userId, propertyId } }, // works if @@unique exists
      create: { userId, propertyId },
      update: {},
    });

    return res.status(201).json(fav);
  } catch (err) {
    return res.status(500).json({ message: "Failed to add favorite", error: err });
  }
};

// DELETE /api/favorites/:propertyId
export const removeFavorite = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { propertyId } = req.params;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const existing = await prisma.favorite.findUnique({
      where: { userId_propertyId: { userId, propertyId } },
    });

    if (!existing) {
      return res.status(404).json({ message: "Not in favorites" });
    }

    await prisma.favorite.delete({ where: { id: existing.id } });
    return res.json({ message: "Removed from favorites" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to remove favorite", error: err });
  }
};

// POST /api/favorites/:propertyId/toggle
export const toggleFavorite = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { propertyId } = req.params;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const existing = await prisma.favorite.findUnique({
      where: { userId_propertyId: { userId, propertyId } },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      return res.json({ message: "Unfavorited", favorited: false });
    }

    await prisma.favorite.create({ data: { userId, propertyId } });
    return res.status(201).json({ message: "Favorited", favorited: true });
  } catch (err) {
    return res.status(500).json({ message: "Failed to toggle favorite", error: err });
  }
};

// GET /api/favorites/me?page=&perPage=
export const listMyFavorites = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { page = "1", perPage = "12" } = req.query as Record<string, string>;
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(perPage, 10) || 12, 1), 50);
    const skip = (p - 1) * take;

    const [items, total] = await Promise.all([
      prisma.favorite.findMany({
        where: { userId },
        include: {
          property: {
            include: {
              images: true,
              units: true,
            },
          },
        },
        orderBy: { id: "desc" },
        skip,
        take,
      }),
      prisma.favorite.count({ where: { userId } }),
    ]);

    // Map to a frontend-friendly shape (optional)
    const mapped = items.map((f) => {
      const cover = f.property.images[0]?.url ?? null;
      const minRent = f.property.units.length
        ? Math.min(...f.property.units.map((u) => u.rent))
        : null;

      return {
        favoriteId: f.id,
        propertyId: f.property.id,
        title: f.property.title,
        location: f.property.location,
        status: f.property.status,
        featured: f.property.featured,
        coverImage: cover,
        minRent,
      };
    });

    return res.json({
      items: mapped,
      pagination: { page: p, perPage: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch favorites", error: err });
  }
};