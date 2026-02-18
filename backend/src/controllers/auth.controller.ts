import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../utils/prisma";
import { generateToken } from "../utils/jwt";

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

export const signup = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, phone } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      phone?: string;
    };

    // Basic validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "name, email, password and role are required." });
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
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
      },
    });

    // ✅ no token on signup (future email verification friendly)
    return res.status(201).json({
      message: "User created",
      user,
    });
  } catch (err: any) {
    // Handle unique constraint collisions gracefully (race conditions)
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

export const getMe = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        createdAt: true,
      },
    });

    if (!user) return res.status(404).json({ message: "User not found." });

    return res.json({ user });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to retrieve user", error: err?.message || err });
  }
};