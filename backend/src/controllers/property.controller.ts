// backend/src/controllers/property.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { getActiveSubscription, getPublishedCount } from "../utils/subscriptionUtils";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { consumeQuotaFIFO } from "../utils/subscriptionQuota";
import { ListingStatus } from "@prisma/client";

/** Helpers */
const RAW_PUBLIC_BASE = process.env.PUBLIC_BASE_URL || "http://localhost:4000";
function pickPublicBase(raw: string) {
  const first = raw.split(",").map(s => s.trim()).find(Boolean);
  return first || "http://localhost:4000";
}
const PUBLIC_BASE = pickPublicBase(RAW_PUBLIC_BASE);
const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function parseAmenityNames(input?: string | string[] | null): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.flatMap(s => s.split(",")).map(s => s.trim()).filter(Boolean);
  }
  return input.split(",").map(s => s.trim()).filter(Boolean);
}

/* =========================
   LIST / FILTER
   ========================= */

// GET /api/properties
export const getAllProperties = async (req: Request, res: Response) => {
  try {
    const {
      location,
      minPrice,
      maxPrice,
      bedrooms,
      type,
      featured,
      status,
      county,
      constituency,
      amenities,
      page,
      limit,
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const take = Math.max(1, Math.min(50, Number(limit) || 12));
    const skip = (pageNum - 1) * take;

    const amenityNames = parseAmenityNames(amenities as any);

    const where: any = {
      location: location ? { contains: String(location), mode: "insensitive" } : undefined,
      status:
        status !== undefined && String(status) !== "ALL"
          ? String(status)
          : undefined, //ALL => no status filter (admin moderation needs this)

      featured: featured !== undefined ? String(featured) === "true" : undefined,
      county: county ? String(county) : undefined,
      constituency: constituency ? String(constituency) : undefined, // now filters by constituency
    };

    const hasUnitFilters = minPrice || maxPrice || bedrooms || type;
    if (hasUnitFilters) {
      where.units = {
        some: {
          rent: {
            gte: minPrice ? Number(minPrice) : undefined,
            lte: maxPrice ? Number(maxPrice) : undefined,
          },
          bedrooms: bedrooms ? Number(bedrooms) : undefined,
          type: type ? String(type) : undefined,
        },
      };
    }

    if (amenityNames.length > 0) {
      where.AND = where.AND || [];
      for (const name of amenityNames) {
        where.AND.push({
          amenities: {
            some: {
              amenity: { name: { equals: name, mode: "insensitive" } },
            },
          },
        });
      }
    }

    const [items, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: {
          units: true,
          images: true,
          amenities: { include: { amenity: true } },
          lister: { select: { id: true, name: true, email: true, phone: true } }, // ✅ added phone
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.property.count({ where }),
    ]);

    res.json({
      items,
      total,
      page: pageNum,
      limit: take,
      pages: Math.ceil(total / take),
    });
  } catch (err) {
    res.status(500).json({ message: "Filter fetch failed", error: err });
  }
};

// GET /api/properties/:id/details
export const getPropertyDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        units: true,
        images: true,
        amenities: { include: { amenity: true } },
        lister: { select: { id: true, name: true, email: true, phone: true } }, // ✅ added phone
      },
    });
    if (!property) return res.status(404).json({ error: "Property not found" });
    res.json(property);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch property details", details: err });
  }
};

export const getPropertyById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        units: true,
        images: true,
        amenities: { include: { amenity: true } },
        lister: { select: { id: true, name: true, email: true, phone: true } }, // ✅ added phone
      },
    });
    if (!property) return res.status(404).json({ error: "Property not found" });
    res.json(property);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch property", details: err });
  }
};

