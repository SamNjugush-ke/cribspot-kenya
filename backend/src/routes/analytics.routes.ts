// backend/src/routes/analytics.routes.ts
import express from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";
import { requirePermission } from "../middlewares/requirePermission";
import {
  getAnalyticsSummary,
  getRevenueByMonth,
  getDistributionByCounty,
  getSubscriptionStatus,
} from "../controllers/analytics.controller";


const router = express.Router();

router.use(verifyToken, requireAuth);

// GET /api/analytics/summary
router.get("/summary", requirePermission("VIEW_ANALYTICS"), getAnalyticsSummary);

router.get("/summary", requirePermission("VIEW_ANALYTICS"), getAnalyticsSummary);
router.get("/revenue", requirePermission("VIEW_ANALYTICS"), getRevenueByMonth);
router.get("/distribution/county", requirePermission("VIEW_ANALYTICS"), getDistributionByCounty);
router.get("/subscriptions/status", requirePermission("VIEW_ANALYTICS"), getSubscriptionStatus);


export default router;