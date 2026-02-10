//backend/src/routes/notification.routes.ts
import express from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { requireRole } from "../middlewares/requireRole";
import { Role } from "@prisma/client";
import {
  testEmail,
  broadcastNewsletter,
  broadcastRaw,
} from "../controllers/notification.controller";

const router = express.Router();

// Admin-only test
router.post("/test", verifyToken, requireRole([Role.ADMIN, Role.SUPER_ADMIN]), testEmail);

// Admin-only broadcast: templated newsletter
router.post(
  "/broadcast/newsletter",
  verifyToken,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  broadcastNewsletter
);

// Admin-only broadcast: raw HTML
router.post(
  "/broadcast/raw",
  verifyToken,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  broadcastRaw
);

export default router;