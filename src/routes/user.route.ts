import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import authMiddleware from "../middlewares/auth.middleware";

const prisma = new PrismaClient();
const router = Router();

// Get current user
router.get("/me", authMiddleware, async (req: any, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { videos: true },
  });
  res.json(user);
});

export default router;
