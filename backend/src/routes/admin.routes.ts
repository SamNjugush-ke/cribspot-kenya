// backend/src/routes/admin.routes.ts
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../utils/prisma";
import * as bcrypt from "bcryptjs";

import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";
import { requirePermission } from "../middlewares/requirePermission";

import {
  getAllUsers,
  updateUserRole,
  toggleBanUser,
} from "../controllers/admin.controller";

import type { AuthedRequest } from "../types/auth";
import adminSubscriptionsRouter from "./admin.subscriptions.routes";
import adminExportsRouter from "./admin.exports.routes";
import { auditLog } from "../utils/audit";
import adminRbacRouter from "./admin.rbac.routes";

const router = express.Router();

// All admin routes require auth (then permissions per-route)
router.use(verifyToken, requireAuth);


//Admin RBAC
router.use("/rbac", adminRbacRouter);


// Admin subscriptions router
router.use("/subscriptions", adminSubscriptionsRouter);

// Admin exports
router.use("/exports", adminExportsRouter);



/**
 * ====================
 * Impersonation
 * ====================
 */

// Impersonate user (permission-gated)
router.post(
  "/users/:id/impersonate",
  requirePermission("IMPERSONATE_USER"),
  async (req, res) => {
    try {
      const authedReq = req as AuthedRequest;

      const { id } = authedReq.params;
      const target = await prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, role: true, name: true },
      });
      if (!target) return res.status(404).json({ error: "User not found" });

      const token = jwt.sign(
        {
          sub: target.id,
          id: target.id,
          email: target.email,
          role: target.role,
          impersonated: true,
          impersonatedUserId: target.id,
          impersonatorId: authedReq.user.id,
        },
        process.env.JWT_SECRET as string,
        { expiresIn: "30m" }
      );

      // AUDIT (A): impersonation started
      await auditLog(req, {
        action: "IMPERSONATION_STARTED",
        targetType: "USER",
        targetId: target.id,
        metadata: {
          targetEmail: target.email,
          targetName: target.name,
        },
      });

      return res.json({ token });
    } catch (err) {
      console.error("Impersonation error", err);
      return res.status(500).json({ error: "Failed to impersonate user" });
    }
  }
);

// Return from impersonation
router.post("/users/impersonate/return", async (req, res) => {
  try {
    const impersonatorId = (req.user as any).impersonatorId;
    if (!impersonatorId) return res.status(400).json({ error: "Not impersonating" });

    const admin = await prisma.user.findUnique({
      where: { id: impersonatorId },
      select: { id: true, email: true, role: true, name: true },
    });
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    // AUDIT (A): impersonation ended
    // targetId here is the impersonated user's id (current token's id)
    await auditLog(req, {
      action: "IMPERSONATION_ENDED",
      targetType: "USER",
      targetId: (req.user as any).id,
      metadata: {
        impersonatorId,
        impersonatorEmail: admin.email,
      },
    });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "2h" }
    );

    return res.json({ token });
  } catch (err) {
    console.error("Return impersonation error", err);
    return res.status(500).json({ error: "Failed to return to admin" });
  }
});

/**
 * ====================
 * Users
 * ====================
 */

// Create new user
router.post("/users", requirePermission("MANAGE_USERS"), async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, role, password: hashed, isBanned: false },
      select: { id: true, name: true, email: true, role: true, isBanned: true, createdAt: true },
    });

    return res.json(user);
  } catch (err) {
    console.error("Create user error", err);
    return res.status(500).json({ error: "Failed to create user" });
  }
});

router.get("/users", requirePermission("MANAGE_USERS"), getAllUsers);
router.patch("/users/:id/role", requirePermission("MANAGE_USERS"), updateUserRole);
router.patch("/users/:id/ban", requirePermission("MANAGE_USERS"), toggleBanUser);

/**
 * ====================
 * Settings
 * ====================
 */
