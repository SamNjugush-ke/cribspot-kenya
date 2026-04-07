// backend/src/controllers/payments.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { Prisma, PaymentStatus, PaymentProvider } from "@prisma/client";
import { initiateStkPush } from "../utils/mpesa";

/** Normalize a Kenyan MSISDN to E.164 (2547XXXXXXXX or 2541XXXXXXXX). */
function normalizeMsisdn(input: string | undefined | null): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D+/g, "");

  // 254XXXXXXXXX (12 digits)
  if (/^254\d{9}$/.test(digits)) return digits;

  // 07/01XXXXXXXX (10 digits)
  if (/^0\d{9}$/.test(digits)) return `254${digits.slice(1)}`;

  // 7/1XXXXXXXX (9 digits)
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;

  return null;
}

/**
 * Build an idempotency key for (user, plan, amount, targetSubscriptionId/new).
 * Important: includes targetSubscriptionId so "buy new" vs "extend existing" don't collide.
 */
function buildIdempotencyKey(
  userId: string,
  planId: string,
  amount: number,
  targetSubscriptionId?: string | null
) {
  return `${userId}:${planId}:${amount}:${targetSubscriptionId ?? "new"}`;
}

/**
 * Activate/extend subscription for a successful payment.
 *
 * ✅ Allows multiple active subscriptions per user (no merging).
 * ✅ If payment.targetSubscriptionId exists: extend that specific subscription row only.
 * ✅ Else: create a new subscription row.
 * ✅ Never deactivates other active subscriptions.
 */
async function activateSubscriptionFromPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { plan: true },
  });

  if (!payment || payment.status !== PaymentStatus.SUCCESS || !payment.plan) return;

  const plan = payment.plan;
  const now = new Date();
  const ms = plan.durationInDays * 24 * 60 * 60 * 1000;

  await prisma.$transaction(async (tx) => {
    // EXTEND A SPECIFIC SUBSCRIPTION
    if (payment.targetSubscriptionId) {
      const sub = await tx.subscription.findUnique({
        where: { id: payment.targetSubscriptionId },
      });

      // Must belong to payer
      if (!sub || sub.userId !== payment.userId) {
        console.warn(
          "[activateSubscriptionFromPayment] targetSubscriptionId not found or not owned by user",
          { paymentId: payment.id, userId: payment.userId, targetSubscriptionId: payment.targetSubscriptionId }
        );
        return;
      }

      const base = sub.expiresAt && sub.expiresAt > now ? sub.expiresAt : now;
      const newExpiry = new Date(base.getTime() + ms);

      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          // keep planId consistent with the payment's plan (useful if plan was changed/renamed)
          planId: plan.id,
          startedAt: sub.startedAt ?? now,
          expiresAt: newExpiry,
          remainingListings: (sub.remainingListings ?? 0) + plan.totalListings,
          remainingFeatured: (sub.remainingFeatured ?? 0) + plan.featuredListings,
          isActive: true, // if it was expired/inactive, bring it back
        },
      });

      return;
    }

    // BUY NEW PLAN (CREATE NEW SUBSCRIPTION ROW)
    const expiresAt = new Date(now.getTime() + ms);

    await tx.subscription.create({
      data: {
        userId: payment.userId,
        planId: plan.id,
        startedAt: now,
        expiresAt,
        remainingListings: plan.totalListings,
        remainingFeatured: plan.featuredListings,
        isActive: true,
      },
    });
  });
}

/** --------- Callback parsing (supports Safaricom-ish shapes) --------- */
type ParsedCallback = {
  providerRef: string | null;
  resultCode: string | null;
  resultDesc: string | null;
  receipt?: string | null;
  phone?: string | null;
  amount?: number | null;
  transactionCode?: string | null;
};

