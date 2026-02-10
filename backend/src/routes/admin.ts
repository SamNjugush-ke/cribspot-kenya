//src/routes/admin.ts
import express from "express";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";
import { requireRole } from "../middlewares/requireRole";
import { requirePermission } from "../middlewares/requirePermission";
import { Parser as Json2Csv } from "json2csv";
import ExcelJS from "exceljs";
import prisma from "../utils/prisma";

const router = express.Router();

/**
 * ====================
 * DASHBOARD
 * ====================
 */
router.get(
  "/dashboard",
  verifyToken,
  requireAuth,
  requireRole("SUPER_ADMIN"),
  (_req, res) => {
    res.json({ message: "Welcome Super Admin" });
  }
);

/**
 * ====================
 * PLANS
 * ====================
 */
router.get("/plans", requirePermission("MANAGE_PACKAGES"), async (_req, res) => {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(plans);
});

router.post("/plans", requirePermission("MANAGE_PACKAGES"), async (req, res) => {
  const { name, price, durationInDays, totalListings, featuredListings, isActive } =
    req.body;

  const plan = await prisma.subscriptionPlan.create({
    data: {
      name,
      price,
      durationInDays,
      totalListings,
      featuredListings,
      isActive: !!isActive,
    },
  });
  res.json(plan);
});

router.patch("/plans/:id", requirePermission("MANAGE_PACKAGES"), async (req, res) => {
  const { id } = req.params;
  const { name, price, durationInDays, totalListings, featuredListings, isActive } =
    req.body;

  const plan = await prisma.subscriptionPlan.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(durationInDays !== undefined ? { durationInDays } : {}),
      ...(totalListings !== undefined ? { totalListings } : {}),
      ...(featuredListings !== undefined ? { featuredListings } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });
  res.json(plan);
});

router.delete("/plans/:id", requirePermission("MANAGE_PACKAGES"), async (req, res) => {
  const { id } = req.params;
  await prisma.subscriptionPlan.delete({ where: { id } });
  res.json({ ok: true });
});

/**
 * ====================
 * COUPONS
 * ====================
 */
router.get("/coupons", requirePermission("MANAGE_PACKAGES"), async (_req, res) => {
  const coupons = await prisma.coupon.findMany({
    include: { applicablePlans: { include: { subscriptionPlan: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(coupons);
});

router.post("/coupons", requirePermission("MANAGE_PACKAGES"), async (req, res) => {
  const { code, percentOff, amountOff, startsAt, endsAt, planIds, isActive } =
    req.body;

  const coupon = await prisma.coupon.create({
    data: {
      code,
      percentOff,
      amountOff,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      isActive: !!isActive,
      applicablePlans: {
        create: (planIds || []).map((planId: string) => ({
          subscriptionPlan: { connect: { id: planId } },
        })),
      },
    },
    include: { applicablePlans: { include: { subscriptionPlan: true } } },
  });

  res.json(coupon);
});

router.patch("/coupons/:id", requirePermission("MANAGE_PACKAGES"), async (req, res) => {
  const { id } = req.params;
  const { code, percentOff, amountOff, startsAt, endsAt, isActive } = req.body;

  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      ...(code !== undefined ? { code } : {}),
      ...(percentOff !== undefined ? { percentOff } : {}),
      ...(amountOff !== undefined ? { amountOff } : {}),
      ...(startsAt !== undefined ? { startsAt: new Date(startsAt) } : {}),
      ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
    include: { applicablePlans: { include: { subscriptionPlan: true } } },
  });

  res.json(coupon);
});

router.delete("/coupons/:id", requirePermission("MANAGE_PACKAGES"), async (req, res) => {
  const { id } = req.params;
  await prisma.coupon.delete({ where: { id } });
  res.json({ ok: true });
});

/**
 * ====================
 * SUBSCRIPTIONS (admin oversight)
 * ====================
 */
router.get(
  "/subscriptions",
  requirePermission("MANAGE_PACKAGES"),
  async (_req, res) => {
    const subs = await prisma.subscription.findMany({
      include: { user: true, plan: true },
      orderBy: { startedAt: "desc" },
    });
    res.json(subs);
  }
);

router.patch(
  "/subscriptions/:id/expire",
  requirePermission("MANAGE_PACKAGES"),
  async (req, res) => {
    const { id } = req.params;
    const sub = await prisma.subscription.update({
      where: { id },
      data: { isActive: false, expiresAt: new Date() },
    });
    res.json(sub);
  }
);

router.patch(
  "/subscriptions/:id/reactivate",
  requirePermission("MANAGE_PACKAGES"),
  async (req, res) => {
    const { id } = req.params;
    const sub = await prisma.subscription.update({
      where: { id },
      data: { isActive: true },
    });
    res.json(sub);
  }
);

/**
 * ====================
 * PAYMENTS (view + admin actions)
 * ====================
 */
router.get("/payments", requirePermission("VIEW_TRANSACTIONS_ALL"), async (_req, res) => {
  const payments = await prisma.payment.findMany({
    include: { user: true, plan: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(payments);
});

// Example manual refund endpoint (stub)
router.post(
  "/payments/:id/refund",
  requirePermission("MANUAL_REFUND"),
  async (req, res) => {
    const { id } = req.params;
    // In production: integrate with Mpesa/Card APIs for refund
    const payment = await prisma.payment.update({
      where: { id },
      data: { status: "REFUNDED" as any },
    });
    res.json({ message: "Refund processed (stub)", payment });
  }
);

/**
 * ====================
 * REPORTS EXPORT
 * ====================
 */
router.get("/reports/:res", requirePermission("EXPORT_DATA"), async (req, res) => {
  try {
    const { res: resource } = req.params as any;
    const { format = "csv" } = req.query as any;

    let rows: any[] = [];
    if (resource === "users") {
      rows = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
    } else if (resource === "payments") {
      rows = await prisma.payment.findMany({
        select: {
          id: true,
          amount: true,
          status: true,
          provider: true,
          externalRef: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } else if (resource === "subscriptions") {
      rows = await prisma.subscription.findMany({
        select: {
          id: true,
          userId: true,
          planId: true,
          isActive: true,
          startedAt: true,
          expiresAt: true,
        },
      });
    } else if (resource === "plans") {
      rows = await prisma.subscriptionPlan.findMany({
        select: {
          id: true,
          name: true,
          price: true,
          isActive: true,
          createdAt: true,
        },
      });
    } else if (resource === "listings") {
      rows = await prisma.property.findMany({
        select: {
          id: true,
          title: true,
          county: true,
          status: true,
          featured: true,
          createdAt: true,
        },
      });
    } else {
      return res.status(400).json({ error: "Unknown resource" });
    }

    if (format === "xlsx") {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(resource);
      if (rows.length) ws.columns = Object.keys(rows[0]).map((k) => ({ header: k, key: k }));
      rows.forEach((r) => ws.addRow(r));
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${resource}.xlsx"`);
      await wb.xlsx.write(res);
      return res.end();
    }

    // Default CSV
    const parser = new Json2Csv({ fields: rows.length ? Object.keys(rows[0]) : [] });
    const csv = parser.parse(rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${resource}.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error("export error", err);
    res.status(500).json({ error: "Failed to export report" });
  }
});

export default router;
