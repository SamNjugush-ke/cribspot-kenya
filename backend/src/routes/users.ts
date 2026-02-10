import { Router } from "express";
import prisma from "../utils/prisma";
import { updateMyProfile } from "../controllers/user.controller";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// GET /api/users?q=&role=
router.get("/", verifyToken, requireAuth, async (req, res) => {
  const q = String(req.query.q || ""); const role = String(req.query.role || "");
  const where: any = {
    AND: [
      q ? { OR: [{ name:{contains:q, mode:"insensitive"} }, { email:{contains:q, mode:"insensitive"} }] } : {},
      role ? { role: role as any } : {},
    ]
  };
  const users = await prisma.user.findMany({
    where,
    select: { id:true, name:true, email:true, role:true, createdAt:true },
    orderBy: { createdAt: "desc" }
  });
  res.json(users);
});

// PATCH /api/users/:id
router.patch("/:id", verifyToken, requireAuth, updateMyProfile);

export default router;