export const getSimilarProperties = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const base = await prisma.property.findUnique({
      where: { id },
      include: { units: true },
    });
    if (!base) return res.status(404).json({ message: "Base property not found" });

    const county = base.county as string | undefined;
    const unitType = base.units?.[0]?.type;

    const where: any = { id: { not: id }, status: "PUBLISHED" };
    if (county) where.county = county;
    else if (base.location) where.location = { contains: base.location, mode: "insensitive" };
    if (unitType) where.units = { some: { type: unitType } };

    const similar = await prisma.property.findMany({
      where,
      include: {
        units: true,
        images: true,
        amenities: { include: { amenity: true } },
        lister: { select: { id: true, name: true, email: true, phone: true } }, 
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    res.json(similar);
  } catch (err) {
    res.status(500).json({ message: "Failed to load similar properties", error: err });
  }
};

// GET /api/properties/stats/constituencies?county=Kiambu
export const getPropertyStatsByConstituency = async (req: Request, res: Response) => {
  try {
    const { county } = req.query;
    if (!county) {
      return res.status(400).json({ message: "County is required" });
    }

    const grouped = await prisma.property.groupBy({
      by: ["constituency"],
      where: {
        status: "PUBLISHED",
        county: String(county),
      },
      _count: { id: true },
    });

    const result = grouped
      .map((g) => ({
        name: g.constituency ?? "Unknown",
        count: g._count.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)); 

    res.json(result);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to compute stats by constituency", error: err });
  }
};


/* =========================
   CREATE / UPDATE / DELETE
   ========================= */

export const createProperty = async (req: Request, res: Response) => {
  try {
    const listerId = req.user?.id;
    if (!listerId) return res.status(401).json({ message: "Unauthorized" });

    const {
      title, location, description, county, constituency, ward, area, units, images, publishNow,
    } = req.body;

    const shouldPublish = publishNow === true;

    if (shouldPublish) {
      if (!title?.trim() || !location?.trim() || !description?.trim() ||
          !county?.trim() || !constituency?.trim() || !ward?.trim()) {
        return res.status(400).json({ message: "Missing required fields for publish" });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create first (DRAFT or PUBLISHED), but only "consumeSlot" if we successfully charge quota
      const created = await tx.property.create({
        data: {
          title: title ?? "",
          location: location ?? "",
          description: description ?? "",
          county: county ?? null,
          constituency: constituency ?? null,
          ward: ward ?? null,
          area: area ?? null,
          listerId,
          status: shouldPublish ? "PUBLISHED" : "DRAFT",
          consumedSlot: false, // will set true after successful quota charge
          units: Array.isArray(units) && units.length ? { create: units } : undefined,
          images: Array.isArray(images) && images.length ? { create: images } : undefined,
        },
        include: { units: true, images: true },
      });

      let quota = null as any;

      if (shouldPublish) {
        quota = await consumeQuotaFIFO({
          tx,
          userId: listerId,
          needListings: 1,
          needFeatured: created.featured ? 1 : 0,
        });

        await tx.property.update({
          where: { id: created.id },
          data: { consumedSlot: true },
        });
      }

      const final = await tx.property.findUnique({
        where: { id: created.id },
        include: { units: true, images: true },
      });

      return { property: final, quota };
    });

    return res.status(201).json(result);
  } catch (err: any) {
    if (err?.code === "INSUFFICIENT_LISTING_QUOTA") {
      return res.status(402).json({
        message: "No listing quota remaining. Please subscribe/extend.",
        details: err.meta,
      });
    }
    if (err?.code === "INSUFFICIENT_FEATURED_QUOTA") {
      return res.status(402).json({
        message: "No featured quota remaining. Please subscribe/extend.",
        details: err.meta,
      });
    }

    console.error("createProperty error", err);
    return res.status(500).json({ message: "Failed to create property", error: String(err) });
  }
};

export const updateProperty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, location, description, featured, units, images, amenities,
            county, constituency, ward, area } = req.body;

    const property = await prisma.property.findUnique({
      where: { id },
      include: { amenities: true },
    });
    if (!property) return res.status(404).json({ message: "Property not found" });

    if (property.status === "PUBLISHED" && (units || images)) {
      return res.status(403).json({ message: "Published properties cannot change units or images." });
    }

    let amenityOps: any = undefined;
    if (amenities !== undefined) {
      const amenityNames = parseAmenityNames(amenities);
      const found = amenityNames.length
        ? await prisma.amenity.findMany({ where: { name: { in: amenityNames, mode: "insensitive" } } })
        : [];
      await prisma.propertyAmenity.deleteMany({ where: { propertyId: id } });
      if (found.length > 0) {
        amenityOps = { create: found.map(a => ({ amenityId: a.id })) };
      }
    }

    await prisma.property.update({
      where: { id },
      data: { title, location, description, featured, county, constituency, ward, area, amenities: amenityOps },
    });

    if (Array.isArray(units) && property.status !== "PUBLISHED") {
      await prisma.unit.deleteMany({ where: { propertyId: id } });
      if (units.length > 0) {
        await prisma.unit.createMany({
          data: units.map((u: any) => ({
            propertyId: id,
            bedrooms: Number(u.bedrooms) || 0,
            bathrooms: Number(u.bathrooms) || 0,
            rent: Number(u.rent) || 0,
            available: Number(u.available) || 0,
            type: String(u.type || "Apartment"),
            count: Number(u.count) || 1,
            rented: Number(u.rented) || 0,
            status: String(u.status || "AVAILABLE"),
          })),
        });
      }
    }

    const final = await prisma.property.findUnique({
      where: { id },
      include: { units: true, images: true, amenities: { include: { amenity: true } } },
    });

    res.json(final);
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: String(err) });
  }
};


