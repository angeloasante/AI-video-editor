import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { GeminiService } from "../services/gemini.js";

export const analyzeRouter = Router();

const analyzeSchema = z.object({
  videoUrl: z.string().url(),
  projectId: z.string(),
});

// POST /api/analyze - Analyze video and generate Scene DNA
analyzeRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = analyzeSchema.parse(req.body);
    const gemini = new GeminiService();

    // Extract frames and analyze with Gemini Vision
    const sceneDNA = await gemini.analyzeVideo({
      videoUrl: body.videoUrl,
      analysisType: "sceneDna",
    });

    res.json({
      success: true,
      data: sceneDNA,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/analyze/frames - Analyze specific frames
analyzeRouter.post("/frames", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      frameUrls: z.array(z.string().url()).min(1).max(20),
      projectId: z.string(),
    }).parse(req.body);

    const gemini = new GeminiService();
    // Analyze each frame sequentially
    const analysis = await Promise.all(
      body.frameUrls.map((url) =>
        gemini.analyzeVideo({ videoUrl: url, analysisType: "objects" })
      )
    );

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    next(error);
  }
});
