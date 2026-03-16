import * as fal from "@fal-ai/serverless-client";
import { env } from "../config/env.js";

// Initialize fal.ai client
fal.config({
  credentials: env.FAL_KEY,
});

export type VideoModelKey =
  | "kling-3.0"
  | "kling-1.6"
  | "veo-3"
  | "minimax-video-01"
  | "hailuo-02"
  | "luma-ray"
  | "seedance-1.5"
  | "seedance-1.0"
  | "wan-2.1"
  | "wan-pro"
  | "ltx-2.3"
  | "hunyuan-1.5";

export interface GenerateVideoInput {
  prompt: string;
  model?: VideoModelKey;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  duration?: number;
  imageUrl?: string; // For image-to-video
  negativePrompt?: string;
}

export interface GenerateImageInput {
  prompt: string;
  model?: "flux-1.1-pro" | "flux-dev" | "ideogram-v3";
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  negativePrompt?: string;
  numImages?: number;
}

export interface FalResult {
  url: string;
  requestId: string;
  seed?: number;
  duration?: number;
}

export class FalService {
  // Model IDs for fal.ai
  private videoModels: Record<string, string> = {
    "kling-3.0": "fal-ai/kling-video/v3/pro/text-to-video",
    "kling-1.6": "fal-ai/kling-video/v1.6/standard/text-to-video",
    "veo-3": "fal-ai/veo3",
    "minimax-video-01": "fal-ai/minimax/video-01",
    "hailuo-02": "fal-ai/minimax/hailuo-02/pro/text-to-video",
    "luma-ray": "fal-ai/luma-dream-machine",
    "seedance-1.5": "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
    "seedance-1.0": "fal-ai/bytedance/seedance/v1/pro/text-to-video",
    "wan-2.1": "fal-ai/wan-t2v",
    "wan-pro": "fal-ai/wan-pro/text-to-video",
    "ltx-2.3": "fal-ai/ltx-2.3/text-to-video",
    "hunyuan-1.5": "fal-ai/hunyuan-video-v1.5/text-to-video",
  };

  // Image-to-video model IDs (used when a reference image is provided)
  private i2vModels: Record<string, string> = {
    "kling-3.0": "fal-ai/kling-video/v3/pro/image-to-video",
    "kling-1.6": "fal-ai/kling-video/v1.6/standard/image-to-video",
    "veo-3": "fal-ai/veo3",  // veo3 handles both t2v and i2v at same endpoint
    "minimax-video-01": "fal-ai/minimax/video-01",
    "hailuo-02": "fal-ai/minimax/hailuo-02/pro/image-to-video",
    "seedance-1.5": "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    "seedance-1.0": "fal-ai/bytedance/seedance/v1/pro/image-to-video",
    "wan-2.1": "fal-ai/wan-i2v",
    "wan-pro": "fal-ai/wan-pro/image-to-video",
    "luma-ray": "fal-ai/luma-dream-machine",
    "ltx-2.3": "fal-ai/ltx-2.3/image-to-video",
    "hunyuan-1.5": "fal-ai/hunyuan-video-v1.5/image-to-video",
  };

  private imageModels: Record<string, string> = {
    "flux-1.1-pro": "fal-ai/flux-pro/v1.1",
    "flux-dev": "fal-ai/flux/dev",
    "ideogram-v3": "fal-ai/ideogram/v3",
  };

  private buildVideoInput(input: GenerateVideoInput): Record<string, unknown> {
    const prompt = input.prompt.length > 2500 ? input.prompt.slice(0, 2497) + "..." : input.prompt;
    const dur = Math.max(3, Math.min(15, Math.round(input.duration || 5)));
    const model = input.model || "kling-3.0";

    // Kling models: duration as string "3"-"15", aspect_ratio
    // Kling i2v uses "start_image_url" (NOT "image_url")
    if (model === "kling-3.0" || model === "kling-1.6") {
      return {
        prompt,
        aspect_ratio: input.aspectRatio || "16:9",
        duration: dur.toString(),
        ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
        ...(input.imageUrl && { start_image_url: input.imageUrl }),
      };
    }

    // Veo 3: aspect_ratio, no explicit duration
    if (model === "veo-3") {
      return {
        prompt,
        aspect_ratio: input.aspectRatio || "16:9",
        ...(input.imageUrl && { image_url: input.imageUrl }),
      };
    }

    // MiniMax / Hailuo models: image_url for i2v
    if (model === "minimax-video-01" || model === "hailuo-02") {
      return {
        prompt,
        ...(input.imageUrl && { image_url: input.imageUrl }),
      };
    }

    // Seedance: aspect_ratio, duration as number
    if (model === "seedance-1.5" || model === "seedance-1.0") {
      return {
        prompt,
        aspect_ratio: input.aspectRatio || "16:9",
        duration: dur,
        ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
        ...(input.imageUrl && { image_url: input.imageUrl }),
      };
    }

    // Wan models: aspect_ratio, image_url for i2v
    if (model === "wan-2.1" || model === "wan-pro") {
      return {
        prompt,
        aspect_ratio: input.aspectRatio || "16:9",
        ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
        ...(input.imageUrl && { image_url: input.imageUrl }),
      };
    }

    // LTX: aspect_ratio, image_url for i2v
    if (model === "ltx-2.3") {
      return {
        prompt,
        aspect_ratio: input.aspectRatio || "16:9",
        ...(input.negativePrompt && { negative_prompt: input.negativePrompt }),
        ...(input.imageUrl && { image_url: input.imageUrl }),
      };
    }

    // Hunyuan: aspect_ratio, image_url for i2v
    if (model === "hunyuan-1.5") {
      return {
        prompt,
        aspect_ratio: input.aspectRatio || "16:9",
        ...(input.imageUrl && { image_url: input.imageUrl }),
      };
    }

    // Generic fallback
    return {
      prompt,
      aspect_ratio: input.aspectRatio || "16:9",
      ...(input.imageUrl && { image_url: input.imageUrl }),
    };
  }

