import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { ElevenLabsService } from "../services/elevenlabs.js";

export const sfxRouter = Router();

const sfxSchema = z.object({
  prompt: z.string().min(1).max(500),
  duration: z.number().min(1).max(30).default(5),
  format: z.enum(["mp3", "wav"]).default("mp3"),
});

const ttsSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().optional(),
  stability: z.number().min(0).max(1).default(0.5),
  similarityBoost: z.number().min(0).max(1).default(0.75),
});

// POST /api/sfx/generate - Generate AI sound effect
sfxRouter.post("/generate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = sfxSchema.parse(req.body);

    const elevenlabs = new ElevenLabsService();
    const result = await elevenlabs.generateSFX({
      prompt: body.prompt,
      durationSeconds: body.duration,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sfx/tts - Text-to-speech generation
sfxRouter.post("/tts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ttsSchema.parse(req.body);

    const elevenlabs = new ElevenLabsService();
    const result = await elevenlabs.textToSpeech({
      text: body.text,
      voiceId: body.voiceId,
      stability: body.stability,
      similarityBoost: body.similarityBoost,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sfx/voices - List available TTS voices
sfxRouter.get("/voices", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const elevenlabs = new ElevenLabsService();
    const voices = await elevenlabs.listVoices();

    res.json({
      success: true,
      data: voices,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sfx/transcribe - Transcribe audio/video to text with timestamps
const transcribeSchema = z.object({
  audioUrl: z.string().url(),
});

sfxRouter.post("/transcribe", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = transcribeSchema.parse(req.body);

    const elevenlabs = new ElevenLabsService();
    const result = await elevenlabs.transcribe(body.audioUrl);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sfx/music - Generate background music
sfxRouter.post("/music", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      prompt: z.string().min(1).max(500),
      duration: z.number().min(10).max(300).default(60),
      genre: z.enum(["ambient", "cinematic", "electronic", "rock", "pop", "classical"]).optional(),
      mood: z.enum(["upbeat", "calm", "dramatic", "dark", "happy", "sad"]).optional(),
    }).parse(req.body);

    // For music generation, we'd integrate with a service like Suno or Udio
    // For now, return a placeholder response
    res.json({
      success: true,
      data: {
        status: "processing",
        message: "Music generation API not yet integrated",
      },
    });
  } catch (error) {
    next(error);
  }
});
