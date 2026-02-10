// backend/src/middlewares/optionalAuth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET, type JwtPayload } from "../utils/jwt";

/**
 * optionalAuth
 * - If a Bearer token exists, verify it and attach req.user
 * - If no token (or invalid), do NOT error — just continue unauthenticated
 */
export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  const token = header.slice("Bearer ".length).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
  } catch {
    // ignore bad token; proceed as anonymous
  }
  return next();
};