import { Router, Request, Response } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "layerai-backend",
    version: "1.0.0",
  });
});

healthRouter.get("/ready", async (_req: Request, res: Response) => {
  // Add checks for dependencies (Redis, Supabase, etc.)
  const checks = {
    server: true,
    timestamp: new Date().toISOString(),
  };

  res.json(checks);
});
