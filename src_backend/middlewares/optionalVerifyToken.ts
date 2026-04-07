import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../utils/prisma";

export const optionalVerifyToken = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, name: true, email: true, phone: true },
    });

    (req as any).user = user || undefined;
    next();
  } catch {
    // swallow token errors for public routes
    return next();
  }
};
