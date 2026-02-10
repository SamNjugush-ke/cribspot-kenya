// backend/src/controllers/admin.exports.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { Parser } from "json2csv";
import { auditLog } from "../utils/audit"; // ✅ FIX: you were calling auditLog without importing it

function getFormat(req: Request) {
  const f = String(req.query.format || "csv").toLowerCase();
  return f === "json" ? "json" : "csv";
}

function sendCsv(res: Response, filename: string, fields: string[], rows: any[]) {
  const parser = new Parser({ fields });
  const csv = parser.parse(rows);
  res.header("Content-Type", "text/csv");
  res.attachment(filename);
  res.send(csv);
}

async function logExport(req: Request, targetId: string) {
  await auditLog(req, {
    action: "EXPORT_TRIGGERED",
    targetType: "EXPORT",
    targetId,
    metadata: { format: req.query.format ?? "csv" },
  });
}

export const exportUsers = async (req: Request, res: Response) => {
  await logExport(req, "users");

  const format = getFormat(req);
  const rows = await prisma.user.findMany({
    select: { id: true, name: true, email: true, phone: true, role: true, isBanned: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (format === "json") return res.json({ items: rows });
  return sendCsv(res, "users.csv", ["id","name","email","phone","role","isBanned","createdAt"], rows);
};

export const exportListings = async (req: Request, res: Response) => {
  await logExport(req, "listings");

  const format = getFormat(req);
  const rows = await prisma.property.findMany({
    select: { id: true, title: true, location: true, county: true, status: true, featured: true, createdAt: true, listerId: true },
    orderBy: { createdAt: "desc" },
  });

  if (format === "json") return res.json({ items: rows });
  return sendCsv(res, "listings.csv", ["id","title","location","county","status","featured","listerId","createdAt"], rows);
};

export const exportPayments = async (req: Request, res: Response) => {
  await logExport(req, "payments");

  const format = getFormat(req);
  const rows = await prisma.payment.findMany({
    select: { id: true, userId: true, planId: true, amount: true, status: true, provider: true, transactionCode: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (format === "json") return res.json({ items: rows });
  return sendCsv(res, "payments.csv", ["id","userId","planId","amount","status","provider","transactionCode","createdAt"], rows);
};

export const exportSubscriptions = async (req: Request, res: Response) => {
  await logExport(req, "subscriptions"); // ✅ add audit parity

  const format = getFormat(req);
  const rows = await prisma.subscription.findMany({
    select: {
      id: true,
      userId: true,
      planId: true,
      startedAt: true,
      expiresAt: true,
      isActive: true,
      remainingListings: true,
      remainingFeatured: true,
    },
    orderBy: { expiresAt: "desc" },
  });

  if (format === "json") return res.json({ items: rows });
  return sendCsv(res, "subscriptions.csv", ["id","userId","planId","startedAt","expiresAt","isActive","remainingListings","remainingFeatured"], rows);
};

export const exportAudit = async (req: Request, res: Response) => {
  await logExport(req, "audit");

  const format = getFormat(req);

  // Keep it “export-friendly”: actorId/action/target + metadata stringified
  const rows = await prisma.auditLog.findMany({
    select: {
      id: true,
      actorId: true,
      action: true,
      targetType: true,
      targetId: true,
      impersonatedUserId: true,
      ip: true,
      userAgent: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Flatten for CSV
  const flat = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    action: r.action,
    actorId: r.actorId ?? "",
    actorEmail: r.actor?.email ?? "",
    actorName: r.actor?.name ?? "",
    impersonatedUserId: r.impersonatedUserId ?? "",
    targetType: r.targetType ?? "",
    targetId: r.targetId ?? "",
    ip: r.ip ?? "",
    userAgent: r.userAgent ?? "",
    metadata: r.metadata ? JSON.stringify(r.metadata) : "",
  }));

  if (format === "json") return res.json({ items: flat });

  return sendCsv(
    res,
    "audit.csv",
    ["id","createdAt","action","actorId","actorEmail","actorName","impersonatedUserId","targetType","targetId","ip","userAgent","metadata"],
    flat
  );
};