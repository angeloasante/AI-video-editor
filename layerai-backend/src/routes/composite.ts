import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { env } from "../config/env.js";

export const compositeRouter = Router();

const compositeSchema = z.object({
  projectId: z.string(),
  layers: z.array(z.object({
    id: z.string(),
    url: z.string().url(),
    type: z.enum(["video", "image", "audio"]),
    startTime: z.number().default(0),
    duration: z.number().optional(),
    position: z.object({
      x: z.number().default(0),
      y: z.number().default(0),
    }).optional(),
    scale: z.number().default(1),
    opacity: z.number().min(0).max(1).default(1),
    zIndex: z.number().default(0),
  })),
  output: z.object({
    width: z.number().default(1920),
    height: z.number().default(1080),
    fps: z.number().default(30),
  }).optional(),
});

// POST /api/composite - Composite layers via Python FFmpeg service
compositeRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = compositeSchema.parse(req.body);

    // Call Python backend for FFmpeg compositing
    const response = await fetch(`${env.PYTHON_API_URL}/ffmpeg/composite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Python service error: ${error}`);
    }

    const result = await response.json();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});
