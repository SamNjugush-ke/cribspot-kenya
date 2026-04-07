// backend/src/routes/support.routes.ts
import { Router } from "express";
import multer from "multer";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";
import {
  createTicket,
  listTickets,
  getTicket,
  replyToTicket,
  changeTicketStatus,
} from "../controllers/support.controller";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 2,
  },
});

// ✅ CRITICAL: ensure req.user exists for requireAuth
router.use(verifyToken);
router.use(requireAuth);

router.post(
  "/tickets",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "files", maxCount: 2 },
  ]),
  createTicket
);

router.get("/tickets", listTickets);
router.get("/tickets/:id", getTicket);

router.post(
  "/tickets/:id/messages",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "files", maxCount: 2 },
  ]),
  replyToTicket
);

router.patch("/tickets/:id/status", changeTicketStatus);

export default router;