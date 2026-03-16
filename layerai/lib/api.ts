// Backend API client for LayerAI services
// Points to the Node.js backend which proxies to Python FFmpeg service

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Text overlay types
export interface TextPosition {
  x?: string;  // FFmpeg expression like "(w-text_w)/2"
  y?: string;  // FFmpeg expression like "h-th-40"
}

export interface TextStyle {
  fontSize?: number;
  fontColor?: string;
  fontFile?: string;
  box?: boolean;
  boxColor?: string;
  boxBorderWidth?: number;
  shadowX?: number;
  shadowY?: number;
  shadowColor?: string;
}

export interface TextOverlayRequest {
  projectId: string;
  videoUrl: string;
  text: string;
  position?: TextPosition;
  style?: TextStyle;
  startTime?: number;
  endTime?: number;
}

export interface FadeTextRequest {
  projectId: string;
  videoUrl: string;
  text: string;
  position?: TextPosition;
  style?: TextStyle;
  startTime?: number;
  fadeInDuration?: number;
  holdDuration?: number;
  fadeOutDuration?: number;
}

export interface CaptionWord {
  text: string;
  startTime: number;
  endTime: number;
}

export interface TypewriterCaptionsRequest {
  projectId: string;
  videoUrl: string;
  words: CaptionWord[];
  position?: TextPosition;
  style?: TextStyle;
  highlightColor?: string;
}

export interface TextPresetRequest {
  projectId: string;
  videoUrl: string;
  text: string;
  preset: "title" | "subtitle" | "body" | "caption" | "quote";
  position?: TextPosition;
  startTime?: number;
  endTime?: number;
}

export interface TextOverlayResult {
  url: string;
  duration?: number;
}

export interface TextPreset {
  name: string;
  fontSize: number;
  fontFile: string;
  fontColor: string;
  box: boolean;
  boxColor: string;
  shadowX: number;
  shadowY: number;
}

// Generic fetch helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  const result: ApiResponse<T> = await response.json();
  
  if (!result.success || !result.data) {
    throw new Error(result.error || "Unknown API error");
  }

  return result.data;
}

