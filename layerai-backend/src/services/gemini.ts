import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { env } from "../config/env.js";

// Minimal safety settings — this is a creative video editing tool, not a public chatbot
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Initialize Gemini client (optional - only if API key provided)
const geminiKey = env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!geminiKey) {
  console.warn("[Gemini] No API key found. Checked: GOOGLE_GEMINI_API_KEY, GEMINI_API_KEY. AI features disabled.");
} else {
  console.log("[Gemini] API key found, initializing client.");
}
const genAI = geminiKey
  ? new GoogleGenerativeAI(geminiKey)
  : null;

function ensureGeminiConfigured(): GoogleGenerativeAI {
  if (!genAI) {
    throw new Error("GOOGLE_GEMINI_API_KEY not configured. AI analysis features are disabled.");
  }
  return genAI;
}

export interface AnalyzeVideoInput {
  videoUrl: string;
  analysisType: "sceneDna" | "transcript" | "objects" | "timeline";
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
  characters: Array<{
    description: string;
    appearance: string;
    screenTime: string;
  }>;
  objects: string[];
  audio: {
    hasDialogue: boolean;
    musicStyle: string;
    ambience: string;
  };
  timeline: Array<{
    timestamp: number;
    description: string;
    keyElements: string[];
  }>;
  /** Deep analysis from Google Cloud Video Intelligence API */
  visionIntelligence?: {
    /** Scene-level labels (e.g. "beach", "sunset", "urban") with confidence */
    sceneLabels: Array<{ label: string; confidence: number }>;
    /** Tracked objects across frames */
    trackedObjects: Array<{ entity: string; confidence: number }>;
    /** Shot/cut boundaries detected */
    shotBoundaries: Array<{ startTime: number; endTime: number }>;
    /** On-screen text detected via OCR */
    onScreenText: string[];
    /** Logos/brands detected */
    logos: string[];
    /** Person attributes (clothing, accessories, etc.) */
    personAttributes: string[];
    /** Timestamp of last analysis */
    analyzedAt: number;
  };
}

export interface EnhancePromptInput {
  prompt: string;
  sceneDna?: Partial<SceneDNA>;
  style?: "cinematic" | "realistic" | "stylized" | "animated";
}

export class GeminiService {
  private getModel() {
    if (!genAI) {
      throw new Error("GOOGLE_GEMINI_API_KEY not configured. AI analysis features are disabled.");
    }
    return genAI.getGenerativeModel({ model: "gemini-2.5-flash", safetySettings: SAFETY_SETTINGS });
  }
  
