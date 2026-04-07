import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../utils/prisma";
import { generateToken } from "../utils/jwt";
import { sendMail } from "../utils/mailer";
import { generateTokenPair, hashToken, minutesFromNow } from "../utils/tokens";
import { resetPasswordTemplate, verifyEmailTemplate } from "../utils/emailTemplates";

/** Normalize a Kenyan MSISDN to digits-only E.164 (2547XXXXXXXX or 2541XXXXXXXX). */
function normalizeMsisdn(input: string | undefined | null): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D+/g, "");

  // Already 254XXXXXXXXX (12 digits)
  if (/^254\d{9}$/.test(digits)) return digits;

  // 07/01XXXXXXXX (10 digits)
  if (/^0\d{9}$/.test(digits)) return `254${digits.slice(1)}`;

  // 7/1XXXXXXXX (9 digits)
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;

  return null;
}

function webUrl() {
  const value = (
    process.env.WEB_URL ||
    process.env.FRONTEND_URL ||
    "https://www.cribspot.co.ke"
  ).replace(/\/+$/, "");

  console.log("[MAIL_LINK_BASE]", {
    WEB_URL: process.env.WEB_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    resolved: value,
  });

  return value;
}

async function trySendMailOrNull(payload: { to: string; subject: string; html: string }) {
  try {
    await sendMail(payload);
    return { ok: true as const };
  } catch (e: any) {
    // Log once; do not fail the whole auth flow.
    console.error("[MAIL] send failed:", e?.message || e);
    return { ok: false as const, error: e };
  }
}

export const signup = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, phone } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      phone?: string;
    };

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email and password are required" });
    }

    // ✅ phone required for all accounts
    const normalizedPhone = normalizeMsisdn(phone);
    if (!normalizedPhone) {
      return res.status(400).json({
        message: "Phone is required and must be valid (e.g. 2547XXXXXXXX or 07XXXXXXXX).",
      });
    }

    const emailLower = String(email).trim().toLowerCase();

    // ✅ enforce unique email (one email per account)
    const existingUser = await prisma.user.findUnique({ where: { email: emailLower } });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use." });
    }

    // enforce unique phone (digits-only stored)
    const existingPhone = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (existingPhone) {
      return res.status(400).json({ message: "Phone number already in use." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: emailLower,
        password: hashedPassword,
        role: role as any,
        phone: normalizedPhone,
        // ✅ new accounts must verify email (existing users remain verified via default=true)
        emailVerified: false,
        emailVerifiedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
      },
    });

    // ✅ Create verification token + store hash
    const { token, tokenHash } = generateTokenPair(32);
    const expiresAt = minutesFromNow(30);

    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const verifyUrl = `${webUrl()}/verify-email?token=${token}`;

    // ✅ IMPORTANT: do not fail signup if email sending fails
    const sent = await trySendMailOrNull({
      to: user.email,
      subject: "Confirm your email - CribSpot Kenya",
      html: verifyEmailTemplate({ name: user.name, verifyUrl }),
    });

    return res.status(201).json({
      message: sent.ok
        ? "Registration successful. Please check your email (including spam) to confirm your email address before logging in."
        : "Registration successful, but we couldn't send the verification email right now. Please use 'Resend email' on the signup page in a moment.",
      mailSent: sent.ok,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const target = Array.isArray(err?.meta?.target) ? err.meta.target.join(",") : String(err?.meta?.target || "");
      if (target.includes("email")) return res.status(400).json({ message: "Email already in use." });
      if (target.includes("phone")) return res.status(400).json({ message: "Phone number already in use." });
      return res.status(400).json({ message: "Duplicate value." });
    }

    return res.status(500).json({ message: "Signup failed", error: err?.message || err });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const emailLower = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: emailLower } });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.isBanned) {
      return res.status(403).json({
        message: "Your account is currently banned from accessing the site. If you believe this is an error, please use the Contact Us page to reach the admin team.",
        code: "ACCOUNT_BANNED",
      });
    }

    // ✅ Gate login on email verification (but don't lock out old accounts: default=true)
    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Please confirm your email before logging in.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken({ id: user.id, role: user.role });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone ?? null,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ message: "Login failed", error: err?.message || err });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const token = String(req.query?.token || "").trim();
    if (!token) return res.status(400).json({ message: "Missing token" });

    const tokenHash = hashToken(token);
    const row = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!row) return res.status(400).json({ message: "Invalid or expired token" });
    if (row.expiresAt.getTime() < Date.now()) {
      await prisma.emailVerificationToken.delete({ where: { tokenHash } }).catch(() => null);
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    await prisma.user.update({
      where: { id: row.userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });

    await prisma.emailVerificationToken.delete({ where: { tokenHash } }).catch(() => null);

    return res.json({ ok: true, message: "Email confirmed" });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to verify email", error: err?.message || err });
  }
};

