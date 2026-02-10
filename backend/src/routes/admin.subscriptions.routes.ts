//src/routes/admin.subscriptions.routes.ts
import express from "express";
import { requirePermission } from "../middlewares/requirePermission";
import {
  adminListSubscriptions,
  adminGrantSubscription,
  adminExtendSubscription,
  adminResetSubscriptionUsage,
} from "../controllers/admin.subscriptions.controller";

const router = express.Router();

// List
router.get(
  "/",
  requirePermission("VIEW_QUOTA_DASHBOARDS"),
  adminListSubscriptions
);

// Grant (manual assign)
router.post(
  "/grant",
  requirePermission("ASSIGN_PACKAGES"),
  adminGrantSubscription
);

// Extend
router.patch(
  "/:id/extend",
  requirePermission("ASSIGN_PACKAGES"),
  adminExtendSubscription
);

// Reset usage
router.patch(
  "/:id/reset-usage",
  requirePermission("ASSIGN_PACKAGES"),
  adminResetSubscriptionUsage
);

export default router;