router.get("/settings", requirePermission("MANAGE_SETTINGS"), async (req, res) => {
  try {
    let settings = await prisma.systemSetting.findFirst();
    if (!settings) {
      settings = await prisma.systemSetting.create({
        data: {
          brandName: "CribSpot Kenya",
          supportEmail: "support@cribspot.co.ke",
          // config default handled by schema default("{}")
        },
      });
    }
    return res.json(settings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// PUT /api/admin/settings  (DROP-IN replacement handler)
// - merges config safely (server-side) instead of replacing the whole JSON
// - still audits before/after
router.put("/settings", requirePermission("MANAGE_SETTINGS"), async (req, res) => {
  try {
    const { brandName, supportEmail, config } = req.body as {
      brandName?: string;
      supportEmail?: string;
      config?: any; // Prisma JsonValue (object expected)
    };

    // Load current settings (may be null on first run)
    const before = await prisma.systemSetting.findFirst();

    // Normalize existing config to an object
    const prevConfig =
      before && before.config && typeof before.config === "object" && !Array.isArray(before.config)
        ? (before.config as Record<string, any>)
        : {};

    // Normalize incoming config to an object (or undefined)
    const incomingConfig =
      config !== undefined
        ? (typeof config === "object" && config !== null && !Array.isArray(config)
            ? (config as Record<string, any>)
            : null)
        : undefined;

    if (incomingConfig === null) {
      return res.status(400).json({ error: "config must be a JSON object (not null/array)" });
    }

    // Merge configs if provided; otherwise keep existing
    const mergedConfig =
      incomingConfig !== undefined
        ? {
            ...prevConfig,
            ...incomingConfig,
          }
        : prevConfig;

    // Build update/create data
    const data: any = {
      ...(brandName !== undefined ? { brandName } : {}),
      ...(supportEmail !== undefined ? { supportEmail } : {}),
      ...(config !== undefined ? { config: mergedConfig } : {}),
    };

    let settings = before;

    if (!settings) {
      // Create: keep defaults if not provided
      settings = await prisma.systemSetting.create({
        data: {
          brandName: brandName ?? "CribSpot Kenya",
          supportEmail: supportEmail ?? "support@cribspot.co.ke",
          config: incomingConfig !== undefined ? mergedConfig : {},
        },
      });
    } else {
      settings = await prisma.systemSetting.update({
        where: { id: settings.id },
        data,
      });
    }

    // AUDIT: settings updated (before/after)
    await auditLog(req, {
      action: "SETTINGS_UPDATED",
      targetType: "SYSTEM_SETTING",
      targetId: settings.id,
      metadata: {
        before,
        after: settings,
        merge: {
          configMerged: config !== undefined,
          incomingConfigKeys:
            incomingConfig !== undefined ? Object.keys(incomingConfig) : [],
        },
      },
    });

    return res.json(settings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update settings" });
  }
});

/**
 * ====================
 * Admin property update (moderation + edits)
 * ====================
 */
/**
 * ====================
 * Admin property update (moderation + full edits)
 * ====================
 */
router.patch(
  "/properties/:id",
  requirePermission("APPROVE_LISTINGS"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const parseAmenityNames = (input?: string | string[] | null): string[] => {
        if (!input) return [];
        if (Array.isArray(input)) {
          return input
            .flatMap((s) => String(s).split(","))
            .map((s) => s.trim())
            .filter(Boolean);
        }
        return String(input)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      };

      const allowedStatuses = ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"] as const;

      const {
        title,
        location,
        county,
        constituency,
        ward,
        area,
        status,
        featured,
        description,

        // replace-all blocks
        units,
        images,

        // amenities can be string or string[]
        amenities,

        // audit
        reason,
      } = req.body as any;

      // Load full "before" state for auditing
      const before = await prisma.property.findUnique({
        where: { id },
        include: {
          units: true,
          images: true,
          amenities: { include: { amenity: true } },
        },
      });
      if (!before) return res.status(404).json({ error: "Property not found" });

      // Validate status if provided
      if (status !== undefined && !allowedStatuses.includes(String(status) as any)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      // Amenities: replace-all using names
      let amenityOps: any = undefined;
      if (amenities !== undefined) {
        const names = parseAmenityNames(amenities);

        const found = names.length
          ? await prisma.amenity.findMany({
              where: { name: { in: names, mode: "insensitive" } },
            })
          : [];

        // Clear existing links
        await prisma.propertyAmenity.deleteMany({ where: { propertyId: id } });

        // Recreate links
        amenityOps = found.length
          ? { create: found.map((a) => ({ amenityId: a.id })) }
          : { create: [] };
      }

      // Core update (property table)
      await prisma.property.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(location !== undefined ? { location } : {}),
          ...(county !== undefined ? { county } : {}),
          ...(constituency !== undefined ? { constituency } : {}),
          ...(ward !== undefined ? { ward } : {}),
          ...(area !== undefined ? { area } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(typeof featured === "boolean" ? { featured } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(amenities !== undefined ? { amenities: amenityOps } : {}),
        },
      });

      // Units: replace-all (admin allowed)
      if (Array.isArray(units)) {
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

      // Images: replace-all by URL (admin allowed)
      // Expect [{url: "..."}] or ["..."] — we’ll accept both.
      if (Array.isArray(images)) {
        await prisma.image.deleteMany({ where: { propertyId: id } });

        const urls = images
          .map((x: any) => (typeof x === "string" ? x : x?.url))
          .map((x: any) => String(x || "").trim())
          .filter(Boolean);

        if (urls.length > 0) {
          await prisma.image.createMany({
            data: urls.map((url: string) => ({ propertyId: id, url })),
          });
        }
      }

      // Load "after" (full) for response + audit
      const after = await prisma.property.findUnique({
        where: { id },
        include: {
          units: true,
          images: true,
          amenities: { include: { amenity: true } },
        },
      });

      // AUDIT (E): admin property updated
      await auditLog(req, {
        action: "ADMIN_PROPERTY_UPDATED",
        targetType: "PROPERTY",
        targetId: id,
        metadata: {
          reason: reason || null,
          before,
          after,
        },
      });

      return res.json(after);
    } catch (err) {
      console.error("Admin property update error", err);
      return res.status(500).json({ error: "Failed to update property" });
    }
  }
);

export default router;
