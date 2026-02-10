import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";

export const requireRole = (roles: Role | Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
   
    const userRole = user.role as Role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "Forbidden – Insufficient role" });
    }

    next();
  };
};