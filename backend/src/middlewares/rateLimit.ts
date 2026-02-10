// src/middlewares/rateLimit.ts
import rateLimit from "express-rate-limit";
import type { Request } from "express";

// IPv6-safe + proxy-aware key generator
const ipv6SafeKey = (req: Request) => {
  const xff = req.headers["x-forwarded-for"];
  const forwarded = Array.isArray(xff) ? xff[0] : xff?.split(",")[0];
  const raw = (forwarded?.trim() || req.ip || req.socket.remoteAddress || "").toString();
  // Normalize IPv4-mapped IPv6 like ::ffff:127.0.0.1
  return raw.replace(/^::ffff:/, "");
};

export const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,                 // v7 uses `limit`
  standardHeaders: "draft-7", // v7 style headers
  legacyHeaders: false,
  keyGenerator: ipv6SafeKey,
});

// General limiter (no custom key)
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// Tighter limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// Blog comments rate limiter
export const commentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});