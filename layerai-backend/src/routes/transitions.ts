import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { env } from "../config/env.js";

export const transitionsRouter = Router();

const transitionSchema = z.object({
  clipAUrl: z.string().url(),
  clipBUrl: z.string().url(),
  transitionType: z.enum([
    "crossfade",
    "whip",
    "zoom",
    "cut",
    "dissolve",
    "wipe-left",
    "wipe-right",
    "morph",
  ]).default("crossfade"),
  duration: z.number().min(0.1).max(3.0).default(0.5),
});

// POST /api/transitions/apply - Apply transition between clips
transitionsRouter.post("/apply", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = transitionSchema.parse(req.body);

    // Call Python FFmpeg service
    const response = await fetch(`${env.PYTHON_API_URL}/transitions/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`FFmpeg service error: ${response.status}`);
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

// GET /api/transitions/types - List available transition types
transitionsRouter.get("/types", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      transitions: [
        { id: "cut", name: "Cut", description: "Hard cut between clips", duration: 0 },
        { id: "crossfade", name: "Crossfade", description: "Smooth blend between clips", duration: 0.5 },
        { id: "dissolve", name: "Dissolve", description: "Gradual dissolve transition", duration: 0.5 },
        { id: "whip", name: "Whip Pan", description: "Fast motion blur transition", duration: 0.3 },
        { id: "zoom", name: "Zoom", description: "Zoom in/out transition", duration: 0.5 },
        { id: "wipe-left", name: "Wipe Left", description: "Wipe from right to left", duration: 0.5 },
        { id: "wipe-right", name: "Wipe Right", description: "Wipe from left to right", duration: 0.5 },
        { id: "morph", name: "Morph", description: "AI-powered morph between clips", duration: 1.0 },
      ],
    },
  });
});

// POST /api/transitions/render-proxy - Pre-render transition segment as proxy video
transitionsRouter.post("/render-proxy", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      clipAUrl: z.string().url(),
      clipBUrl: z.string().url(),
      transitionType: z.string(),
      duration: z.number().min(0.1).max(5.0).default(0.5),
      clipAEndTime: z.number(),
      clipBStartTime: z.number(),
      maxWidth: z.number().min(320).max(1280).default(640),
    }).parse(req.body);

    const response = await fetch(`${env.PYTHON_API_URL}/transitions/render-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FFmpeg service error: ${response.status} - ${errorText}`);
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

// POST /api/transitions/preview - Generate transition preview
transitionsRouter.post("/preview", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      clipAFrame: z.string().url(),
      clipBFrame: z.string().url(),
      transitionType: z.string(),
      progress: z.number().min(0).max(1).default(0.5),
    }).parse(req.body);

    // Call Python FFmpeg service for preview frame
    const response = await fetch(`${env.PYTHON_API_URL}/transitions/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`FFmpeg service error: ${response.status}`);
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