  getVideoModelId(model?: string): string {
    return this.videoModels[model || "kling-3.0"];
  }

  getImageModelId(model?: string): string {
    return this.imageModels[model || "flux-1.1-pro"];
  }

  getI2VModelId(model?: string): string {
    return this.i2vModels[model || "kling-3.0"];
  }

  // Submit image-to-video generation to queue — uses i2v model endpoints
  async submitImageToVideo(input: GenerateVideoInput & { imageUrl: string }): Promise<{ requestId: string; modelId: string }> {
    const modelId = this.getI2VModelId(input.model);
    const requestInput = this.buildVideoInput({ ...input });

    // Log to verify image URL is actually in the request
    const ri = requestInput as Record<string, unknown>;
    console.log(`[fal.ai] I2V request:`, {
      model: modelId,
      inputImageUrl: input.imageUrl?.slice(0, 100),
      requestKeys: Object.keys(requestInput),
      image_in_request: ri.start_image_url ? `YES (start_image_url)` : ri.image_url ? `YES (image_url)` : "NO — IMAGE MISSING!",
    });

    const { request_id } = await fal.queue.submit(modelId, {
      input: requestInput,
    });

    console.log(`[fal.ai] Image-to-video job submitted: ${request_id} (model: ${modelId})`);
    return { requestId: request_id, modelId };
  }

  // Submit video generation to queue — returns immediately with requestId
  async submitVideo(input: GenerateVideoInput): Promise<{ requestId: string; modelId: string }> {
    const modelId = this.getVideoModelId(input.model);
    const requestInput = this.buildVideoInput(input);

    const { request_id } = await fal.queue.submit(modelId, {
      input: requestInput,
    });

    console.log(`[fal.ai] Video job submitted: ${request_id} (model: ${modelId})`);
    return { requestId: request_id, modelId };
  }

  // Submit image generation to queue — returns immediately with requestId
  async submitImage(input: GenerateImageInput): Promise<{ requestId: string; modelId: string }> {
    const modelId = this.getImageModelId(input.model);

    const requestInput: Record<string, unknown> = {
      prompt: input.prompt,
      num_images: input.numImages || 1,
    };

    if (input.model === "ideogram-v3") {
      requestInput.aspect_ratio = input.aspectRatio || "16:9";
      if (input.negativePrompt) {
        requestInput.negative_prompt = input.negativePrompt;
      }
    } else {
      requestInput.image_size = this.aspectToSize(input.aspectRatio || "16:9");
    }

    const { request_id } = await fal.queue.submit(modelId, {
      input: requestInput,
    });

    console.log(`[fal.ai] Image job submitted: ${request_id} (model: ${modelId})`);
    return { requestId: request_id, modelId };
  }

