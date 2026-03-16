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
  const first = raw
    .split(",")
    .map((s) => s.trim())
    .find(Boolean);
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
    return input
      .flatMap((s) => s.split(","))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return String(input)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normStr(v: any): string {
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}

type PublishValidationResult = {
  ok: boolean;
  missing: string[];
  message?: string;
};

function validatePropertyForPublish(input: {
  title?: any;
  location?: any;
  description?: any;
  county?: any;
  constituency?: any;
  ward?: any;
  units?: any[];
  images?: any[];
}): PublishValidationResult {
  const missing: string[] = [];

  if (!normStr(input.title)) missing.push("title");
  if (!normStr(input.location)) missing.push("location");
  if (!normStr(input.description)) missing.push("description");
  if (!normStr(input.county)) missing.push("county");
  if (!normStr(input.constituency)) missing.push("constituency");
  if (!normStr(input.ward)) missing.push("ward");

  const units = Array.isArray(input.units) ? input.units : [];
  if (!units.length) {
    missing.push("unit details");
  } else {
    const invalidUnit = units.some((u) => {
      const type = normStr(u?.type);
      const bedrooms = Number(u?.bedrooms);
      const bathrooms = Number(u?.bathrooms);
      const rent = Number(u?.rent);
      const available = Number(u?.available);
      return !type || bedrooms < 1 || bathrooms < 1 || rent < 1 || available < 1;
    });
    if (invalidUnit) missing.push("complete unit details");
  }

  const images = Array.isArray(input.images) ? input.images.filter((img) => normStr(img?.url)) : [];
  if (!images.length) missing.push("at least one image");

  if (missing.length) {
    return {
      ok: false,
      missing,
      message: `This listing is incomplete for publishing. Missing: ${missing.join(", ")}.`,
    };
  }

  return { ok: true, missing: [] };
}

/* =========================
   LIST / FILTER
   ========================= */

// GET /api/properties
export const getAllProperties = async (req: Request, res: Response) => {
  try {
    const {
      location,
      area,
      minPrice,
      maxPrice,
      bedrooms,
      type,
      featured,
      status,
      county,
      constituency,
      ward,
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
        status !== undefined && String(status) !== "ALL" ? String(status) : undefined, // ALL => no status filter
      featured: featured !== undefined ? String(featured) === "true" : undefined,
      county: county ? String(county) : undefined,
      constituency: constituency ? String(constituency) : undefined,
      ward: ward ? String(ward) : undefined,
    };

    // ✅ Area filter (free-text search). Back-compat: fallback to location if area is null on older rows.
    if (area && String(area).trim()) {
      const q = String(area).trim();
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { area: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
        ],
      });
    }

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
          lister: { select: { id: true, name: true, email: true, phone: true } }, // ✅ includes phone
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
    res.status(500).json({ message: "Filter fetch failed", error: String(err) });
  }
};

// GET /api/properties/areas?q=sec&county=Kiambu&constituency=Thika&limit=10
export const getAreaSuggestions = async (req: Request, res: Response) => {
  try {
    const q = normStr(req.query.q);
    const county = normStr(req.query.county);
    const constituency = normStr(req.query.constituency);
    const take = Math.max(1, Math.min(20, Number(req.query.limit) || 10));

    if (!q) return res.json({ items: [] });

    const where: any = {
      status: "PUBLISHED",
      ...(county ? { county } : {}),
      ...(constituency ? { constituency } : {}),
      AND: [
        {
          OR: [
            { area: { contains: q, mode: "insensitive" } },
            { location: { contains: q, mode: "insensitive" } },
          ],
        },
      ],
    };

    const rows = await prisma.property.findMany({
      where,
      select: {
        area: true,
        location: true,
        county: true,
        constituency: true,
        ward: true,
        createdAt: true,
      },
      // note: distinct works well here to avoid spam; we include ward/county/constituency context
      distinct: ["area", "county", "constituency", "ward"],
      take,
      orderBy: [{ createdAt: "desc" }],
    });

    const items = rows
      .map((r) => {
        const areaValue = normStr(r.area || r.location);
        if (!areaValue) return null;

        const c = normStr(r.county);
        const k = normStr(r.constituency);
        const w = normStr(r.ward);

        const extra = [c || null, k || null, w || null].filter(Boolean).join(", ");
        return {
          area: areaValue,
          county: c,
          constituency: k,
          ward: w,
          label: extra ? `${areaValue}, ${extra}` : areaValue,
        };
      })
      .filter(Boolean);

    res.json({ items });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch area suggestions", error: String(err) });
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
        lister: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!property) return res.status(404).json({ error: "Property not found" });
    res.json(property);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch property details", details: String(err) });
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
        lister: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!property) return res.status(404).json({ error: "Property not found" });
    res.json(property);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch property", details: String(err) });
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
    res.status(500).json({ message: "Failed to load similar properties", error: String(err) });
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
    res.status(500).json({ message: "Failed to compute stats by constituency", error: String(err) });
  }
};

