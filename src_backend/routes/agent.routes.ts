import express from "express";
import {
  getApprovedAgents,
  getAgentById,
  getMyAgentProfile,
  upsertMyAgentProfile,
  updateMyAgentProfile,
  adminUpdateAgentStatus,
} from "../controllers/agent.controller";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";
import { requireRole } from "../middlewares/requireRole";
import { Role } from "@prisma/client";

const router = express.Router();

// Public
router.get("/", getApprovedAgents);
router.get("/:id", getAgentById);

// Agent self-service
router.get("/me/profile", verifyToken, requireAuth, requireRole(Role.AGENT), getMyAgentProfile);
router.post("/", verifyToken, requireAuth, requireRole(Role.AGENT), upsertMyAgentProfile);
router.patch("/me", verifyToken, requireAuth, requireRole(Role.AGENT), updateMyAgentProfile);

// Admin moderation
router.patch(
  "/:id/status",
  verifyToken,
  requireAuth,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  adminUpdateAgentStatus
);

export default router;