//backend/src/routes/message.routes.ts
import express from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { requireRole } from "../middlewares/requireRole";
import { Role } from "@prisma/client";
import {
  listThreads,
  getThread,
  startDirectOrSupportThread,
  postMessageToThread,
  markThreadRead,
  adminBroadcast,
  userUnreadCount,
  listBroadcasts,
} from "../controllers/message.controller";

const router = express.Router();

// Inbox list + unread count
router.get("/threads", verifyToken, listThreads);
router.get("/unread-count", verifyToken, userUnreadCount);

// Start or fetch an existing thread:
// body: { toUserId?: string, propertyId?: string, type?: "DIRECT"|"SUPPORT"|"GROUP", subject?: string }
router.post("/threads", verifyToken, startDirectOrSupportThread);

// Thread detail + messages
router.get("/threads/:id", verifyToken, getThread);

//Broadcast history endpoints
router.get(
  "/broadcasts",
  verifyToken,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  listBroadcasts
);


// Send message in a thread
// body: { content: string }
router.post("/threads/:id/messages", verifyToken, postMessageToThread);

// Mark thread read (sets participant.lastReadAt = now)
router.post("/threads/:id/read", verifyToken, markThreadRead);

// Admin broadcast to a role or all
// body: { subject: string, content: string, role?: Role }
router.post("/broadcast", verifyToken, requireRole([Role.ADMIN, Role.SUPER_ADMIN]), adminBroadcast);

export default router;
