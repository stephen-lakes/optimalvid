import express, { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Redis from "ioredis";

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 4000;

// ---- Redis Client ----
const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
});

app.use(express.json());

// ---- JWT Secret ----
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// ---- Swagger Setup ----
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Video Metadata API",
      version: "1.0.0",
      description:
        "API for managing video metadata with user authentication + caching",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/index.ts"],
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ---- Validation Schemas ----
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const videoSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  duration: z.number().int().positive(),
  genre: z.string(),
  tags: z.array(z.string()).optional(),
});

// ---- Auth Middleware ----
function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Access token required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    (req as any).user = user;
    next();
  });
}

// ---- User Routes ----
app.post("/auth/register", async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: { email: data.email, password: hashedPassword },
    });

    res.status(201).json({ id: user.id, email: user.email });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/users/me", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        createdAt: true,
        videos: true,
      },
    });

    if (!me) return res.status(404).json({ error: "User not found" });

    res.json(me);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Video Routes ----
app.post("/videos", authenticateToken, async (req: Request, res: Response) => {
  try {
    const data = videoSchema.parse(req.body);
    const user = (req as any).user;

    const video = await prisma.video.create({
      data: { ...data, tags: data.tags || [], userId: user.id },
    });

    // Invalidate Redis cache
    await redis.flushall();

    res.status(201).json(video);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/videos", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { genre, skip = "0", take = "10" } = req.query;
    const cacheKey = `videos:${genre || "all"}:${skip}:${take}`;

    // Check Redis cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Fetch from DB
    const videos = await prisma.video.findMany({
      where: genre ? { genre: String(genre) } : undefined,
      skip: Number(skip),
      take: Number(take),
    });

    // Cache result for 60s
    await redis.set(cacheKey, JSON.stringify(videos), "EX", 60);

    res.json(videos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put(
  "/videos/:id",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = videoSchema.partial().parse(req.body);
      const user = (req as any).user;

      const updated = await prisma.video.updateMany({
        where: { id, userId: user.id },
        data,
      });

      if (updated.count === 0) {
        return res
          .status(403)
          .json({ error: "Not allowed or video not found" });
      }

      // Invalidate cache
      await redis.flushall();

      const video = await prisma.video.findUnique({ where: { id } });
      res.json(video);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

app.delete(
  "/videos/:id",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      const deleted = await prisma.video.deleteMany({
        where: { id, userId: user.id },
      });

      if (deleted.count === 0) {
        return res
          .status(403)
          .json({ error: "Not allowed or video not found" });
      }

      // Invalidate cache
      await redis.flushall();

      res.json({ message: "Video deleted successfully" });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port} 🚀 `);
  console.log(`Swagger docs at http://localhost:${port}/api-docs`);
});