// DELETE /api/properties/:id
export const deleteProperty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const prop = await prisma.property.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!prop) return res.status(404).json({ message: "Property not found" });
    if (prop.listerId !== userId) return res.status(403).json({ message: "Not your listing" });

    try {
      for (const img of prop.images) {
        const uploadsPrefix = `${PUBLIC_BASE}/uploads/`;
        if (img.url.startsWith(uploadsPrefix)) {
          const rel = img.url.substring(uploadsPrefix.length);
          const abs = path.join(UPLOADS_ROOT, rel);
          if (fs.existsSync(abs)) fs.unlinkSync(abs);
        }
      }
      const propDir = path.join(UPLOADS_ROOT, "properties", id);
      if (fs.existsSync(propDir)) fs.rmSync(propDir, { recursive: true, force: true });
    } catch {}

    await prisma.property.delete({ where: { id } });

    res.json({ message: "Property deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete property", error: err });
  }
};

/* =========================
   PUBLISH / STATUS
   ========================= */

export const getPublishedProperties = async (_req: Request, res: Response) => {
  try {
    const listings = await prisma.property.findMany({
      where: { status: "PUBLISHED" },
      include: { units: true, images: true, amenities: { include: { amenity: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch properties", error: err });
  }
};

//publish property
export const publishProperty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const listerId = req.user?.id;
    if (!listerId) return res.status(401).json({ message: "Unauthorized" });

    const result = await prisma.$transaction(async (tx) => {
      const property = await tx.property.findUnique({ where: { id } });
      if (!property) return { kind: "not_found" as const };
      if (property.listerId !== listerId) return { kind: "forbidden" as const };

      // Already published? return it
      if (property.status === "PUBLISHED") {
        return { kind: "ok" as const, property, quota: null };
      }

      // If not yet consumed, charge FIFO quota once
      let quota = null as any;
      if (!property.consumedSlot) {
        quota = await consumeQuotaFIFO({
          tx,
          userId: listerId,
          needListings: 1,
          needFeatured: property.featured ? 1 : 0,
        });
      }

      const updated = await tx.property.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          consumedSlot: true,
        },
      });

      return { kind: "ok" as const, property: updated, quota };
    });

    if (result.kind === "not_found") return res.status(404).json({ message: "Property not found" });
    if (result.kind === "forbidden") return res.status(403).json({ message: "Not your listing" });

    return res.json(result);
  } catch (err: any) {
    if (err?.code === "INSUFFICIENT_LISTING_QUOTA") {
      return res.status(402).json({
        message: "No listing quota remaining. Please subscribe/extend.",
        details: err.meta,
      });
    }
    if (err?.code === "INSUFFICIENT_FEATURED_QUOTA") {
      return res.status(402).json({
        message: "No featured quota remaining. Please subscribe/extend.",
        details: err.meta,
      });
    }
    console.error("publishProperty error", err);
    return res.status(500).json({ message: "Failed to publish", error: String(err) });
  }
};