/* =========================
   CREATE / UPDATE / DELETE
   ========================= */

export const createProperty = async (req: Request, res: Response) => {
  try {
    const listerId = req.user?.id;
    if (!listerId) return res.status(401).json({ message: "Unauthorized" });

    const { title, location, description, county, constituency, ward, area, units, images, publishNow } = req.body;

    const shouldPublish = publishNow === true;

    if (shouldPublish) {
      const validation = validatePropertyForPublish({
        title,
        location,
        description,
        county,
        constituency,
        ward,
        units: Array.isArray(units) ? units : [],
        images: Array.isArray(images) ? images : [],
      });

      if (!validation.ok) {
        return res.status(400).json({
          message: validation.message || "Listing is incomplete for publish",
          missing: validation.missing,
          code: "INCOMPLETE_LISTING",
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const finalArea =
        normStr(area) ? normStr(area) : normStr(location) ? normStr(location) : null;

      // Create first (DRAFT or PUBLISHED), but only "consumeSlot" if we successfully charge quota
      const created = await tx.property.create({
        data: {
          title: title ?? "",
          location: location ?? "",
          description: description ?? "",
          county: county ?? null,
          constituency: constituency ?? null,
          ward: ward ?? null,
          area: finalArea,
          listerId,
          status: shouldPublish ? "PUBLISHED" : "DRAFT",
          consumedSlot: false,
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
    const { title, location, description, featured, units, amenities, county, constituency, ward, area } = req.body;

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const property = await prisma.property.findUnique({
      where: { id },
      include: { amenities: true, units: true, images: true },
    });
    if (!property) return res.status(404).json({ message: "Property not found" });

    if (property.listerId !== userId) return res.status(403).json({ message: "Not your listing" });

    let amenityOps: any = undefined;
    if (amenities !== undefined) {
      const amenityNames = parseAmenityNames(amenities);
      const found = amenityNames.length
        ? await prisma.amenity.findMany({ where: { name: { in: amenityNames, mode: "insensitive" } } })
        : [];

      await prisma.propertyAmenity.deleteMany({ where: { propertyId: id } });
      if (found.length > 0) {
        amenityOps = { create: found.map((a) => ({ amenityId: a.id })) };
      }
    }

    const nextArea =
      area !== undefined ? (normStr(area) ? normStr(area) : null) : location !== undefined ? normStr(location) : undefined;

    await prisma.property.update({
      where: { id },
      data: {
        title,
        location,
        description,
        featured,
        county,
        constituency,
        ward,
        area: nextArea,
        amenities: amenityOps,
      },
    });

    if (Array.isArray(units)) {
      await prisma.unit.deleteMany({ where: { propertyId: id } });
      if (units.length > 0) {
        await prisma.unit.createMany({
          data: units.map((u: any) => ({
            propertyId: id,
            bedrooms: Math.max(0, Number(u.bedrooms) || 0),
            bathrooms: Math.max(0, Number(u.bathrooms) || 0),
            rent: Math.max(0, Number(u.rent) || 0),
            available: Math.max(0, Number(u.available) || 0),
            type: String(u.type || "Apartment"),
            count: Math.max(1, Number(u.count) || Number(u.available) || 1),
            rented: Math.max(0, Number(u.rented) || 0),
            status: String(u.status || "AVAILABLE"),
          })),
        });
      }
    }

    const final = await prisma.property.findUnique({
      where: { id },
      include: {
        units: true,
        images: true,
        amenities: { include: { amenity: true } },
      },
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

    await prisma.$transaction(async (tx) => {
      await tx.favorite.deleteMany({ where: { propertyId: id } });
      await tx.propertyAmenity.deleteMany({ where: { propertyId: id } });
      await tx.image.deleteMany({ where: { propertyId: id } });
      await tx.unit.deleteMany({ where: { propertyId: id } });
      await tx.listingBoost.deleteMany({ where: { propertyId: id } });
      await tx.property.delete({ where: { id } });
    });

    res.json({ message: "Property deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete property", error: String(err) });
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
    res.status(500).json({ message: "Failed to fetch properties", error: String(err) });
  }
};

// publish property
export const publishProperty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const listerId = req.user?.id;
    if (!listerId) return res.status(401).json({ message: "Unauthorized" });

    const result = await prisma.$transaction(async (tx) => {
      const property = await tx.property.findUnique({
        where: { id },
        include: { units: true, images: true },
      });
      if (!property) return { kind: "not_found" as const };
      if (property.listerId !== listerId) return { kind: "forbidden" as const };

      const validation = validatePropertyForPublish(property);
      if (!validation.ok) {
        return { kind: "invalid" as const, validation };
      }

      if (property.status === "PUBLISHED") {
        return { kind: "ok" as const, property, quota: null };
      }

      const quota = await consumeQuotaFIFO({
        tx,
        userId: listerId,
        needListings: 1,
        needFeatured: property.featured ? 1 : 0,
      });

      const updated = await tx.property.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          consumedSlot: true,
        },
        include: { units: true, images: true },
      });

      return { kind: "ok" as const, property: updated, quota };
    });

    if (result.kind === "not_found") return res.status(404).json({ message: "Property not found" });
    if (result.kind === "forbidden") return res.status(403).json({ message: "Not your listing" });
    if (result.kind === "invalid") {
      return res.status(400).json({
        message: result.validation.message || "Listing is incomplete for publish",
        missing: result.validation.missing,
        code: "INCOMPLETE_LISTING",
      });
    }

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

// Change Property Status
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
      const property = await tx.property.findUnique({
        where: { id },
        include: { units: true, images: true },
      });
      if (!property) return { kind: "not_found" as const };
      if (property.listerId !== listerId) return { kind: "forbidden" as const };

      if (property.status === newStatus) {
        return { kind: "no_change" as const };
      }

      if (newStatus === "PUBLISHED") {
        const validation = validatePropertyForPublish(property);
        if (!validation.ok) {
          return { kind: "invalid" as const, validation };
        }

        const quota = await consumeQuotaFIFO({
          tx,
          userId: listerId,
          needListings: 1,
          needFeatured: property.featured ? 1 : 0,
        });

        const updated = await tx.property.update({
          where: { id },
          data: { status: "PUBLISHED", consumedSlot: true },
          include: { units: true, images: true },
        });

        return { kind: "ok" as const, updated, quota };
      }

      const updated = await tx.property.update({
        where: { id },
        data: {
          status: newStatus,
          consumedSlot: property.status === "PUBLISHED" ? false : property.consumedSlot,
        },
        include: { units: true, images: true },
      });

      return { kind: "ok" as const, updated, quota: null };
    });

    if (result.kind === "not_found") return res.status(404).json({ message: "Property not found" });
    if (result.kind === "forbidden") return res.status(403).json({ message: "Property not found or access denied" });
    if (result.kind === "no_change") return res.status(400).json({ message: "No change in status" });
    if (result.kind === "invalid") {
      return res.status(400).json({
        message: result.validation.message || "Listing is incomplete for publish",
        missing: result.validation.missing,
        code: "INCOMPLETE_LISTING",
      });
    }

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
    res.status(500).json({ message: "Failed to load your properties", error: String(err) });
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
    res.status(500).json({ message: "Failed to compute stats by county", error: String(err) });
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
    res.status(500).json({ message: "Failed to upload image", error: String(err) });
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
    res.status(500).json({ message: "Failed to remove image", error: String(err) });
  }
};