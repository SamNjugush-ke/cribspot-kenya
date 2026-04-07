// backend/src/controllers/admin.properties.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { auditLog } from "../utils/audit";
import { ListingStatus } from "@prisma/client";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const RAW_PUBLIC_BASE = process.env.PUBLIC_BASE_URL || "http://localhost:4000";
function pickPublicBase(raw: string) {
  const first = raw.split(",").map((s) => s.trim()).find(Boolean);
  return first || "http://localhost:4000";
}
const PUBLIC_BASE = pickPublicBase(RAW_PUBLIC_BASE);
const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function asNonEmptyString(v: any): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

function asNullableString(v: any): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function asInt(v: any, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function asBool(v: any, fallback: boolean): boolean {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase().trim();
  if (["1", "true", "yes", "y"].includes(s)) return true;
  if (["0", "false", "no", "n"].includes(s)) return false;
  return fallback;
}

function parseListingStatus(v: any): ListingStatus | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).toUpperCase().trim();
  if (s === "DRAFT" || s === "PUBLISHED" || s === "UNPUBLISHED") return s as ListingStatus;
  return undefined;
}

async function removePhysicalImagesForProperty(id: string) {
  const images = await prisma.image.findMany({ where: { propertyId: id } });
  try {
    for (const img of images) {
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
}

export async function adminPatchProperty(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const {
      title,
      location,
      description,
      status,
      featured,
      area,
      county,
      constituency,
      ward,
      units,
      images,
      amenities,
      reason,
    } = req.body ?? {};

    const data: any = {};
    const t = asNonEmptyString(title);
    if (t !== undefined) data.title = t;
    const loc = asNonEmptyString(location);
    if (loc !== undefined) data.location = loc;
    const desc = asNonEmptyString(description);
    if (desc !== undefined) data.description = desc;
    const st = parseListingStatus(status);
    if (st !== undefined) data.status = st;
    if (featured !== undefined) data.featured = asBool(featured, false);
    const a = asNullableString(area);
    if (a !== undefined) data.area = a;
    const cty = asNullableString(county);
    if (cty !== undefined) data.county = cty;
    const cons = asNullableString(constituency);
    if (cons !== undefined) data.constituency = cons;
    const w = asNullableString(ward);
    if (w !== undefined) data.ward = w;

    const updated = await prisma.property.update({ where: { id }, data });

    if (Array.isArray(units)) {
      await prisma.unit.deleteMany({ where: { propertyId: id } });
      if (units.length) {
        const rows = units.map((u: any) => {
          const count = asInt(u?.count, 1);
          const rented = asInt(u?.rented, 0);
          return {
            propertyId: id,
            bedrooms: asInt(u?.bedrooms, 0),
            bathrooms: asInt(u?.bathrooms, 0),
            rent: asInt(u?.rent, 0),
            type: asNonEmptyString(u?.type) ?? "Unit",
            count,
            available: u?.available !== undefined && u?.available !== null ? asInt(u?.available, Math.max(count - rented, 0)) : Math.max(count - rented, 0),
            rented,
            status: asNonEmptyString(u?.status) ?? "AVAILABLE",
          };
        });
        await prisma.unit.createMany({ data: rows });
      }
    }

    if (Array.isArray(images)) {
      await prisma.image.deleteMany({ where: { propertyId: id } });
      const cleaned = images
        .map((img: any) => ({ id: img?.id ? String(img.id) : undefined, url: asNonEmptyString(img?.url) }))
        .filter((x) => !!x.url);
      if (cleaned.length) {
        await prisma.image.createMany({
          data: cleaned.map((img) => ({ propertyId: id, url: img.url as string })),
        });
      }
    }

    if (Array.isArray(amenities)) {
      await prisma.propertyAmenity.deleteMany({ where: { propertyId: id } });
      for (const raw of amenities) {
        const name = asNonEmptyString(raw);
        if (!name) continue;
        const amenity = await prisma.amenity.upsert({ where: { name }, update: {}, create: { name } });
        await prisma.propertyAmenity.create({ data: { propertyId: id, amenityId: amenity.id } });
      }
    }

    try {
      await auditLog(req, {
        action: "ADMIN_PROPERTY_UPDATED",
        targetType: "PROPERTY",
        targetId: id,
        metadata: { reason: reason || null },
      });
    } catch {}

    return res.json({ ok: true, property: updated });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update property" });
  }
}

export async function adminDeleteProperty(req: Request, res: Response) {
  try {
    const id = String(req.params.id);
    const reason = String(req.body?.reason || "").trim() || null;

    const property = await prisma.property.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!property) return res.status(404).json({ message: "Property not found" });

    await removePhysicalImagesForProperty(id);

    await prisma.$transaction(async (tx) => {
      await tx.favorite.deleteMany({ where: { propertyId: id } });
      await tx.listingBoost.deleteMany({ where: { propertyId: id } });
      await tx.propertyAmenity.deleteMany({ where: { propertyId: id } });
      await tx.image.deleteMany({ where: { propertyId: id } });
      await tx.unit.deleteMany({ where: { propertyId: id } });
      await tx.property.delete({ where: { id } });
    });

    try {
      await auditLog(req, {
        action: "ADMIN_PROPERTY_DELETED",
        targetType: "PROPERTY",
        targetId: id,
        metadata: { title: property.title, reason },
      });
    } catch {}

    return res.json({ ok: true, message: "Property deleted" });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: "Failed to delete property" });
  }
}

export async function adminUploadPropertyImage(req: Request, res: Response) {
  try {
    const propertyId = String(req.params.id);
    const prop = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!prop) return res.status(404).json({ message: "Property not found" });

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ message: "No file uploaded (field name must be 'file')" });

    const safeExt = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const name = crypto.randomBytes(10).toString("hex") + safeExt;
    const dir = path.join(UPLOADS_ROOT, "properties", propertyId);
    ensureDirSync(dir);
    const abs = path.join(dir, name);
    fs.writeFileSync(abs, file.buffer);

    const publicUrl = `${pickPublicBase(process.env.PUBLIC_BASE_URL || "") || PUBLIC_BASE}/uploads/properties/${propertyId}/${name}`;
    const created = await prisma.image.create({ data: { url: publicUrl, propertyId } });
    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to upload image", error: String(err) });
  }
}

export async function adminRemovePropertyImage(req: Request, res: Response) {
  try {
    const propertyId = String(req.params.id);
    const imageId = String(req.params.imageId);

    const prop = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!prop) return res.status(404).json({ message: "Property not found" });

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
    return res.json({ ok: true, message: "Image removed" });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to remove image", error: String(err) });
  }
}
