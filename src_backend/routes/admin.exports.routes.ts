//src/routes/admin.exports.routes.ts
import express from "express";
import { requirePermission } from "../middlewares/requirePermission";
import {
  exportUsers,
  exportListings,
  exportPayments,
  exportSubscriptions,
  exportAudit,
} from "../controllers/admin.exports.controller";

const router = express.Router();

router.get("/users", requirePermission("EXPORT_DATA"), exportUsers);
router.get("/listings", requirePermission("EXPORT_DATA"), exportListings);
router.get("/payments", requirePermission("EXPORT_DATA"), exportPayments);
router.get("/subscriptions", requirePermission("EXPORT_DATA"), exportSubscriptions);
router.get("/audit", requirePermission("EXPORT_DATA"), exportAudit);

export default router;
