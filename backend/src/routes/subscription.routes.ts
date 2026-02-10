//subscription.routes.ts
import express from "express";
import { subscribeToPlan, getMySubscription, getUsage } from "../controllers/subscription.controller";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";

const router = express.Router();

router.post("/", verifyToken, requireAuth, subscribeToPlan);
router.get("/me", verifyToken, requireAuth, getMySubscription);
router.get("/usage", verifyToken, requireAuth, getUsage);

export default router;