function parseMpesaCallback(body: any): ParsedCallback {
  const providerRef =
    body?.providerRef ??
    body?.CheckoutRequestID ??
    body?.Body?.stkCallback?.CheckoutRequestID ??
    null;

  const resultCode =
    body?.resultCode ??
    body?.ResultCode ??
    body?.Body?.stkCallback?.ResultCode ??
    null;

  const resultDesc =
    body?.resultDesc ??
    body?.ResultDesc ??
    body?.Body?.stkCallback?.ResultDesc ??
    null;

  let receipt: string | null = null;
  let phone: string | null = null;
  let amount: number | null = null;

  const metadataItems: any[] =
    body?.Body?.stkCallback?.CallbackMetadata?.Item ??
    body?.CallbackMetadata?.Item ??
    [];

  if (Array.isArray(metadataItems)) {
    for (const it of metadataItems) {
      const name = it?.Name;
      const val = it?.Value;

      if (name === "MpesaReceiptNumber") receipt = String(val ?? "");
      if (name === "PhoneNumber") phone = String(val ?? "");
      if (name === "Amount") amount = typeof val === "number" ? val : Number(val);
    }
  }

  return {
    providerRef: providerRef ? String(providerRef) : null,
    resultCode: resultCode !== null && resultCode !== undefined ? String(resultCode) : null,
    resultDesc: resultDesc ? String(resultDesc) : null,
    receipt,
    phone,
    amount: Number.isFinite(amount) ? amount : null,
    transactionCode: receipt ? receipt : null,
  };
}

/** Helper: initiate STK for an existing payment row */
async function initiateForPayment(args: {
  paymentId: string;
  planId: string;
  amount: number;
  phone: string;
}) {
  const stk = await initiateStkPush({
    paymentId: args.paymentId,
    planId: args.planId,
    amount: args.amount,
    phone: args.phone,
  });

  const providerRef = stk?.CheckoutRequestID ?? stk?.MerchantRequestID ?? null;
  const providerMsg = stk?.CustomerMessage ?? stk?.ResponseDescription ?? undefined;

  return { providerRef, providerMsg };
}

/** Mark a payment as FAILED when STK initiation did not return a providerRef */
async function failPaymentOnNoProviderRef(args: { paymentId: string; providerMsg?: string }) {
  try {
    await prisma.payment.update({
      where: { id: args.paymentId },
      data: { status: PaymentStatus.FAILED },
    });
  } catch (e) {
    console.error("[payments] failed to mark payment FAILED:", args.paymentId, e);
  }

  return {
    message: "STK push failed to start",
    paymentId: args.paymentId,
    providerMsg: args.providerMsg ?? "No provider reference returned",
  };
}

/** ---------------- B1: Init STK payment ---------------- */
/**
 * POST /api/payments/mpesa/init
 * body: { planId: string, phone: string, targetSubscriptionId?: string }
 *
 * targetSubscriptionId:
 * - provided when extending a specific running subscription
 * - omitted when buying a plan fresh (creates a new subscription row on success)
 */
