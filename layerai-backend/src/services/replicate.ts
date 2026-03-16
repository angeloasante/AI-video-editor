import Replicate from "replicate";
import { env } from "../config/env.js";

// Initialize Replicate client (optional - only if API token provided)
const replicate = env.REPLICATE_API_TOKEN
  ? new Replicate({ auth: env.REPLICATE_API_TOKEN })
  : null;

function ensureReplicateConfigured(): Replicate {
  if (!replicate) {
    throw new Error("REPLICATE_API_TOKEN not configured. SAM2 segmentation features are disabled.");
  }
  return replicate;
}

export interface SegmentInput {
  imageUrl: string;
  points?: Array<{ x: number; y: number; label: 0 | 1 }>;
  box?: { x1: number; y1: number; x2: number; y2: number };
  maskInput?: string;
}

export interface SegmentResult {
  masks: string[];
  scores: number[];
}

export interface VideoSegmentInput {
  videoUrl: string;
  points: Array<{ x: number; y: number; frameIndex: number }>;
}

export interface VideoSegmentResult {
  maskedVideo: string;
  maskFrames: string[];
}

export class ReplicateService {
  // SAM2 video model — specific version hash
  private sam2VideoVersion = "33432afdfc06a10da6b4018932893d39b0159f838b6d11dd1236dff85cc5ec1d";

  async segmentImage(input: SegmentInput): Promise<SegmentResult> {
    const client = ensureReplicateConfigured();
    const modelInput: Record<string, unknown> = { image: input.imageUrl };
    if (input.points?.length) {
      modelInput.point_coords = input.points.map(p => [p.x, p.y]);
      modelInput.point_labels = input.points.map(p => p.label);
    }
    if (input.box) {
      modelInput.box = [input.box.x1, input.box.y1, input.box.x2, input.box.y2];
    }
    if (input.maskInput) {
      modelInput.mask_input = input.maskInput;
    }
    const output = await client.run("meta/sam-2-image" as `${string}/${string}`, {
      input: modelInput,
    }) as Record<string, unknown>;
    return {
      masks: (output.masks || []) as string[],
      scores: (output.scores || []) as number[],
    };
  }

  async segmentVideo(input: VideoSegmentInput): Promise<VideoSegmentResult> {
    const client = ensureReplicateConfigured();

    // SAM2 video expects string-formatted inputs with INTEGER pixel coordinates:
    //   click_coordinates: '[x,y],[x,y]'
    //   click_labels: '1,1'
    //   click_frames: '0,10'
    //   click_object_ids: 'object1,object1'
    // If coords are normalized (0-1), scale to a default resolution (720p)
    const points = input.points.map(p => ({
      x: p.x <= 1 ? Math.round(p.x * 1280) : Math.round(p.x),
      y: p.y <= 1 ? Math.round(p.y * 720) : Math.round(p.y),
      frameIndex: p.frameIndex,
    }));
    const clickCoords = points.map(p => `[${p.x},${p.y}]`).join(",");
    const clickLabels = points.map(() => "1").join(","); // all foreground
    const clickFrames = points.map(p => p.frameIndex.toString()).join(",");
    const clickObjectIds = points.map(() => "object1").join(","); // single object

    console.log(`[SAM2] Running segmentation: coords=${clickCoords}, frames=${clickFrames}`);

    const output = await client.run(
      `meta/sam-2-video:${this.sam2VideoVersion}`,
      {
        input: {
          input_video: input.videoUrl,
          click_coordinates: clickCoords,
          click_labels: clickLabels,
          click_frames: clickFrames,
          click_object_ids: clickObjectIds,
          mask_type: "binary",
        },
      }
    ) as unknown;

    console.log(`[SAM2] Raw output type: ${typeof output}`);

    // With output_video=true, SAM2 returns a single video URL (string)
    // Without it, returns per-frame masks as array/object with numbered keys
    let maskedVideo = "";
    let maskFrames: string[] = [];

    if (typeof output === "string") {
      // Single video URL (output_video=true)
      maskedVideo = output;
      console.log(`[SAM2] Got mask video: ${maskedVideo.slice(0, 80)}...`);
    } else if (Array.isArray(output)) {
      // Array of frame URLs
      if (output.length === 1 && typeof output[0] === "string" && output[0].includes(".mp4")) {
        maskedVideo = output[0];
        console.log(`[SAM2] Got mask video from array: ${maskedVideo.slice(0, 80)}...`);
      } else {
        maskFrames = output as string[];
        console.log(`[SAM2] Got ${maskFrames.length} mask frame URLs`);
      }
    } else if (output && typeof output === "object") {
      const obj = output as Record<string, unknown>;
      const outputKeys = Object.keys(obj);
      console.log(`[SAM2] Output keys:`, outputKeys.slice(0, 10), outputKeys.length > 10 ? `... (${outputKeys.length} total)` : "");

      // Check for direct video URL fields first
      if (obj.output_video && typeof obj.output_video === "string") {
        maskedVideo = obj.output_video;
      } else if (obj.video && typeof obj.video === "string") {
        maskedVideo = obj.video;
      } else {
        // Per-frame masks as numbered keys: { '0': url, '1': url, ... }
        const numericKeys = outputKeys.filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
        if (numericKeys.length > 0) {
          maskFrames = numericKeys.map(k => obj[k] as string);
        }
      }
    }

    console.log(`[SAM2] Result: maskedVideo=${!!maskedVideo}, maskFrames=${maskFrames.length}`);

    return { maskedVideo, maskFrames };
  }

  async trackObject(
    videoUrl: string,
    initialMask: string,
    startFrame: number
  ): Promise<{ trackedMasks: string[]; outputVideo: string }> {
    const client = ensureReplicateConfigured();

    const output = await client.run(
      `meta/sam-2-video:${this.sam2VideoVersion}`,
      {
        input: {
          input_video: videoUrl,
          mask_input: initialMask,
          start_frame: startFrame,
          propagate_forward: true,
          propagate_backward: true,
        },
      }
    ) as Record<string, unknown>;

    return {
      trackedMasks: (output.tracked_masks || []) as string[],
      outputVideo: (output.output_video || "") as string,
    };
  }

  // Check prediction status (for async operations)
  async checkPrediction(predictionId: string): Promise<{
    status: string;
    output?: unknown;
    error?: string;
  }> {
    const prediction = await ensureReplicateConfigured().predictions.get(predictionId);

    return {
      status: prediction.status,
      output: prediction.output,
      error: prediction.error,
    };
  }

  // Run custom/community models
  async runModel(modelId: string, input: Record<string, unknown>): Promise<unknown> {
    return ensureReplicateConfigured().run(modelId as `${string}/${string}`, { input });
  }
}
