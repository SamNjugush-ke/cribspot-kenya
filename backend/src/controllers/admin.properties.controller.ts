// backend/src/controllers/admin.properties.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";

// If you have audit logging util in your project, keep it.
// If not, you can remove these lines safely.
import { auditLog } from "../utils/audit";

import { ListingStatus } from "@prisma/client";

function asNonEmptyString(v: any): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

function asNullableString(v: any): string | null | undefined {
  if (v === undefined) return undefined; // not provided => don't update
  if (v === null) return null; // explicit null => clear
  const s = String(v).trim();
  return s ? s : null; // empty string => clear
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

    // Build Property update data safely with your schema:
    // - title/location/description are REQUIRED => never set to null
    // - area/county/constituency/ward are optional => can set null to clear
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

    // Update main property (only fields provided)
    const updated = await prisma.property.update({
      where: { id },
      data,
    });

    // Units replace (replace-all strategy)
    if (Array.isArray(units)) {
      await prisma.unit.deleteMany({ where: { propertyId: id } });

      if (units.length) {
        const rows = units.map((u: any) => {
          const bedrooms = asInt(u?.bedrooms, 0);
          const bathrooms = asInt(u?.bathrooms, 0);
          const rent = asInt(u?.rent, 0);
          const type = asNonEmptyString(u?.type) ?? "Unit";

          // REQUIRED ints in schema:
          const count = asInt(u?.count, 1);
          const rented = asInt(u?.rented, 0);
          const available =
            u?.available !== undefined && u?.available !== null
              ? asInt(u.available, Math.max(count - rented, 0))
              : Math.max(count - rented, 0);

          // REQUIRED string status in schema:
          const status = asNonEmptyString(u?.status) ?? "AVAILABLE";

          return {
            propertyId: id,
            bedrooms,
            bathrooms,
            rent,
            type,
            count,
            available,
            rented,
            status,
          };
        });

        await prisma.unit.createMany({ data: rows });
      }
    }

    // Images replace
    if (Array.isArray(images)) {
      await prisma.image.deleteMany({ where: { propertyId: id } });

      if (images.length) {
        await prisma.image.createMany({
          data: images
            .map((img: any) => asNonEmptyString(img?.url))
            .filter(Boolean)
            .map((url) => ({
              propertyId: id,
              url: url as string,
            })),
        });
      }
    }

    // Amenities replace (via PropertyAmenity join model)
    if (Array.isArray(amenities)) {
      await prisma.propertyAmenity.deleteMany({ where: { propertyId: id } });

      for (const raw of amenities) {
        const name = asNonEmptyString(raw);
        if (!name) continue;

        const amenity = await prisma.amenity.upsert({
          where: { name },
          update: {},
          create: { name },
        });

        // Unique constraint protects against duplicates if called twice
        await prisma.propertyAmenity.create({
          data: {
            propertyId: id,
            amenityId: amenity.id,
          },
        });
      }
    }

    // Audit (best-effort)
    try {
      await auditLog(req, {
        action: "ADMIN_PROPERTY_UPDATED",
        targetType: "PROPERTY",
        targetId: id,
        metadata: { reason: reason || null },
      });
    } catch {
      // ignore audit failures so the main action succeeds
    }

    return res.json({ ok: true, property: updated });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update property" });
  }
}