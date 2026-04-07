// src/routes/test.ts
import { Router } from "express";
import prisma from "../utils/prisma";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany(); // Replace 'user' with your model if defined
    res.json(users);
  } catch (err) {
    console.error("Test error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;