import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import authMiddleware from "../middlewares/auth.middleware";
import redisClient from "../utils/redisClient";

const prisma = new PrismaClient();
const router = Router();

// Create video
router.post("/", authMiddleware, async (req: any, res) => {
  const { title, description, duration, genre, tags } = req.body;
  const video = await prisma.video.create({
    data: {
      title,
      description,
      duration,
      genre,
      tags: tags ? tags.split(",") : [],
      userId: req.userId,
    },
  });
  res.json(video);
});

// Get videos (with caching)
router.get("/", async (req, res) => {
  const { genre, tag, page = 1, limit = 10 } = req.query;
  const cacheKey = `videos:${genre || "all"}:${tag || "all"}:${page}:${limit}`;

  const cached = await redisClient.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  const filters: any = {};
  if (genre) filters.genre = genre;
  if (tag) filters.tags = { has: tag };

  const videos = await prisma.video.findMany({
    where: filters,
    skip: (Number(page) - 1) * Number(limit),
    take: Number(limit),
  });

  await redisClient.setEx(cacheKey, 60, JSON.stringify(videos));
  res.json(videos);
});

// Update video
router.put("/:id", authMiddleware, async (req: any, res) => {
  const { id } = req.params;
  const { title, description, duration, genre, tags } = req.body;

  const video = await prisma.video.update({
    where: { id: Number(id) },
    data: {
      title,
      description,
      duration,
      genre,
      tags: tags ? tags.split(",") : [],
    },
  });
  res.json(video);
});

// Delete video
router.delete("/:id", authMiddleware, async (req: any, res) => {
  const { id } = req.params;
  await prisma.video.delete({ where: { id: Number(id) } });
  res.json({ message: "Video deleted" });
});

export default router;