  private getThinkingModel() {
    if (!genAI) {
      throw new Error("GOOGLE_GEMINI_API_KEY not configured. AI analysis features are disabled.");
    }
    return genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings: SAFETY_SETTINGS,
      systemInstruction: `You are the AI brain of LayerAI, a professional AI video editor. When describing or prompting for human characters, you MUST always default to ultra-photorealistic, real-human descriptions. Characters must look like real people photographed by a camera — real skin with pores and imperfections, natural hair, real eyes with catchlights. NEVER describe characters as stylized, 3D-rendered, cartoon, anime, illustrated, plastic, doll-like, or toy-like unless the user EXPLICITLY requests a non-photorealistic style. Avoid any language that could produce "AI slop" — no overly smooth skin, no uncanny valley features, no plastic sheen. Think real documentary/cinematic photography.`,
    });
  }

  async analyzeVideo(input: AnalyzeVideoInput): Promise<SceneDNA> {
    const systemPrompt = `You are an expert video analyst for an AI video editor. Analyze the provided video and extract its "Scene DNA" - a comprehensive profile that captures all visual, audio, and stylistic elements.

Return a JSON object with the following structure:
{
  "theme": "main theme/genre of the video",
  "mood": "emotional tone",
  "colorPalette": ["hex colors found in video"],
  "lighting": {
    "type": "natural/artificial/mixed",
    "intensity": "low/medium/high",
    "direction": "front/back/side/top/diffused"
  },
  "cameraWork": {
    "shotTypes": ["wide", "medium", "close-up", etc.],
    "movements": ["static", "pan", "tilt", "dolly", etc.]
  },
  "characters": [
    {
      "description": "brief description",
      "appearance": "visual details",
      "screenTime": "approximate percentage"
    }
  ],
  "objects": ["key objects in scene"],
  "audio": {
    "hasDialogue": true/false,
    "musicStyle": "genre if present",
    "ambience": "background sounds"
  },
  "timeline": [
    {
      "timestamp": 0,
      "description": "what happens",
      "keyElements": ["relevant elements"]
    }
  ]
}`;

    // Use Gemini's native video understanding
    const response = await this.getModel().generateContent([
      systemPrompt,
      {
        inlineData: {
          mimeType: "video/mp4",
          data: await this.fetchVideoAsBase64(input.videoUrl),
        },
      },
    ]);

    const text = response.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("Failed to parse Scene DNA from response");
    }

    return JSON.parse(jsonMatch[0]) as SceneDNA;
  }

  async enhancePrompt(input: EnhancePromptInput): Promise<string> {
    // Build a structured context string so Gemini sees Vision Intelligence clearly
    let dnaContext = "";
    if (input.sceneDna) {
      const parts: string[] = [];
      const d = input.sceneDna;
      if (d.theme) parts.push(`Theme: ${d.theme}`);
      if (d.mood) parts.push(`Mood: ${d.mood}`);
      if (d.colorPalette?.length) parts.push(`Color palette: ${d.colorPalette.join(", ")}`);
      if (d.lighting) parts.push(`Lighting: ${d.lighting.type}, ${d.lighting.intensity} intensity, ${d.lighting.direction} direction`);
      if (d.cameraWork?.shotTypes?.length) parts.push(`Camera shots: ${d.cameraWork.shotTypes.join(", ")}`);
      if (d.cameraWork?.movements?.length) parts.push(`Camera movements: ${d.cameraWork.movements.join(", ")}`);
      if (d.characters?.length) parts.push(`Characters: ${d.characters.map(c => `${c.description} (${c.appearance})`).join("; ")}`);
      if (d.objects?.length) parts.push(`Objects in scene: ${d.objects.join(", ")}`);
      // Vision Intelligence — detected labels, objects, text, logos, person attributes
      const vi = d.visionIntelligence;
      if (vi) {
        if (vi.sceneLabels?.length) parts.push(`Detected scene labels: ${vi.sceneLabels.map(l => `${l.label} (${Math.round(l.confidence * 100)}%)`).join(", ")}`);
        if (vi.trackedObjects?.length) parts.push(`Tracked objects: ${vi.trackedObjects.map(o => o.entity).join(", ")}`);
        if (vi.onScreenText?.length) parts.push(`On-screen text: ${vi.onScreenText.join(", ")}`);
        if (vi.logos?.length) parts.push(`Logos/brands: ${vi.logos.join(", ")}`);
        if (vi.personAttributes?.length) parts.push(`Person attributes: ${vi.personAttributes.join(", ")}`);
      }
      if (parts.length) dnaContext = `\nScene DNA (use this to maintain visual/tonal consistency):\n${parts.join("\n")}\n`;
    }

    const systemPrompt = `You are an expert prompt engineer for AI video generation. Enhance the user's prompt to be more detailed and effective for video AI models.
${dnaContext}
Guidelines:
- CRITICAL: The user's subject matter, scene, and setting are SACRED — NEVER replace, substitute, or override them with Scene DNA content. If the user says "a train crossing a viaduct", the output MUST be about a train crossing a viaduct, NOT about characters or scenes from Scene DNA.
- Scene DNA should ONLY influence style, mood, color grading, lighting quality, and cinematic tone — NEVER the actual subjects, locations, or actions described in the prompt.
- Add specific visual details (lighting, colors, camera angles) that complement the user's described scene
- Include motion descriptions relevant to what the user described
- Maintain the original intent — the user's words define WHAT is in the scene
- Keep it under 800 characters
- Do not add text/title overlays unless requested
- CRITICAL: If the original prompt starts with "THE ATTACHED IMAGE IS" or similar VM instructions, preserve those instructions EXACTLY at the start and only enhance the scene description that follows
- Style: ${input.style || "cinematic"}

Return ONLY the enhanced prompt, no explanations.`;

    const response = await this.getModel().generateContent([
      systemPrompt,
      `Original prompt: ${input.prompt}`,
    ]);

    return response.response.text().trim();
  }

  async generateEditSuggestions(sceneDna: SceneDNA, userIntent: string): Promise<string[]> {
    const systemPrompt = `You are an AI video editing assistant. Based on the Scene DNA and user's intent, suggest specific edits.

Scene DNA:
${JSON.stringify(sceneDna, null, 2)}

User wants: ${userIntent}

Provide 3-5 specific, actionable edit suggestions. Return as a JSON array of strings.`;

    const response = await this.getModel().generateContent(systemPrompt);
    const text = response.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      return ["Apply color grading", "Trim unnecessary sections", "Add transitions"];
    }

    return JSON.parse(jsonMatch[0]) as string[];
  }

  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const chat = this.getModel().startChat({
      history: messages.slice(0, -1).map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      })),
    });

    const lastMessage = messages[messages.length - 1];
    const response = await chat.sendMessage(lastMessage.content);

    return response.response.text();
  }

  async thinkingAnalysis(prompt: string, imageUrls?: string[]): Promise<{ thinking: string; response: string }> {
    // Build parts — images first, then text prompt
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

    if (imageUrls && imageUrls.length > 0) {
      for (const url of imageUrls) {
        try {
          const imgResponse = await fetch(url);
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
          const contentType = imgResponse.headers.get("content-type") || "image/jpeg";
          parts.push({ inlineData: { data: imgBuffer.toString("base64"), mimeType: contentType } });
          console.log(`[Gemini] Attached image to thinking analysis (${imgBuffer.length} bytes)`);
        } catch (err) {
          console.warn(`[Gemini] Failed to fetch image for analysis: ${url}`, err);
        }
      }
    }
    parts.push({ text: prompt });

    // Use Gemini 2.5 Pro with thinking for complex reasoning
    const response = await this.getThinkingModel().generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        // @ts-ignore - thinking config may not be in types yet
        thinkingConfig: {
          thinkingBudget: 8192,
        },
      },
    });

    const result = response.response;
    let thinkingText = "";
    let responseText = "";

    // Log raw response structure for debugging
    const candidates = result.candidates || [];
    console.log(`[Gemini] thinkingAnalysis: ${candidates.length} candidates, promptFeedback: ${JSON.stringify(result.promptFeedback || "none")}`);
    if (candidates.length > 0) {
      const c = candidates[0];
      console.log(`[Gemini] Candidate 0: finishReason=${c.finishReason}, parts=${c.content?.parts?.length || 0}, safetyRatings=${JSON.stringify(c.safetyRatings?.map(r => `${r.category}:${r.probability}`) || "none")}`);
    }

    // Extract thinking and response parts
    for (const candidate of candidates) {
      for (const part of candidate.content?.parts || []) {
        const partData = part as unknown as Record<string, unknown>;
        if (partData.thought) {
          thinkingText += (partData.text as string) || "";
        } else {
          responseText += (part as { text?: string }).text || "";
        }
      }
    }

    // If both empty, Gemini likely blocked the request
    if (!thinkingText && !responseText) {
      console.error(`[Gemini] EMPTY RESPONSE — likely content filter or API issue. Full result: ${JSON.stringify(result).slice(0, 500)}`);
    }

    return { thinking: thinkingText, response: responseText };
  }

  /**
   * Generate an image using Google's Imagen 3 (Nano Banana Pro) model.
   * Uses the existing Gemini API key — no separate fal.ai call needed.
   * Returns a base64-encoded image that can be uploaded to Supabase.
   */
  async generateImage(prompt: string, options?: {
    aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
    numberOfImages?: number;
    referenceImageUrls?: string[];
  }): Promise<{ imageData: Buffer; mimeType: string }[]> {
    const ai = ensureGeminiConfigured();

    const model = ai.getGenerativeModel({
      model: "gemini-3-pro-image-preview",
      safetySettings: SAFETY_SETTINGS,
      systemInstruction: `You are a professional photography and visual effects studio AI. Your primary output is ultra-photorealistic images that are indistinguishable from real photographs.

ABSOLUTE RULES:
- ALWAYS produce photorealistic output that looks like it was captured by a real camera (Canon EOS R5, Sony A7R V, or equivalent).
- Human subjects MUST have real skin texture with visible pores, natural imperfections, subsurface scattering, real hair with individual strands, natural eye reflections with catchlights, and anatomically correct proportions.
- NEVER produce 3D renders, CGI, toys, dolls, figurines, plastic-looking skin, anime, cartoon, illustration, digital art, or any stylized output unless the user EXPLICITLY requests a non-photorealistic style.
- When a reference image is provided, match the EXACT person — same face, same skin tone, same body type, same features. Do not alter, beautify, or stylize the person.
- Lighting should follow real-world photography principles: soft key light, fill light, rim/hair light, natural shadows with proper falloff.
- Backgrounds should be realistic environments or clean studio backdrops — never fantasy/surreal unless requested.`,
    });

    // Include aspect ratio in the prompt text since the API doesn't accept it in generationConfig
    const aspectHint = options?.aspectRatio ? ` The image should be in ${options.aspectRatio} aspect ratio.` : "";
    const fullPrompt = `${prompt}${aspectHint}`;
    console.log(`[Gemini/Imagen] Generating image: "${fullPrompt.slice(0, 120)}..."`);

    // Build content parts — text + optional reference images
    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

    // Add reference images first (if provided)
    if (options?.referenceImageUrls && options.referenceImageUrls.length > 0) {
      for (const imgUrl of options.referenceImageUrls) {
        try {
          console.log(`[Gemini/Imagen] Fetching reference image: ${imgUrl.slice(0, 80)}...`);
          const imgResponse = await fetch(imgUrl);
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
          const contentType = imgResponse.headers.get("content-type") || "image/jpeg";
          parts.push({
            inlineData: {
              data: imgBuffer.toString("base64"),
              mimeType: contentType,
            },
          });
          console.log(`[Gemini/Imagen] Reference image attached (${imgBuffer.length} bytes, ${contentType})`);
        } catch (imgErr) {
          console.warn(`[Gemini/Imagen] Failed to fetch reference image: ${imgUrl}`, imgErr);
        }
      }
    }

    // Add text prompt
    parts.push({ text: fullPrompt });

    // @ts-ignore - responseModalities not in SDK types yet but supported at runtime
    const response = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    } as never);

    const result = response.response;
    const images: { imageData: Buffer; mimeType: string }[] = [];

    for (const candidate of result.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        const partData = part as unknown as Record<string, unknown>;
        if (partData.inlineData) {
          const inline = partData.inlineData as { data: string; mimeType: string };
          images.push({
            imageData: Buffer.from(inline.data, "base64"),
            mimeType: inline.mimeType || "image/png",
          });
        }
      }
    }

    if (images.length === 0) {
      throw new Error("Imagen 3 returned no images. The prompt may have been filtered.");
    }

    console.log(`[Gemini/Imagen] Generated ${images.length} image(s)`);
    return images;
  }

  private async fetchVideoAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  }
}
