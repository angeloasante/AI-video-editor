import { Worker, Job } from "bullmq";
import { env } from "../config/env.js";
import { FalService } from "../services/fal.js";
import { GeminiService } from "../services/gemini.js";
import { ReplicateService } from "../services/replicate.js";
import { ElevenLabsService } from "../services/elevenlabs.js";
import { storageService, dbService } from "../services/supabase.js";
import { sceneDNAService } from "../services/sceneDNA.js";
import { BUCKETS } from "../config/supabase.js";
import { broadcastJobProgress } from "../ws/index.js";

const connection = { url: env.REDIS_URL };

// Initialize services
const falService = new FalService();
const geminiService = new GeminiService();
const replicateService = new ReplicateService();
const elevenlabsService = new ElevenLabsService();

// Export worker
export const exportWorker = new Worker(
  "export",
  async (job: Job) => {
    const { projectId, timeline, format, quality, includeAudio, frameRate, transitions, textOverlays } = job.data;

    try {
      await job.updateProgress(10);
      broadcastJobProgress(job.id!, "export", 10, "Preparing export...");

      await job.updateProgress(20);
      broadcastJobProgress(job.id!, "export", 20, "Processing timeline...");

      // Call Python FFmpeg service for final render
      const response = await fetch(`${env.PYTHON_API_URL}/render/final`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          timeline,
          format,
          quality,
          includeAudio,
          frameRate: frameRate || 30,
          transitions: transitions || [],
          textOverlays: textOverlays || [],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`FFmpeg service error: ${response.status} - ${errorText}`);
      }

      await job.updateProgress(80);
      broadcastJobProgress(job.id!, "export", 80, "Finalizing video...");

      const result = await response.json() as { videoUrl: string; skippedClips?: number };

      // Python service already uploaded to Supabase - use that URL directly
      await job.updateProgress(100);
      const msg = result.skippedClips
        ? `Export complete! (${result.skippedClips} clip(s) skipped due to broken sources)`
        : "Export complete!";
      broadcastJobProgress(job.id!, "export", 100, msg);

      return {
        success: true,
        url: result.videoUrl,
        format,
        quality,
        skippedClips: result.skippedClips || 0,
      };
    } catch (error) {
      broadcastJobProgress(job.id!, "export", -1, `Export failed: ${error}`);
      throw error;
    }
  },
  { connection, concurrency: 2 }
);

// Generate worker (video/image generation)
export const generateWorker = new Worker(
  "generate",
  async (job: Job) => {
    const { type, prompt, model, projectId, aspectRatio, imageUrl } = job.data;

    try {
      await job.updateProgress(10);
      broadcastJobProgress(job.id!, "generate", 10, "Starting generation...");

      let result: { url: string };

      if (type === "video") {
        await job.updateProgress(30);
        broadcastJobProgress(job.id!, "generate", 30, "Generating video...");

        result = await falService.generateVideo({
          prompt,
          model,
          aspectRatio,
          imageUrl,
        });
      } else {
        await job.updateProgress(30);
        broadcastJobProgress(job.id!, "generate", 30, "Generating image...");

        const images = await falService.generateImage({
          prompt,
          model,
          aspectRatio,
        });
        result = images[0];
      }

      await job.updateProgress(80);
      broadcastJobProgress(job.id!, "generate", 80, "Saving to storage...");

      // Upload to media bucket
      const stored = await storageService.uploadFromUrl(
        BUCKETS.MEDIA,
        projectId,
        result.url,
        `generated_${Date.now()}.${type === "video" ? "mp4" : "png"}`
      );

      // Record in Scene DNA if project has it
      try {
        await sceneDNAService.recordGeneratedAsset(projectId, {
          id: stored.id,
          type,
          prompt,
          url: stored.url,
        });
      } catch {
        // Project may not have Scene DNA yet
      }

      await job.updateProgress(100);
      broadcastJobProgress(job.id!, "generate", 100, "Generation complete!");

      return {
        success: true,
        url: stored.url,
        id: stored.id,
        type,
      };
    } catch (error) {
      broadcastJobProgress(job.id!, "generate", -1, `Generation failed: ${error}`);
      throw error;
    }
  },
  { connection, concurrency: 3 }
);

