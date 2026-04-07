// backend/src/utils/jwt.ts
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

export type JwtPayload = {
  id: string;
  role: string;
  email?: string;
  impersonated?: boolean;
  impersonatorId?: string;
  impersonatedUserId?: string;
};

export const JWT_SECRET: Secret = process.env.JWT_SECRET || "fallbacksecret";

export function generateToken(payload: JwtPayload | Record<string, any>): string {
  const opts: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"],
  };

  return jwt.sign(payload as object, JWT_SECRET, opts);
}

export function verifyJwt(token: string) {
  return jwt.verify(token, JWT_SECRET);
}