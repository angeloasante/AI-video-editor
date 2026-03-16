import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ReplicateService } from "../services/replicate.js";

export const segmentRouter = Router();

const segmentSchema = z.object({
  videoUrl: z.string().url(),
  projectId: z.string(),
  points: z.array(z.object({
    x: z.number(),
    y: z.number(),
    frameIndex: z.number().default(0),
  })),
  box: z.object({
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
  }).optional(),
});

// POST /api/segment - Run SAM2 segmentation on video
segmentRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = segmentSchema.parse(req.body);
    const replicate = new ReplicateService();

    const result = await replicate.segmentVideo({
      videoUrl: body.videoUrl,
      points: body.points,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/segment/status/:predictionId - Check segmentation status
segmentRouter.get("/status/:predictionId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { predictionId } = req.params;
    const replicate = new ReplicateService();
    const status = await replicate.checkPrediction(predictionId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});
