// backend/src/routes/payments.routes.ts
import express from "express";
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

// Initiate STK payment. Authenticated only.
router.post("/mpesa/init", verifyToken, requireAuth, initMpesaPayment);
router.post("/checkout", verifyToken, requireAuth, initMpesaPayment);
router.post("/stkpush", verifyToken, requireAuth, initMpesaPayment);

// Provider callbacks. Unauthenticated because Safaricom calls these.
router.post("/mpesa/callback", mpesaCallback);
router.post("/lnm-callback", mpesaCallback);

// Current user's payment history.
router.get("/mine", verifyToken, requireAuth, getMyPayments);

// Admin / super-admin transaction list.
// Uses the controller with filters and plan/user includes.
router.get(
  "/",
  verifyToken,
  requireAuth,
  requirePermission("VIEW_TRANSACTIONS_ALL"),
  listAllPayments
);

export default router;