// Text API
export const textApi = {
  /**
   * Add a basic text overlay to video
   */
  async addOverlay(request: TextOverlayRequest): Promise<TextOverlayResult> {
    return apiRequest<TextOverlayResult>("/text/overlay", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Add text with fade in/out animation
   */
  async addFadeText(request: FadeTextRequest): Promise<TextOverlayResult> {
    return apiRequest<TextOverlayResult>("/text/fade", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Add typewriter-style captions with word timing
   */
  async addCaptions(request: TypewriterCaptionsRequest): Promise<TextOverlayResult> {
    return apiRequest<TextOverlayResult>("/text/captions", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Add text using a predefined style preset
   */
  async addPresetText(request: TextPresetRequest): Promise<TextOverlayResult> {
    return apiRequest<TextOverlayResult>("/text/preset", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Get available text presets
   */
  async getPresets(): Promise<{ presets: Record<string, TextPreset> }> {
    return apiRequest<{ presets: Record<string, TextPreset> }>("/text/presets", {
      method: "GET",
    });
  },
};

// Generate API (video/image generation)
export interface GenerateRequest {
  prompt: string;
  model?: string;
  mode?: "text-to-video" | "image-to-video" | "text-to-image";
  aspectRatio?: string;
  duration?: number;
  referenceImageUrl?: string;
  projectId?: string;
}

export interface GenerateResult {
  url: string;
  requestId: string;
  seed?: number;
}

export const generateApi = {
  /**
   * Generate video or image from prompt
   */
  async generate(request: GenerateRequest): Promise<GenerateResult> {
    return apiRequest<GenerateResult>("/generate", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Check generation status
   */
  async getStatus(requestId: string): Promise<{ status: string; result?: GenerateResult }> {
    return apiRequest<{ status: string; result?: GenerateResult }>(`/generate/status/${requestId}`);
  },
};

// Analyze API (Scene DNA)
export interface AnalyzeRequest {
  videoUrl: string;
  projectId: string;
}

export interface SceneDNA {
  theme: string;
  mood: string;
  colorPalette: string[];
  lighting: {
    type: string;
    intensity: string;
    direction: string;
  };
  cameraWork: {
    shotTypes: string[];
    movements: string[];
  };
  objects: string[];
}

export const analyzeApi = {
  /**
   * Analyze video and generate Scene DNA
   */
  async analyzeVideo(request: AnalyzeRequest): Promise<SceneDNA> {
    return apiRequest<SceneDNA>("/analyze", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },
};

// Enhance API (prompt enhancement)
export interface EnhanceRequest {
  prompt: string;
  projectId?: string;
  mode?: "video" | "image" | "character";
}

export interface EnhanceResult {
  original: string;
  enhanced: string;
}

export const enhanceApi = {
  /**
   * Enhance a prompt with Scene DNA context
   */
  async enhancePrompt(request: EnhanceRequest): Promise<EnhanceResult> {
    return apiRequest<EnhanceResult>("/enhance", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },
};

// Segment API (SAM2)
export interface SegmentRequest {
  videoUrl: string;
  projectId: string;
  points: Array<{ x: number; y: number; frameIndex?: number }>;
}

export interface SegmentResult {
  maskedVideo?: string;
  maskFrames?: string[];
}

export const segmentApi = {
  /**
   * Segment video using SAM2
   */
  async segmentVideo(request: SegmentRequest): Promise<SegmentResult> {
    return apiRequest<SegmentResult>("/segment", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Check segmentation status
   */
  async getStatus(predictionId: string): Promise<{ status: string; output?: unknown }> {
    return apiRequest<{ status: string; output?: unknown }>(`/segment/status/${predictionId}`);
  },
};

// SFX API (sound effects)
export interface SFXRequest {
  prompt: string;
  durationSeconds?: number;
}

export interface TTSRequest {
  text: string;
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
}

export interface AudioResult {
  audioUrl: string;
  duration?: number;
}

export const audioApi = {
  /**
   * Generate sound effect from prompt
   */
  async generateSFX(request: SFXRequest): Promise<AudioResult> {
    return apiRequest<AudioResult>("/sfx/generate", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Generate speech from text (TTS)
   */
  async textToSpeech(request: TTSRequest): Promise<AudioResult> {
    return apiRequest<AudioResult>("/sfx/tts", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Get available voices
   */
  async getVoices(): Promise<{ voices: Array<{ voiceId: string; name: string; category: string }> }> {
    return apiRequest<{ voices: Array<{ voiceId: string; name: string; category: string }> }>("/sfx/voices");
  },

  /**
   * Extract audio track from a video file
   */
  async extractAudio(videoUrl: string): Promise<{ url: string; duration: number; format: string }> {
    return apiRequest<{ url: string; duration: number; format: string }>("/preview/extract-audio", {
      method: "POST",
      body: JSON.stringify({ videoUrl }),
    });
  },

  /**
   * Transcribe audio/video to text with word-level timestamps
   */
  async transcribe(audioUrl: string): Promise<TranscriptionResult> {
    return apiRequest<TranscriptionResult>("/sfx/transcribe", {
      method: "POST",
      body: JSON.stringify({ audioUrl }),
    });
  },
};

export interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
  type: "word" | "spacing" | "punctuation";
}

export interface TranscriptionResult {
  text: string;
  words: TranscriptionWord[];
  language_code: string;
}

// Export API
export interface ExportRequest {
  projectId: string;
  format?: "mp4" | "webm" | "mov";
  quality?: "draft" | "standard" | "high";
  includeAudio?: boolean;
}

export interface ExportResult {
  url: string;
  format: string;
  quality: string;
}

export const exportApi = {
  /**
   * Start video export
   */
  async startExport(request: ExportRequest): Promise<{ jobId: string }> {
    return apiRequest<{ jobId: string }>("/export", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  /**
   * Get export status
   */
  async getStatus(jobId: string): Promise<{ status: string; progress?: number; result?: ExportResult }> {
    return apiRequest<{ status: string; progress?: number; result?: ExportResult }>(`/export/status/${jobId}`);
  },
};

// AI Chat API (Gemini thinking + fal.ai generation)
export interface TimelineClipInfo {
  index: number;
  url: string;
  name?: string;
  type?: string;
  startTime?: number;
  endTime?: number;
}

export interface TaggedAsset {
  name: string;
  url: string;
  type: "character" | "image" | "video";
}

export interface AIChatRequest {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  projectId?: string;
  aspectRatio?: string;
  multiShot?: boolean;
  model?: string;
  existingVideoUrl?: string;
  timelineClips?: TimelineClipInfo[];
  imageUrls?: string[];
  taggedAssets?: TaggedAsset[];
}

export interface EditParams {
  searchText?: string;
  newText?: string;
  text?: string;
  startTime?: number;
  endTime?: number;
}

export interface ElementEditData {
  target: string;
  modification: string;
  maskedVideoUrl?: string;
  maskFrames?: string[];
  modifiedElementImageUrl?: string;
  originalVideoUrl: string;
  resultVideoUrl?: string;
  targetClipIndex?: number;
}

export interface CharacterData {
  name: string;
  description: string;
  images: string[];
}

export interface AIChatResult {
  type: "video" | "image" | "text" | "edit_text" | "add_text" | "delete_text" | "audio" | "element_edit" | "character";
  status: "queued" | "processing" | "completed" | "done";
  message: string;
  enhancedPrompt?: string;
  referenceImageUrl?: string;
  requestId?: string;
  modelId?: string;
  editParams?: EditParams;
  audioUrl?: string;
  elementEdit?: ElementEditData;
  character?: CharacterData;
}

export interface AIStatusResult {
  status: string;
  result?: {
    url: string;
    requestId: string;
    path?: string;
    name?: string;
    type?: string;
  };
}

export const aiApi = {
  async chat(request: AIChatRequest): Promise<AIChatResult> {
    return apiRequest<AIChatResult>("/ai/chat", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  async getStatus(requestId: string, modelId: string, type?: string, projectId?: string): Promise<AIStatusResult> {
    const params = new URLSearchParams({ modelId });
    if (type) params.set("type", type);
    if (projectId) params.set("projectId", projectId);
    return apiRequest<AIStatusResult>(`/ai/status/${requestId}?${params.toString()}`);
  },
};

// Transition Proxy API
export interface TransitionProxyRequest {
  clipAUrl: string;
  clipBUrl: string;
  transitionType: string;
  duration: number;
  clipAEndTime: number;
  clipBStartTime: number;
  maxWidth?: number;
}

export interface TransitionProxyResult {
  url: string;
  duration?: number;
  width?: number;
  height?: number;
}

export const transitionApi = {
  /**
   * Pre-render a transition overlap zone as a proxy video.
   * The frontend plays this single video instead of CSS-compositing
   * two clips in real-time, matching the smooth FFmpeg xfade export quality.
   */
  async renderProxy(request: TransitionProxyRequest): Promise<TransitionProxyResult> {
    return apiRequest<TransitionProxyResult>("/transitions/render-proxy", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },
};

// Health check
export const healthApi = {
  async check(): Promise<{ status: string; version: string }> {
    return apiRequest<{ status: string; version: string }>("/health");
  },
};