// Analyze worker (Scene DNA generation)
export const analyzeWorker = new Worker(
  "analyze",
  async (job: Job) => {
    const { videoUrl, projectId } = job.data;

    try {
      await job.updateProgress(10);
      broadcastJobProgress(job.id!, "analyze", 10, "Analyzing video...");

      const sceneDna = await sceneDNAService.generateFromVideo(videoUrl, projectId);

      await job.updateProgress(100);
      broadcastJobProgress(job.id!, "analyze", 100, "Analysis complete!");

      return {
        success: true,
        sceneDna,
      };
    } catch (error) {
      broadcastJobProgress(job.id!, "analyze", -1, `Analysis failed: ${error}`);
      throw error;
    }
  },
  { connection, concurrency: 2 }
);

// Composite worker (FFmpeg operations)
export const compositeWorker = new Worker(
  "composite",
  async (job: Job) => {
    const { operation, projectId, ...params } = job.data;

    try {
      await job.updateProgress(10);
      broadcastJobProgress(job.id!, "composite", 10, `Starting ${operation}...`);

      const response = await fetch(`${env.PYTHON_API_URL}/${operation}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...params }),
      });

      if (!response.ok) {
        throw new Error(`FFmpeg service error: ${response.status}`);
      }

      const result = await response.json() as Record<string, unknown>;

      await job.updateProgress(100);
      broadcastJobProgress(job.id!, "composite", 100, "Composite complete!");

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      broadcastJobProgress(job.id!, "composite", -1, `Composite failed: ${error}`);
      throw error;
    }
  },
  { connection, concurrency: 4 }
);

// Audio worker (TTS, SFX)
export const audioWorker = new Worker(
  "audio",
  async (job: Job) => {
    const { type, projectId, ...params } = job.data;

    try {
      await job.updateProgress(10);
      broadcastJobProgress(job.id!, "audio", 10, `Generating ${type}...`);

      let result;

      if (type === "tts") {
        result = await elevenlabsService.textToSpeech(params);
      } else if (type === "sfx") {
        result = await elevenlabsService.generateSFX(params);
      }

      await job.updateProgress(100);
      broadcastJobProgress(job.id!, "audio", 100, "Audio generation complete!");

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      broadcastJobProgress(job.id!, "audio", -1, `Audio generation failed: ${error}`);
      throw error;
    }
  },
  { connection, concurrency: 3 }
);

// Segment worker (SAM2)
export const segmentWorker = new Worker(
  "segment",
  async (job: Job) => {
    const { type, projectId, ...params } = job.data;

    try {
      await job.updateProgress(10);
      broadcastJobProgress(job.id!, "segment", 10, "Starting segmentation...");

      let result: unknown = {};

      if (type === "image") {
        result = await replicateService.segmentImage(params);
      } else if (type === "video") {
        result = await replicateService.segmentVideo(params);
      } else if (type === "track") {
        result = await replicateService.trackObject(
          params.videoUrl,
          params.initialMask,
          params.startFrame
        );
      }

      await job.updateProgress(100);
      broadcastJobProgress(job.id!, "segment", 100, "Segmentation complete!");

      return {
        success: true,
        result,
      };
    } catch (error) {
      broadcastJobProgress(job.id!, "segment", -1, `Segmentation failed: ${error}`);
      throw error;
    }
  },
  { connection, concurrency: 2 }
);

// Export all workers for management
export const allWorkers = {
  export: exportWorker,
  generate: generateWorker,
  analyze: analyzeWorker,
  composite: compositeWorker,
  audio: audioWorker,
  segment: segmentWorker,
};

// Graceful shutdown
export async function closeWorkers() {
  await Promise.all(Object.values(allWorkers).map((w) => w.close()));
}

// Error handlers
for (const [name, worker] of Object.entries(allWorkers)) {
  worker.on("failed", (job, error) => {
    console.error(`[${name}] Job ${job?.id} failed:`, error.message);
  });

  worker.on("completed", (job) => {
    console.log(`[${name}] Job ${job.id} completed`);
  });
}
