import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { env } from "../config/env.js";

export const textRouter = Router();

// Position schema
const positionSchema = z.object({
  x: z.string().default("(w-text_w)/2"),
  y: z.string().default("h-th-40"),
});

// Style schema
const styleSchema = z.object({
  fontSize: z.number().min(8).max(200).default(48),
  fontColor: z.string().default("white"),
  fontFile: z.string().default("/app/fonts/Inter-Bold.ttf"),
  box: z.boolean().default(true),
  boxColor: z.string().default("black@0.5"),
  boxBorderWidth: z.number().default(10),
  shadowX: z.number().default(2),
  shadowY: z.number().default(2),
  shadowColor: z.string().default("black@0.8"),
});

// Basic text overlay schema
const textOverlaySchema = z.object({
  projectId: z.string(),
  videoUrl: z.string().url(),
  text: z.string().min(1),
  position: positionSchema.optional(),
  style: styleSchema.optional(),
  startTime: z.number().min(0).default(0),
  endTime: z.number().optional(),
});

// POST /api/text/overlay - Add text overlay to video
textRouter.post("/overlay", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = textOverlaySchema.parse(req.body);

    const response = await fetch(`${env.PYTHON_API_URL}/text/overlay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Python service error: ${error}`);
    }

    const result = await response.json();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Fade text schema
const fadeTextSchema = z.object({
  projectId: z.string(),
  videoUrl: z.string().url(),
  text: z.string().min(1),
  position: positionSchema.optional(),
  style: styleSchema.optional(),
  startTime: z.number().min(0).default(0),
  fadeInDuration: z.number().min(0).max(5).default(0.5),
  holdDuration: z.number().min(0).default(2),
  fadeOutDuration: z.number().min(0).max(5).default(0.5),
});

// POST /api/text/fade - Add text with fade in/out animation
textRouter.post("/fade", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = fadeTextSchema.parse(req.body);

    const response = await fetch(`${env.PYTHON_API_URL}/text/fade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Python service error: ${error}`);
    }

    const result = await response.json();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Caption word schema
const captionWordSchema = z.object({
  text: z.string(),
  startTime: z.number(),
  endTime: z.number(),
});

// Typewriter captions schema
const captionsSchema = z.object({
  projectId: z.string(),
  videoUrl: z.string().url(),
  words: z.array(captionWordSchema).min(1),
  position: positionSchema.optional(),
  style: styleSchema.optional(),
  highlightColor: z.string().optional(),
});

// POST /api/text/captions - Add typewriter-style captions with word timing
textRouter.post("/captions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = captionsSchema.parse(req.body);

    const response = await fetch(`${env.PYTHON_API_URL}/text/captions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Python service error: ${error}`);
    }

    const result = await response.json();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Multi-text element schema
const textElementSchema = z.object({
  text: z.string().min(1),
  x: z.string().default("(w-text_w)/2"),
  y: z.string().default("h/2"),
  fontSize: z.number().default(48),
  fontColor: z.string().default("white"),
  fontFile: z.string().default("/app/fonts/Inter-Bold.ttf"),
  startTime: z.number().default(0),
  endTime: z.number().optional(),
});

// Multi-text schema
const multiTextSchema = z.object({
  projectId: z.string(),
  videoUrl: z.string().url(),
  textElements: z.array(textElementSchema).min(1),
});

// POST /api/text/multi - Add multiple text overlays at once
textRouter.post("/multi", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = multiTextSchema.parse(req.body);

    const response = await fetch(`${env.PYTHON_API_URL}/text/multi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Python service error: ${error}`);
    }

    const result = await response.json();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Preset text schema
const presetSchema = z.object({
  projectId: z.string(),
  videoUrl: z.string().url(),
  text: z.string().min(1),
  preset: z.enum(["title", "subtitle", "body", "caption", "quote"]),
  position: positionSchema.optional(),
  startTime: z.number().default(0),
  endTime: z.number().optional(),
});

// POST /api/text/preset - Add text using a predefined style preset
textRouter.post("/preset", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = presetSchema.parse(req.body);

    const response = await fetch(`${env.PYTHON_API_URL}/text/preset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Python service error: ${error}`);
    }

    const result = await response.json();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/text/presets - Get available text presets
textRouter.get("/presets", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await fetch(`${env.PYTHON_API_URL}/text/presets`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Python service error: ${error}`);
    }

    const result = await response.json();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});