export const initMpesaPayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { planId, phone, targetSubscriptionId } = req.body as {
      planId?: string;
      phone?: string;
      targetSubscriptionId?: string;
    };

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!planId || !phone) {
      return res.status(400).json({ message: "planId and phone are required" });
    }

    const normalized = normalizeMsisdn(phone);
    if (!normalized) {
      return res.status(400).json({
        message:
          "Invalid phone format. Use 2547XXXXXXXX, 07XXXXXXXX, or +2547XXXXXXXX.",
      });
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return res.status(404).json({ message: "Plan not found or inactive" });
    }

    // If extending, ensure the subscription exists & belongs to the user (early validation).
    if (targetSubscriptionId) {
      const sub = await prisma.subscription.findUnique({ where: { id: targetSubscriptionId } });
      if (!sub || sub.userId !== userId) {
        return res.status(400).json({
          message: "Invalid targetSubscriptionId (not found or not owned by user)",
        });
      }
    }

    const idemKey = buildIdempotencyKey(userId, planId, plan.price, targetSubscriptionId ?? null);

    // Reuse recent pending payment (15 minutes) WITH SAME targetSubscriptionId semantics
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentPending = await prisma.payment.findFirst({
      where: {
        idempotencyKey: idemKey,
        userId,
        planId,
        amount: plan.price,
        targetSubscriptionId: targetSubscriptionId ?? null,
        status: PaymentStatus.PENDING,
        createdAt: { gte: fifteenMinAgo },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentPending) {
      return res.status(200).json({
        message: "Reused pending payment",
        paymentId: recentPending.id,
        providerRef: recentPending.externalRef,
        providerMsg: recentPending.externalRef
          ? "Pending STK already initiated. Check your phone."
          : "Pending payment exists. You may re-initiate if needed.",
      });
    }

    // Create new payment row; handle idempotency collisions cleanly
    let payment;
    try {
      payment = await prisma.payment.create({
        data: {
          userId,
          planId,
          amount: plan.price,
          status: PaymentStatus.PENDING,
          provider: PaymentProvider.MPESA,
          idempotencyKey: idemKey,
          targetSubscriptionId: targetSubscriptionId ?? null,
        },
      });
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const existing = await prisma.payment.findFirst({
          where: {
            idempotencyKey: idemKey,
            userId,
            planId,
            amount: plan.price,
            targetSubscriptionId: targetSubscriptionId ?? null,
          },
          orderBy: { createdAt: "desc" },
        });

        if (!existing) throw e;

        // Already paid: return a consistent response (no new STK)
        if (existing.status === PaymentStatus.SUCCESS) {
          return res.status(200).json({
            message: "Payment already completed",
            paymentId: existing.id,
            providerRef: existing.externalRef,
          });
        }

        // Failed: create a fresh retry row
        if (existing.status === PaymentStatus.FAILED) {
          const retry = await prisma.payment.create({
            data: {
              userId,
              planId,
              amount: plan.price,
              status: PaymentStatus.PENDING,
              provider: PaymentProvider.MPESA,
              targetSubscriptionId: targetSubscriptionId ?? null,
              idempotencyKey: `${idemKey}:retry:${Date.now()}`,
            },
          });

          const stkRes = await initiateForPayment({
            paymentId: retry.id,
            planId,
            amount: plan.price,
            phone: normalized,
          });

          if (!stkRes.providerRef) {
            const payload = await failPaymentOnNoProviderRef({
              paymentId: retry.id,
              providerMsg: stkRes.providerMsg,
            });
            return res.status(502).json(payload);
          }

          return res.status(201).json({
            message: "STK push initiated",
            paymentId: retry.id,
            providerRef: stkRes.providerRef,
            providerMsg: stkRes.providerMsg,
          });
        }

        // PENDING:
        // If stale or missing externalRef, re-initiate on same row.
        const isStale = existing.createdAt < fifteenMinAgo;
        if (isStale || !existing.externalRef) {
          const stkRes = await initiateForPayment({
            paymentId: existing.id,
            planId,
            amount: plan.price,
            phone: normalized,
          });

          if (!stkRes.providerRef) {
            const payload = await failPaymentOnNoProviderRef({
              paymentId: existing.id,
              providerMsg: stkRes.providerMsg,
            });
            return res.status(502).json(payload);
          }

          return res.status(200).json({
            message: "STK push re-initiated",
            paymentId: existing.id,
            providerRef: stkRes.providerRef,
            providerMsg: stkRes.providerMsg ?? "STK re-initiated. Check your phone.",
          });
        }

        // Still fresh and has externalRef → tell user to check phone
        return res.status(200).json({
          message: "Reused existing pending payment",
          paymentId: existing.id,
          providerRef: existing.externalRef,
          providerMsg: "Pending STK already initiated. Check your phone.",
        });
      }

      throw e;
    }

    // Initiate STK push for the new payment row
    const stkRes = await initiateForPayment({
      paymentId: payment.id,
      planId,
      amount: plan.price,
      phone: normalized,
    });

    if (!stkRes.providerRef) {
      const payload = await failPaymentOnNoProviderRef({
        paymentId: payment.id,
        providerMsg: stkRes.providerMsg,
      });
      return res.status(502).json(payload);
    }

    return res.status(201).json({
      message: "STK push initiated",
      paymentId: payment.id,
      providerRef: stkRes.providerRef,
      providerMsg: stkRes.providerMsg,
    });
  } catch (err: any) {
    console.error(
      "[initMpesaPayment] failed:",
      err?.message || err,
      err?.response?.data || ""
    );
    return res.status(500).json({
      message: "Failed to start payment",
      error: err?.message || "Unknown error",
    });
  }
};