  // Blocking version — waits for result (use for short jobs only)
  async generateVideo(input: GenerateVideoInput): Promise<FalResult> {
    const modelId = this.getVideoModelId(input.model);
    const requestInput = this.buildVideoInput(input);

    const result = await fal.subscribe(modelId, {
      input: requestInput,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS" && update.logs) {
          const msgs = update.logs.map((l) => l.message).filter(Boolean).join("\n");
          if (msgs) console.log("[fal.ai]", msgs);
        }
      },
    }) as Record<string, unknown>;

    return this.extractResult(result);
  }

  extractResult(raw: Record<string, unknown>): FalResult {
    // fal.ai returns different shapes depending on model and whether
    // the result comes from subscribe vs queue.result
    // Could be { data: { video: { url } } } or { video: { url } } etc.
    const data = (raw.data as Record<string, unknown>) || raw;
    const requestId = (raw.requestId || raw.request_id || "") as string;

    console.log("[fal.ai] Raw result keys:", Object.keys(raw));
    if (raw.data) console.log("[fal.ai] data keys:", Object.keys(raw.data as Record<string, unknown>));

    let url = "";

    // Video URL extraction — try all known shapes
    if (data.video && typeof data.video === "object") {
      url = ((data.video as Record<string, unknown>).url as string) || "";
    }
    if (!url && typeof data.video_url === "string") {
      url = data.video_url;
    }
    if (!url && Array.isArray(data.videos) && data.videos[0]?.url) {
      url = data.videos[0].url as string;
    }
    // Image URL extraction
    if (!url && Array.isArray(data.images) && data.images[0]) {
      const img = data.images[0] as Record<string, unknown>;
      url = (img.url as string) || "";
    }
    // Direct url field
    if (!url && typeof data.url === "string") {
      url = data.url;
    }

    return { url, requestId, seed: (data.seed as number) || undefined };
  }

  // Blocking version for images
  async generateImage(input: GenerateImageInput): Promise<FalResult[]> {
    const modelId = this.getImageModelId(input.model);

    const requestInput: Record<string, unknown> = {
      prompt: input.prompt,
      num_images: input.numImages || 1,
    };

    if (input.model === "ideogram-v3") {
      requestInput.aspect_ratio = input.aspectRatio || "16:9";
      if (input.negativePrompt) {
        requestInput.negative_prompt = input.negativePrompt;
      }
    } else {
      requestInput.image_size = this.aspectToSize(input.aspectRatio || "16:9");
    }

    const result = await fal.subscribe(modelId, {
      input: requestInput,
      logs: true,
    }) as { data: Record<string, unknown>; requestId: string };

    const data = result.data;
    const images: FalResult[] = [];

    if (Array.isArray(data.images)) {
      for (const img of data.images) {
        const imgData = img as Record<string, unknown>;
        images.push({
          url: imgData.url as string,
          requestId: result.requestId,
          seed: imgData.seed as number | undefined,
        });
      }
    }

    return images;
  }

  async imageToVideo(input: {
    imageUrl: string;
    prompt: string;
    model?: string;
    duration?: number;
  }): Promise<FalResult> {
    return this.generateVideo({
      prompt: input.prompt,
      model: (input.model as GenerateVideoInput["model"]) || "kling-1.6",
      imageUrl: input.imageUrl,
      duration: input.duration,
    });
  }

  async checkJobStatus(requestId: string, modelId: string): Promise<{
    status: string;
    result?: FalResult;
  }> {
    const status = await fal.queue.status(modelId, {
      requestId,
      logs: false,
    });

    if (status.status === "COMPLETED") {
      const raw = await fal.queue.result(modelId, { requestId }) as Record<string, unknown>;
      const extracted = this.extractResult(raw);

      return {
        status: "completed",
        result: { url: extracted.url, requestId },
      };
    }

    if (status.status === "IN_QUEUE") {
      return { status: "queued" };
    }
    if (status.status === "IN_PROGRESS") {
      return { status: "processing" };
    }

    return { status: (status as { status: string }).status.toLowerCase() };
  }

  async textToVideo(input: {
    prompt: string;
    model?: string;
    aspectRatio?: string;
    duration?: number;
  }): Promise<FalResult> {
    return this.generateVideo({
      prompt: input.prompt,
      model: input.model as GenerateVideoInput["model"],
      aspectRatio: input.aspectRatio as GenerateVideoInput["aspectRatio"],
      duration: input.duration,
    });
  }

  async getStatus(requestId: string): Promise<{ status: string; result?: FalResult }> {
    // Try to get status from the most common model
    return this.checkJobStatus(requestId, this.videoModels["kling-3.0"]);
  }

  /**
   * Remove background from an image using BiRefNet.
   * Returns the URL of the image with transparent background.
   */
  async removeBackground(imageUrl: string): Promise<string> {
    console.log(`[fal.ai] Removing background from image: ${imageUrl.slice(0, 80)}...`);
    const result = await fal.subscribe("fal-ai/birefnet", {
      input: {
        image_url: imageUrl,
        model: "General Use (Light)",
        operating_resolution: "1024x1024",
        output_format: "png",
      },
      logs: true,
    }) as { data?: { image?: { url?: string } }; image?: { url?: string } };

    const data = result.data || result;
    const url = (data as Record<string, unknown>).image
      ? ((data as Record<string, unknown>).image as Record<string, unknown>).url as string
      : "";

    if (!url) {
      console.warn("[fal.ai] Background removal returned no URL, using original image");
      return imageUrl;
    }

    console.log(`[fal.ai] Background removed successfully: ${url.slice(0, 80)}...`);
    return url;
  }

  private aspectToSize(aspect: string): { width: number; height: number } {
    const sizes: Record<string, { width: number; height: number }> = {
      "16:9": { width: 1920, height: 1080 },
      "9:16": { width: 1080, height: 1920 },
      "1:1": { width: 1024, height: 1024 },
      "4:3": { width: 1024, height: 768 },
      "3:4": { width: 768, height: 1024 },
    };
    return sizes[aspect] || sizes["16:9"];
  }
}
