// backend/src/routes/message.routes.ts
import express from "express";
import { Role } from "@prisma/client";

import { verifyToken } from "../middlewares/verifyToken";
import { requireRole } from "../middlewares/requireRole";

import {
  listThreads,
  userUnreadCount,
  getThread,
  postMessageToThread,
  markThreadRead,
  startDirectByEmail,
  validateRecipientEmail,
  validateRecipient,
  adminBroadcast,
} from "../controllers/message.controller";

const router = express.Router();

/**
 * All message endpoints require auth
 */
router.use(verifyToken);

/**
 * Recipient validation:
 * - validateRecipientEmail: returns { ok: true/false } (no hints)
 * - validateRecipient: returns { user } (id/email/name/role), used for “start by email” UX
 *
 * Keep both to avoid breaking any frontend calls.
 */
router.get("/validate-recipient-email", validateRecipientEmail);
router.get("/validate-recipient", validateRecipient);

/**
 * Threads
 */
router.get("/threads", listThreads);
router.get("/unread-count", userUnreadCount);
router.get("/threads/:id", getThread);

/**
 * Posting messages
 */
router.post("/threads/:id/messages", postMessageToThread);
router.post("/threads/:id/read", markThreadRead);

/**
 * Start direct by email (creates or returns DIRECT conversation)
 * Body: { email, subject? }
 */
router.post("/start-direct", startDirectByEmail);

/**
 * Admin broadcast → creates BROADCAST conversation + one message
 * Body: { subject?, content, audienceRole?, userIds? }
 */
router.post(
  "/broadcast",
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  adminBroadcast
);

export default router;