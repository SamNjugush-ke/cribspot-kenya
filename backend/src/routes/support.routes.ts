//backend/src/routes/support.routes.ts
import express from "express";
import {
  createTicket,
  listTickets,
  getTicket,
  replyToTicket,
  changeTicketStatus,
} from "../controllers/support.controller";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";

const router = express.Router();

router.use(verifyToken, requireAuth);

router.post("/tickets", createTicket);
router.get("/tickets", listTickets);
router.get("/tickets/:id", getTicket);
router.post("/tickets/:id/messages", replyToTicket);
router.patch("/tickets/:id/status", changeTicketStatus);

export default router;
