import { Router } from "express";
import {
  createAlert,
  getAllAlerts,
  sendAlertNotification,
} from "../controllers/alert.controller";
import { requireRole } from "../middlewares/requireRole"; // restrict admin routes

const router = Router();

// Public
router.post("/", createAlert);

// Admin-only
router.get("/", requireRole("ADMIN"), getAllAlerts);
router.post("/send", requireRole("ADMIN"), sendAlertNotification);

export default router;