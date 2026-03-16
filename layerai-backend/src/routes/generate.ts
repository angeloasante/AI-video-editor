import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { FalService } from "../services/fal.js";

export const generateRouter = Router();

const generateSchema = z.object({
  prompt: z.string().min(1),
  model: z.enum(["kling-1.6", "veo-3", "minimax-video-01", "luma-ray"]).default("kling-1.6"),
  mode: z.enum(["text-to-video", "image-to-video", "text-to-image"]).default("text-to-video"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3", "3:4"]).default("16:9"),
  duration: z.number().min(1).max(30).default(5),
  referenceImageUrl: z.string().url().optional(),
  projectId: z.string().optional(),
});

// POST /api/generate - Generate video or image
generateRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = generateSchema.parse(req.body);
    const fal = new FalService();

    let result;

    if (body.mode === "text-to-image") {
      const images = await fal.generateImage({
        prompt: body.prompt,
        aspectRatio: body.aspectRatio,
      });
      result = images[0];
    } else if (body.mode === "image-to-video" && body.referenceImageUrl) {
      result = await fal.imageToVideo({
        prompt: body.prompt,
        imageUrl: body.referenceImageUrl,
        model: body.model,
        duration: body.duration,
      });
    } else {
      result = await fal.textToVideo({
        prompt: body.prompt,
        model: body.model,
        aspectRatio: body.aspectRatio,
        duration: body.duration,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/generate/status/:requestId - Check generation status
generateRouter.get("/status/:requestId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requestId } = req.params;
    const fal = new FalService();
    const status = await fal.getStatus(requestId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});
