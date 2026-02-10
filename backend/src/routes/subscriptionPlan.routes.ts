import express from "express";
import {
  createPlan,
  getAllPlans,
  updatePlan,
  togglePlanStatus,
  suspendPlan,
  resumePlan,
  deletePlan,
  getAllPlansAdmin,
} from "../controllers/subscriptionPlan.controller";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";
import { requirePermission } from "../middlewares/requirePermission";

const router = express.Router();

// Admin routes (permission-based)
router.post("/", verifyToken, requireAuth, requirePermission("MANAGE_PACKAGES"), createPlan);
router.put("/:id", verifyToken, requireAuth, requirePermission("MANAGE_PACKAGES"), updatePlan);

/**
 * Strict toggle (retire/reactivate)
 * - Blocks deactivation if there are active subscriptions
 */
router.patch(
  "/:id/toggle",
  verifyToken,
  requireAuth,
  requirePermission("MANAGE_PACKAGES"),
  togglePlanStatus
);

/**
 * Suspend (sales off)
 * - Allowed even with active subscriptions
 * - Hidden from public plans list
 */
router.patch(
  "/:id/suspend",
  verifyToken,
  requireAuth,
  requirePermission("MANAGE_PACKAGES"),
  suspendPlan
);

/**
 * Resume (sales on)
 * - Makes previously suspended plan visible again for new subscriptions
 */
router.patch(
  "/:id/resume",
  verifyToken,
  requireAuth,
  requirePermission("MANAGE_PACKAGES"),
  resumePlan
);

/**
 * Delete
 * - Deletes if no active subscriptions
 * - Auto-suspends if active subscriptions exist
 */
router.delete(
  "/:id",
  verifyToken,
  requireAuth,
  requirePermission("MANAGE_PACKAGES"),
  deletePlan
);

router.get(
  "/admin",
  verifyToken,
  requireAuth,
  requirePermission("MANAGE_PACKAGES"),
  getAllPlansAdmin
);


// Public route (for listers to view plans)
router.get("/", getAllPlans);

export default router;