/** ---------------- B2: Mpesa callback (idempotent) ---------------- */
/** POST /api/payments/mpesa/callback OR /api/payments/lnm-callback */
export const mpesaCallback = async (req: Request, res: Response) => {
  try {
    const parsed = parseMpesaCallback(req.body || {});

    // Always ACK Safaricom quickly to avoid retries storms
    if (!parsed.providerRef) {
      console.warn("[mpesaCallback] Missing providerRef:", req.body);
      return res.json({ ResultCode: 0, ResultDesc: "OK" });
    }

    const payment = await prisma.payment.findFirst({
      where: { provider: PaymentProvider.MPESA, externalRef: parsed.providerRef },
      include: { plan: true },
    });

    // Even if we can’t match, ACK to stop repeated retries
    if (!payment) {
      console.warn("[mpesaCallback] Payment not found for providerRef:", parsed.providerRef);
      console.warn("[mpesaCallback] Parsed:", {
        providerRef: parsed.providerRef,
        resultCode: parsed.resultCode,
        resultDesc: parsed.resultDesc,
        receipt: parsed.receipt,
      });
      return res.json({ ResultCode: 0, ResultDesc: "OK" });
    }

    // Terminal already? idempotent ACK
    if (payment.status === PaymentStatus.SUCCESS || payment.status === PaymentStatus.FAILED) {
      return res.json({ ResultCode: 0, ResultDesc: "OK" });
    }

    const isSuccess = parsed.resultCode === "0";
    const nextStatus = isSuccess ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;

    console.log("[mpesaCallback] Processing:", {
      paymentId: payment.id,
      userId: payment.userId,
      providerRef: parsed.providerRef,
      resultCode: parsed.resultCode,
      resultDesc: parsed.resultDesc,
      receipt: parsed.receipt,
      amount: parsed.amount,
      phone: parsed.phone,
      targetSubscriptionId: (payment as any).targetSubscriptionId ?? null,
    });

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        ...(parsed.transactionCode ? { transactionCode: parsed.transactionCode } : {}),
      },
    });

    console.log("[mpesaCallback] Updated payment:", {
      paymentId: updated.id,
      status: updated.status,
      transactionCode: updated.transactionCode ?? null,
    });

    if (nextStatus === PaymentStatus.SUCCESS) {
      await activateSubscriptionFromPayment(updated.id);
      console.log("[mpesaCallback] Subscription activated from payment:", updated.id);
    }

    return res.json({ ResultCode: 0, ResultDesc: "OK" });
  } catch (err) {
    console.error("[mpesaCallback] error:", err);
    return res.json({ ResultCode: 0, ResultDesc: "OK" });
  }
};

/** GET /api/payments/mine */
export const getMyPayments = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const payments = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });

    return res.json(payments);
  } catch (err: any) {
    return res
      .status(500)
      .json({ message: "Failed to fetch payments", error: err?.message || err });
  }
};

/** ---------------- B3: Admin list payments with filters + {items, meta} ---------------- */
export const listAllPayments = async (req: Request, res: Response) => {
  try {
    const { status, provider, method, from, to, q, take } = req.query as {
      status?: string;
      provider?: string;
      method?: string;
      from?: string;
      to?: string;
      q?: string;
      take?: string;
    };

    const parsedTake = Number.isFinite(Number(take)) ? Number(take) : 200;
    const safeTake = Math.max(1, Math.min(parsedTake, 500));

    const where: any = {};

    if (status && Object.values(PaymentStatus).includes(status as PaymentStatus)) {
      where.status = status;
    }

    const providerRaw =
      typeof provider === "string" && provider.trim()
        ? provider.trim()
        : typeof method === "string"
        ? method.trim()
        : "";

    if (providerRaw && Object.values(PaymentProvider).includes(providerRaw as PaymentProvider)) {
      where.provider = providerRaw;
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) where.createdAt.lte = d;
      }
      if (Object.keys(where.createdAt).length === 0) delete where.createdAt;
    }

    const qStr = typeof q === "string" ? q.trim() : "";
    if (qStr) {
      where.OR = [
        { externalRef: { contains: qStr, mode: "insensitive" } },
        { transactionCode: { contains: qStr, mode: "insensitive" } },
        { user: { email: { contains: qStr, mode: "insensitive" } } },
      ];
    }

    const items = await prisma.payment.findMany({
      where,
      take: safeTake,
      orderBy: { createdAt: "desc" },
      include: {
        plan: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return res.json({ items, meta: { take: safeTake } });
  } catch (err: any) {
    return res
      .status(500)
      .json({ message: "Failed to fetch payments", error: err?.message || err });
  }
};