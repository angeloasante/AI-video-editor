import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { exportQueue } from "../jobs/queue.js";

export const exportRouter = Router();

// Timeline clip schema
const clipSchema = z.object({
  id: z.string(),
  start: z.number(),
  end: z.number(),
  source: z.string(),
  sourceIn: z.number().optional(),
  sourceOut: z.number().optional(),
  volume: z.number().optional(),
  opacity: z.number().optional(),
  effects: z.array(z.any()).optional(),
});

// Track schema
const trackSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
  clips: z.array(clipSchema),
  muted: z.boolean().optional(),
  locked: z.boolean().optional(),
});

// Timeline schema
const timelineSchema = z.object({
  tracks: z.array(trackSchema),
  duration: z.number(),
});

// Transition schema
const transitionSchema = z.object({
  type: z.string(),
  duration: z.number(),
  startTime: z.number(),
  clipAId: z.string(),
  clipBId: z.string(),
});

// Text overlay schema
const textOverlaySchema = z.object({
  text: z.string(),
  preset: z.string().optional(),
  startTime: z.number(),
  endTime: z.number(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
  fontSize: z.number().optional(),
  fontColor: z.string().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.number().optional(),
});

const exportSchema = z.object({
  projectId: z.string(),
  timeline: timelineSchema,
  format: z.enum(["mp4", "webm", "mov"]).default("mp4"),
  quality: z.enum(["draft", "preview", "hd", "4k"]).default("hd"),
  includeAudio: z.boolean().default(true),
  frameRate: z.number().default(30),
  transitions: z.array(transitionSchema).optional(),
  textOverlays: z.array(textOverlaySchema).optional(),
});

// POST /api/export - Queue final render job
exportRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = exportSchema.parse(req.body);

    // Add to job queue with full timeline data
    const job = await exportQueue.add("export", {
      projectId: body.projectId,
      timeline: body.timeline,
      format: body.format,
      quality: body.quality,
      includeAudio: body.includeAudio,
      frameRate: body.frameRate,
      transitions: body.transitions || [],
      textOverlays: body.textOverlays || [],
    });

    res.json({
      success: true,
      data: {
        jobId: job.id,
        status: "queued",
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/export/status/:jobId - Check export job status
exportRouter.get("/status/:jobId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const job = await exportQueue.getJob(jobId);

    if (!job) {
      res.status(404).json({ success: false, error: "Job not found" });
      return;
    }

    const state = await job.getState();
    const progress = job.progress;

    // Prevent browser caching of status polls
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");

    res.json({
      success: true,
      data: {
        jobId,
        status: state,
        progress,
        result: job.returnvalue,
      },
    });
  } catch (error) {
    next(error);
  }
});
