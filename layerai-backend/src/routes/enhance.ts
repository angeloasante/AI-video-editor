import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { GeminiService } from "../services/gemini.js";
import { sceneDNAService } from "../services/sceneDNA.js";

export const enhanceRouter = Router();

const enhanceSchema = z.object({
  prompt: z.string().min(1),
  projectId: z.string().optional(),
  mode: z.enum(["video", "image", "character"]).default("video"),
});

// POST /api/enhance - Enhance user prompt with Scene DNA context
enhanceRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = enhanceSchema.parse(req.body);
    const gemini = new GeminiService();

    let sceneDna = undefined;

    // If projectId provided, fetch Scene DNA for context
    if (body.projectId) {
      const dna = await sceneDNAService.get(body.projectId);
      if (dna) {
        sceneDna = {
          theme: dna.theme,
          mood: dna.mood,
          colorPalette: dna.colorPalette,
        };
      }
    }

    const style = body.mode === "character" ? "realistic" : body.mode === "image" ? "stylized" : "cinematic";

    const enhanced = await gemini.enhancePrompt({
      prompt: body.prompt,
      sceneDna,
      style,
    });

    res.json({
      success: true,
      data: {
        original: body.prompt,
        enhanced,
      },
    });
  } catch (error) {
    next(error);
  }
});