export const resendVerification = async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    const emailLower = String(email || "").trim().toLowerCase();
    if (!emailLower) return res.status(400).json({ message: "email is required" });

    const user = await prisma.user.findUnique({ where: { email: emailLower } });
    if (!user) return res.status(404).json({ message: "No account found for that email." });
    if (user.emailVerified) return res.status(200).json({ message: "Email is already confirmed." });

    const { token, tokenHash } = generateTokenPair(32);
    const expiresAt = minutesFromNow(30);

    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    await prisma.emailVerificationToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

    const verifyUrl = `${webUrl()}/verify-email?token=${token}`;

    const sent = await trySendMailOrNull({
      to: user.email,
      subject: "Confirm your email - CribSpot Kenya",
      html: verifyEmailTemplate({ name: user.name, verifyUrl }),
    });

    if (!sent.ok) {
      return res.status(503).json({
        message: "Verification email could not be sent right now. Please try again in a few minutes.",
        code: "MAIL_UNAVAILABLE",
      });
    }

    return res.json({ message: "Verification email resent. Please check your inbox (and spam)." });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to resend verification email", error: err?.message || err });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    const emailLower = String(email || "").trim().toLowerCase();
    if (!emailLower) return res.status(400).json({ message: "email is required" });

    const user = await prisma.user.findUnique({ where: { email: emailLower } });
    if (!user) {
      return res.status(404).json({
        message: "We couldn't find an account with that email. Please sign up or confirm your email.",
        code: "EMAIL_NOT_FOUND",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Please confirm your email first. Use 'Resend verification email' then try again.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    const { token, tokenHash } = generateTokenPair(32);
    const expiresAt = minutesFromNow(30);

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

    const resetUrl = `${webUrl()}/reset-password?token=${token}`;

    const sent = await trySendMailOrNull({
      to: user.email,
      subject: "Reset your password - CribSpot Kenya",
      html: resetPasswordTemplate({ name: user.name, resetUrl }),
    });

    if (!sent.ok) {
      return res.status(503).json({
        message: "Password reset email could not be sent right now. Please try again in a few minutes.",
        code: "MAIL_UNAVAILABLE",
      });
    }

    return res.json({ message: "Password reset link sent. Please check your email (and spam)." });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to start password reset", error: err?.message || err });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password) return res.status(400).json({ message: "token and password are required" });

    const tokenHash = hashToken(String(token).trim());

    const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!row) return res.status(400).json({ message: "Invalid or expired token" });

    if (row.usedAt) return res.status(400).json({ message: "Token already used" });

    if (row.expiresAt.getTime() < Date.now()) {
      await prisma.passwordResetToken.delete({ where: { tokenHash } }).catch(() => null);
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: row.userId },
      data: { password: hashedPassword },
    });

    await prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    });

    return res.json({ ok: true, message: "Password updated successfully" });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to reset password", error: err?.message || err });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
      },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to load profile", error: err?.message || err });
  }
};