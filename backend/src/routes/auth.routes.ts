//src/routes/auth.routes.ts
import express, { Request, Response, NextFunction } from "express";
import { signup, login, getMe } from "../controllers/auth.controller";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";

const router = express.Router();

/**
 * Enforce signup role: only RENTER or LISTER (default RENTER).
 * Any other incoming value (ADMIN, SUPER_ADMIN, EDITOR, AGENT, etc.) is ignored.
 * This is defense-in-depth even if the frontend is already restricted.
 */
function sanitizeSignupRole(req: Request, _res: Response, next: NextFunction) {
  const incoming = String(req.body?.role || "").trim().toUpperCase();
  const allowed = new Set(["RENTER", "LISTER"]);
  req.body.role = allowed.has(incoming) ? incoming : "RENTER";
  next();
}

// Signup/login/me
router.post("/signup", sanitizeSignupRole, signup);
router.post("/login", login);
router.get("/me", verifyToken, requireAuth, getMe);

export default router;