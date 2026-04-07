import { Router } from "express";
import rateLimit from "express-rate-limit";
import { submitContactForm, validateContactEmail } from "../controllers/contact.controller";

const router = Router();

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Too many contact requests. Please try again shortly." },
});

const validationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { valid: false, message: "Too many email checks. Please try again shortly." },
});

router.post("/validate-email", validationLimiter, validateContactEmail);
router.post("/", contactLimiter, submitContactForm);

export default router;
