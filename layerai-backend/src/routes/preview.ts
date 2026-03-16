import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase, BUCKETS } from "../config/supabase.js";
import { env } from "../config/env.js";

export const previewRouter = Router();

const proxySchema = z.object({
  projectId: z.string(),
  clipId: z.string(),
  videoUrl: z.string().optional(),
  format: z.enum(["webm", "mp4"]).default("webm"),
  quality: z.enum(["low", "medium"]).default("low"),
  maxWidth: z.number().default(640),
  timestamp: z.number().optional().default(0),
});

// POST /api/preview/proxy - Generate low-res proxy for preview
previewRouter.post("/proxy", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = proxySchema.parse(req.body);

    // Call Python FFmpeg service to generate proxy
    const response = await fetch(`${env.PYTHON_API_URL}/proxy/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: body.projectId,
        clipId: body.clipId,
        videoUrl: body.videoUrl,
        format: body.format,
        quality: body.quality,
        maxWidth: body.maxWidth,
      }),
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

// GET /api/preview/stream/:projectId - Get streaming preview URL
previewRouter.get("/stream/:projectId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;

    // Check if proxy exists in Supabase
    const { data: files } = await supabase.storage
      .from(BUCKETS.PROXIES)
      .list(projectId);

    const proxyFile = files?.find((f) => f.name.endsWith("_preview.webm"));

    if (!proxyFile) {
      res.status(404).json({ success: false, error: "No preview available" });
      return;
    }

    // Generate signed URL for streaming
    const { data: urlData, error } = await supabase.storage
      .from(BUCKETS.PROXIES)
      .createSignedUrl(`${projectId}/${proxyFile.name}`, 3600);

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: {
        url: urlData.signedUrl,
        expiresIn: 3600,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/preview/frame - Extract single frame for thumbnail
previewRouter.post("/frame", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      videoUrl: z.string().url(),
      timestamp: z.number().default(0),
      width: z.number().optional().default(640),
    }).parse(req.body);

    // Call Python FFmpeg service
    const response = await fetch(`${env.PYTHON_API_URL}/extract/frame`, {
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

// POST /api/preview/extract-audio - Extract audio track from video
previewRouter.post("/extract-audio", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      videoUrl: z.string().url(),
    }).parse(req.body);

    const response = await fetch(`${env.PYTHON_API_URL}/proxy/extract-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`FFmpeg service error: ${response.status} - ${errText}`);
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
