import express from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";
import { requirePermission } from "../middlewares/requirePermission";
import { sendBroadcast } from "../controllers/admin.broadcasts.controller";

const router = express.Router();

router.use(verifyToken, requireAuth);

// You can split these later (SEND_INAPP_BROADCAST, SEND_EMAIL_BROADCAST)
// For now: one permission is fine.
//router.post("/send", requirePermission("SEND_BROADCASTS"), sendBroadcast);

export default router;
