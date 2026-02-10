// backend/src/routes/payments.routes.ts
import express from "express";
import prisma from "../utils/prisma";
import {
  initMpesaPayment,
  mpesaCallback,
  getMyPayments,
  listAllPayments,
} from "../controllers/payments.controller";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";
import { requirePermission } from "../middlewares/requirePermission";

const router = express.Router();

// Initiate STK (authenticated)
router.post("/mpesa/init", verifyToken, requireAuth, initMpesaPayment);
router.post("/checkout", verifyToken, requireAuth, initMpesaPayment);
router.post("/stkpush", verifyToken, requireAuth, initMpesaPayment);

// Provider callbacks (unauthenticated)
// Keep both routes pointing to the SAME handler (so you can swap URLs without redeploying)
router.post("/mpesa/callback", mpesaCallback);
router.post("/lnm-callback", mpesaCallback);

// My payments
router.get("/mine", verifyToken, requireAuth, getMyPayments);

// Admin list payments
//router.get("/", verifyToken, requireAuth, requirePermission("VIEW_TRANSACTIONS_ALL"), listAllPayments);
router.get(
  "/",
  verifyToken,
  requireAuth,
  requirePermission("VIEW_TRANSACTIONS_ALL"),
  async (req, res) => {
    try {
      const payments = await prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { email: true } },
        },
      });

      res.json({ items: payments });
    } catch (err) {
      console.error("payments list error", err);
      res.status(500).json({ error: "Failed to load payments" });
    }
  }
);


export default router;