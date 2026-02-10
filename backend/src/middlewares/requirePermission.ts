// backend/src/middlewares/requirePermission.ts
import { Request, Response, NextFunction } from "express";
import { Permission } from "@prisma/client";
import { verifyToken } from "./verifyToken";
import { requireAuth } from "./requireAuth";
import { resolveEffectivePermissions } from "../utils/rbac";

declare global {
  namespace Express {
    interface Request {
      _effectivePermissions?: Set<Permission>;
    }
  }
}

/**
 * check-only middleware: assumes req.user is already present
 * (i.e. verifyToken + requireAuth ran upstream)
 */
export function requirePermission(p: Permission) {
  return checkPermission(p);
}

/**
 * full chain helper for non-admin routers that want a 1-liner:
 * verifyToken -> requireAuth -> permission check
 */
export function requirePermissionChain(p: Permission) {
  return [verifyToken, requireAuth, checkPermission(p)];
}

function checkPermission(p: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const u = req.user as { id: string; email?: string; role: string } | undefined;
    if (!u?.id) return res.status(401).json({ message: "Unauthorized" });

    // Absolute bypass for SUPER_ADMIN
    if (String(u.role).toUpperCase() === "SUPER_ADMIN") return next();

    try {
      // Cache per-request: important if a route uses multiple permission checks
      if (!req._effectivePermissions) {
        const resolved = await resolveEffectivePermissions(u.id);
        req._effectivePermissions = new Set(resolved.permissions || []);
      }

      if (req._effectivePermissions.has(p)) return next();
      return res.status(403).json({ message: `Missing permission: ${p}` });
    } catch (e) {
      console.error("requirePermission failed:", e);
      return res.status(500).json({ message: "RBAC check failed" });
    }
  };
}
