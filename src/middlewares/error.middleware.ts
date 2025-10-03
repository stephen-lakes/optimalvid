import { Request, Response, NextFunction } from "express";

export default function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error("🔥 Error:", err);

  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
}
