import express from "express";
import { Role } from "@prisma/client";

import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";
import { requireRole } from "../middlewares/requireRole";

import { sendBroadcast, listBroadcastHistory } from "../controllers/admin.broadcasts.controller";

const router = express.Router();

router.use(verifyToken, requireAuth);

// Keep it simple + reliable: only ADMIN/SUPER_ADMIN can broadcast.
// (No dependency on a specific Permission enum value.)
router.post("/send", requireRole([Role.ADMIN, Role.SUPER_ADMIN]), sendBroadcast);
router.get("/history", requireRole([Role.ADMIN, Role.SUPER_ADMIN]), listBroadcastHistory);

export default router;