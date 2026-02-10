import { Request } from "express";
import prisma from "./prisma";

type AuditInput = {
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: any;
};

function getClientIp(req: Request) {
  // If behind proxy, ensure app.set("trust proxy", 1)
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.ip;
}

export async function auditLog(req: Request, input: AuditInput) {
  try {
    const user = req.user as any | undefined;

    const isImpersonated = Boolean(user?.impersonated);
    const actorId = isImpersonated ? user?.impersonatorId : user?.id;
    const impersonatedUserId = isImpersonated ? user?.id : undefined;

    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata ?? {},
        impersonatedUserId: impersonatedUserId ?? null,
        ip: getClientIp(req) ?? null,
        userAgent: String(req.headers["user-agent"] || "") || null,
      },
    });
  } catch (err) {
    // never break primary action due to audit failure
    console.error("auditLog failed:", err);
  }
}