//Change Property Status
export const changePropertyStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newStatus } = req.body as { newStatus?: ListingStatus };
    const listerId = req.user?.id;

    if (!listerId) return res.status(401).json({ message: "Unauthorized" });
    if (!newStatus) return res.status(400).json({ message: "newStatus is required" });

    const allowed: ListingStatus[] = ["DRAFT", "PUBLISHED", "UNPUBLISHED"];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({ message: "Invalid newStatus" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const property = await tx.property.findUnique({ where: { id } });
      if (!property) return { kind: "not_found" as const };
      if (property.listerId !== listerId) return { kind: "forbidden" as const };

      if (property.status === newStatus) {
        return { kind: "no_change" as const };
      }

      if (newStatus === "PUBLISHED") {
        let quota = null as any;
        if (!property.consumedSlot) {
          quota = await consumeQuotaFIFO({
            tx,
            userId: listerId,
            needListings: 1,
            needFeatured: property.featured ? 1 : 0,
          });
        }

        const updated = await tx.property.update({
          where: { id },
          data: { status: "PUBLISHED", consumedSlot: true },
        });

        return { kind: "ok" as const, updated, quota };
      }

      // Any other status: just update status (we do NOT refund quota)
      const updated = await tx.property.update({
        where: { id },
        data: { status: newStatus },
      });

      return { kind: "ok" as const, updated, quota: null };
    });

    if (result.kind === "not_found") return res.status(404).json({ message: "Property not found" });
    if (result.kind === "forbidden") return res.status(403).json({ message: "Property not found or access denied" });
    if (result.kind === "no_change") return res.status(400).json({ message: "No change in status" });

    return res.json(result);
  } catch (err: any) {
    if (err?.code === "INSUFFICIENT_LISTING_QUOTA") {
      return res.status(402).json({
        message: "No listing quota remaining. Please subscribe/extend.",
        details: err.meta,
      });
    }
    if (err?.code === "INSUFFICIENT_FEATURED_QUOTA") {
      return res.status(402).json({
        message: "No featured quota remaining. Please subscribe/extend.",
        details: err.meta,
      });
    }
    console.error("changePropertyStatus error", err);
    return res.status(500).json({ message: "Failed to change status", error: String(err) });
  }
};


/* =========================
   MINE / IMAGES
   ========================= */
export const getMyProperties = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 12));
    const page = Math.max(1, Number(req.query.page) || 1);
    const status = req.query.status as string | undefined;

    const where: any = { listerId: userId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: { images: true, units: true, amenities: { include: { amenity: true } } },
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.property.count({ where }),
    ]);

    res.json({ items, total, limit, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: "Failed to load your properties", error: err });
  }
};


// GET /api/properties/stats/counties
export const getPropertyStatsByCounty = async (_req: Request, res: Response) => {
  try {
    const grouped = await prisma.property.groupBy({
      by: ["county"],
      where: { status: "PUBLISHED" },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    const result = grouped.map((g) => ({
      county: g.county ?? "Unknown",
      count: g._count.id,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to compute stats by county", error: err });
  }
};

// Upload & remove image
export const uploadPropertyImage = async (req: Request, res: Response) => {
  try {
    const { id: propertyId } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const prop = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!prop) return res.status(404).json({ message: "Property not found" });
    if (prop.listerId !== userId) return res.status(403).json({ message: "Not your listing" });

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ message: "No file uploaded (field name must be 'file')" });

    const safeExt = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const name = crypto.randomBytes(10).toString("hex") + safeExt;
    const dir = path.join(UPLOADS_ROOT, "properties", propertyId);
    ensureDirSync(dir);

    const abs = path.join(dir, name);
    fs.writeFileSync(abs, file.buffer);

    const publicUrl = `${pickPublicBase(process.env.PUBLIC_BASE_URL || "") || PUBLIC_BASE}/uploads/properties/${propertyId}/${name}`;

    const created = await prisma.image.create({
      data: { url: publicUrl, propertyId },
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: "Failed to upload image", error: err });
  }
};

export const removePropertyImage = async (req: Request, res: Response) => {
  try {
    const { id: propertyId, imageId } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const prop = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!prop) return res.status(404).json({ message: "Property not found" });
    if (prop.listerId !== userId) return res.status(403).json({ message: "Not your listing" });

    const img = await prisma.image.findUnique({ where: { id: imageId } });
    if (!img || img.propertyId !== propertyId) {
      return res.status(404).json({ message: "Image not found" });
    }

    try {
      const uploadsPrefix = `${PUBLIC_BASE}/uploads/`;
      if (img.url.startsWith(uploadsPrefix)) {
        const rel = img.url.substring(uploadsPrefix.length);
        const abs = path.join(UPLOADS_ROOT, rel);
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      }
    } catch {}

    await prisma.image.delete({ where: { id: imageId } });

    res.json({ message: "Image removed" });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove image", error: err });
  }
};