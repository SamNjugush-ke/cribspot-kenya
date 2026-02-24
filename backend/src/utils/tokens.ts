import crypto from "crypto";

/**
 * Generate a random token (URL-safe-ish) and its SHA-256 hash for storage.
 * We store only the hash in DB so leaked DB rows can't be used as live tokens.
 */
export function generateTokenPair(bytes = 32) {
  const token = crypto.randomBytes(bytes).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function minutesFromNow(mins: number) {
  return new Date(Date.now() + mins * 60_000);
}
