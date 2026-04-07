import express from "express";
import { Role } from "@prisma/client";

import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";
import { requireRole } from "../middlewares/requireRole";

import {
  testEmail,
  broadcastNewsletter,
  broadcastRaw,

  // in-app notifications (bell)
  listMyNotifications,
  unreadNotificationsCount,
  markNotificationRead,

  // admin in-app broadcast helper (optional)
  createInAppBroadcast,
} from "../controllers/notification.controller";

const router = express.Router();

router.use(verifyToken, requireAuth);

/**
 * -----------------------------
 * In-app notifications (Bell)
 * -----------------------------
 */
router.get("/mine", listMyNotifications);
router.get("/unread-count", unreadNotificationsCount);
router.post("/:id/read", markNotificationRead);

/**
 * Admin-only: create in-app broadcast (writes Notification rows)
 * Note: your main “broadcast” feature uses /api/admin/broadcasts/send.
 * This is kept as a helper endpoint too.
 */
router.post("/broadcast", requireRole([Role.ADMIN, Role.SUPER_ADMIN]), createInAppBroadcast);

/**
 * -----------------------------
 * Email helpers (existing)
 * -----------------------------
 */
router.post("/test", requireRole([Role.ADMIN, Role.SUPER_ADMIN]), testEmail);
router.post("/broadcast/newsletter", requireRole([Role.ADMIN, Role.SUPER_ADMIN]), broadcastNewsletter);
router.post("/broadcast/raw", requireRole([Role.ADMIN, Role.SUPER_ADMIN]), broadcastRaw);

export default router;