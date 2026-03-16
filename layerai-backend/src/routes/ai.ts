import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { GeminiService } from "../services/gemini.js";
import { FalService } from "../services/fal.js";
import { sceneDNAService } from "../services/sceneDNA.js";
import { storageService } from "../services/supabase.js";
import { BUCKETS } from "../config/supabase.js";
import { ElevenLabsService } from "../services/elevenlabs.js";
import { ReplicateService } from "../services/replicate.js";

export const aiRouter = Router();

// Cache completed uploads so repeated polls don't re-upload the same file
const uploadCache = new Map<string, { url: string; path: string; name: string; type: string }>();
// Track in-flight uploads to prevent concurrent duplicate uploads
const uploadInFlight = new Map<string, Promise<{ url: string; path: string; name: string; type: string }>>();

const chatSchema = z.object({
  message: z.string().min(1),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .default([]),
  projectId: z.string().optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3", "4:5"]).default("16:9"),
  multiShot: z.boolean().default(false),
  model: z.string().optional(),
  existingVideoUrl: z.string().url().optional(),
  timelineClips: z.array(z.object({
    index: z.number(),
    url: z.string(),
    name: z.string().optional(),
    type: z.string().optional(),
    startTime: z.number().optional(),
    endTime: z.number().optional(),
  })).optional(),
  // Image URLs uploaded by user or tagged assets for reference
  imageUrls: z.array(z.string()).optional(),
  // Tagged asset references (from @ mentions)
  taggedAssets: z.array(z.object({
    name: z.string(),
    url: z.string(),
    type: z.enum(["character", "image", "video"]),
  })).optional(),
});

// POST /api/ai/chat - Main AI chat endpoint
// Returns immediately with a requestId for generation jobs (frontend polls /status)
aiRouter.post("/chat", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = chatSchema.parse(req.body);
    const gemini = new GeminiService();

    // ─── CRITICAL DEBUG: Log exactly what the frontend sent ───
    console.log(`[ai/chat] ═══ INCOMING REQUEST ═══`);
    console.log(`[ai/chat] Message: "${body.message.slice(0, 150)}"`);
    console.log(`[ai/chat] taggedAssets: ${body.taggedAssets ? JSON.stringify(body.taggedAssets.map(a => ({ name: a.name, type: a.type, url: a.url.slice(0, 80) }))) : "NONE"}`);
    console.log(`[ai/chat] imageUrls: ${body.imageUrls ? JSON.stringify(body.imageUrls.map(u => u.slice(0, 80))) : "NONE"}`);
    console.log(`[ai/chat] model: ${body.model || "default"}`);

    // Build conversation context from history
    const historyBlock = body.history.length > 0
      ? `\nConversation so far:\n${body.history.map((h) => `${h.role === "user" ? "User" : "AI"}: ${h.content}`).join("\n")}\n`
      : "";

    const multiShotInstruction = body.multiShot
      ? `\nMULTI-SHOT MODE IS ON: The user wants to create multiple connected shots. When generating, ensure consistency across shots — same characters, same voices, consistent lighting, color palette, and art style. Ask about character details, recurring elements, and visual continuity if not already established in the conversation.`
      : "";

    // Fetch SceneDNA for context injection (every AI interaction is scene-aware)
    let sceneDnaContext = "";
    if (body.projectId) {
      try {
        const sceneDna = await sceneDNAService.get(body.projectId);
        if (sceneDna) {
          const ctx: string[] = [];
          if (sceneDna.theme) ctx.push(`Theme: ${sceneDna.theme}`);
          if (sceneDna.mood) ctx.push(`Mood: ${sceneDna.mood}`);
          if (sceneDna.colorPalette?.length) ctx.push(`Color palette: ${sceneDna.colorPalette.join(", ")}`);
          if (sceneDna.lighting) ctx.push(`Lighting: ${sceneDna.lighting.type}, ${sceneDna.lighting.intensity} intensity, ${sceneDna.lighting.direction} direction`);
          if (sceneDna.cameraWork?.shotTypes?.length) ctx.push(`Camera: ${sceneDna.cameraWork.shotTypes.join(", ")}`);
          if (sceneDna.characters?.length) {
            ctx.push(`Characters: ${sceneDna.characters.map((c) => c.description).join("; ")}`);
          }
          if (sceneDna.characterProfiles?.length) {
            ctx.push(`Character profiles: ${sceneDna.characterProfiles.map((c) => `${c.name}: ${c.description}`).join("; ")}`);
          }
          if (sceneDna.audio) {
            if (sceneDna.audio.musicStyle) ctx.push(`Music style: ${sceneDna.audio.musicStyle}`);
            if (sceneDna.audio.ambience) ctx.push(`Ambience: ${sceneDna.audio.ambience}`);
          }
          // Vision Intelligence deep analysis (labels, objects, text, logos, person attributes)
          const vi = sceneDna.visionIntelligence;
          if (vi) {
            if (vi.sceneLabels?.length) {
              ctx.push(`Detected scene labels: ${vi.sceneLabels.map((l) => `${l.label} (${Math.round(l.confidence * 100)}%)`).join(", ")}`);
            }
            if (vi.trackedObjects?.length) {
              ctx.push(`Tracked objects: ${vi.trackedObjects.map((o) => o.entity).join(", ")}`);
            }
            if (vi.onScreenText?.length) {
              ctx.push(`On-screen text detected: ${vi.onScreenText.join(", ")}`);
            }
            if (vi.logos?.length) {
              ctx.push(`Logos/brands detected: ${vi.logos.join(", ")}`);
            }
            if (vi.personAttributes?.length) {
              ctx.push(`Person attributes: ${vi.personAttributes.join(", ")}`);
            }
            if (vi.shotBoundaries?.length) {
              ctx.push(`Shot count: ${vi.shotBoundaries.length} cuts detected`);
            }
          }
          if (ctx.length > 0) {
            sceneDnaContext = `\n\nSCENE DNA (Current project context — use this to maintain visual and tonal consistency in ALL responses and generations):\n${ctx.join("\n")}\n`;
          }
        }
      } catch (err) {
        console.error("[ai/chat] Failed to fetch SceneDNA:", err);
      }
    }

    // Step 1: Use Gemini thinking model — conversational AI that asks questions first
    let existingVideoContext = "";
    if (body.timelineClips && body.timelineClips.length > 0) {
      const clipDescriptions = body.timelineClips.map(c =>
        `  Clip #${c.index}: "${c.name || `Clip ${c.index}`}" (${c.type || "video"}, ${c.startTime?.toFixed(1) ?? 0}s–${c.endTime?.toFixed(1) ?? "?"}s)`
      ).join("\n");
      existingVideoContext = `\nTIMELINE CLIPS (${body.timelineClips.length} clips on the user's timeline):
${clipDescriptions}
If the user refers to a specific clip (e.g., "the second video", "the first clip", "clip 2", "the person in the second video"), identify which clip they mean by its index number.
When using intent "edit_element", include "targetClipIndex" in elementEditParams to specify which clip to edit.
IMPORTANT: For "edit_element", you can ONLY target VIDEO clips (type "video"), NOT image clips. If the user says "the second video", find the second clip with type "video", skipping any image clips.
If the user doesn't specify which clip and there's only one video, use that video's clip index.
If ambiguous and there are multiple video clips, ask which one they mean.\n`;
    } else if (body.existingVideoUrl) {
      existingVideoContext = `\nEXISTING VIDEO: The user currently has a video on their timeline (URL: ${body.existingVideoUrl}). If they ask to modify a specific character, object, or visual element in this video, use intent "edit_element" instead of "generate_video".\n`;
    }

    // Build tagged assets context
    let taggedAssetsContext = "";
    if (body.taggedAssets && body.taggedAssets.length > 0) {
      const assetList = body.taggedAssets.map(a =>
        `  @${a.name} (${a.type}) — ${a.url}`
      ).join("\n");
      taggedAssetsContext = `\nTAGGED ASSETS (referenced by the user with @ mentions):
${assetList}
When generating video/images, include these assets as visual references for consistency. Characters tagged with @ should maintain their exact appearance.\n`;
    }

    // Build uploaded images context
    let uploadedImagesContext = "";
    if (body.imageUrls && body.imageUrls.length > 0) {
      uploadedImagesContext = `\nUSER UPLOADED IMAGES: The user has attached ${body.imageUrls.length} image(s) to this message. These images will be automatically passed to the image/video generator as visual references — you do NOT need to set needsReferenceImage for these. If the user asks to create a character from these images, use intent "create_character" and the system will pass the images directly to Imagen for identity-matched reference sheet generation.\n`;
    }

    const intentPrompt = `You are the AI Brain of LayerAI, a professional AI video editor and expert prompt engineer. You are having a conversation with the user to understand exactly what they want before generating anything.
${sceneDnaContext}${existingVideoContext}${taggedAssetsContext}${uploadedImagesContext}${historyBlock}
User's latest message: "${body.message}"
${multiShotInstruction}

INTENT DETECTION — pick the FIRST matching intent:

1. TEXT EDITING (intent: "edit_text"):
   If the user wants to change, replace, update, or modify existing text on their timeline.
   Examples: "change Angelo to Travis", "replace ice cream with rice", "update the title text"
   → Extract WHAT to search for and WHAT to replace it with. Do NOT ask follow-up questions — just do it.
   → NEVER ask "do you want me to generate a video?" for text edit requests. Text edits are instant operations.

2. ADD TEXT (intent: "add_text"):
   If the user wants to add NEW text to the timeline.
   Examples: "add a text at 15 seconds saying Hello", "put a subtitle from 5s to 8s that says Welcome"
   → Extract the text content and timing. If no timing is given, default to startTime: 0, endTime: 5.

3. DELETE TEXT (intent: "delete_text"):
   If the user wants to remove text from the timeline.
   Examples: "delete the text that says Hello", "remove the subtitle"
   → Extract what text to search for.

4. VIDEO/IMAGE GENERATION (intent: "generate_video" or "generate_image"):
   If the user wants to CREATE visual content. Ask clarifying questions first UNLESS the user explicitly says to go ahead.
   → ONLY generate when user confirms ("go ahead", "yes", "make it", "generate it")
   → Set "needsReferenceImage": true when the prompt features SPECIFIC subjects that need visual consistency:
     humans, people, characters, faces, animals, vehicles (cars, bikes, planes), branded products, specific clothing, or any subject where appearance details matter.
     Examples that NEED reference image: "a woman walking through a park", "a red Ferrari drifting", "a man in a blue suit giving a speech"
     Examples that DON'T need it: "a sunset over the ocean", "abstract particles floating", "timelapse of clouds", "aerial shot of a city"
   → If the user has UPLOADED IMAGES or TAGGED ASSETS (@mentions), do NOT set needsReferenceImage — those images are already available and will be used directly as references. Only set needsReferenceImage when NO existing image is available and one needs to be generated from scratch.

5. SOUND EFFECT GENERATION (intent: "generate_sfx"):
   If the user wants to create a sound effect, ambient sound, action sound, or any non-speech audio.
   Examples: "make a sound of thunder", "I need a gunshot sound", "create fighting sounds with punches", "add rain ambiance"
   → Extract a detailed prompt describing the sound and an optional duration (default 5 seconds, max 30).
   → Do NOT ask follow-up questions — just generate it.

6. VOICE / TEXT-TO-SPEECH (intent: "generate_tts"):
   If the user wants a voice saying something, narration, voiceover, or spoken audio.
   Examples: "I want a voice saying How are you doing?", "generate a narrator saying Welcome to the show", "make a voiceover that says..."
   → Extract the exact text to speak. Do NOT paraphrase — use the user's exact words.
   → Do NOT ask follow-up questions — just generate it.

7. ELEMENT EDIT on existing video (intent: "edit_element"):
   If the user wants to modify a specific character, object, or visual element in an ALREADY EXISTING video on their timeline.
   This is NOT a new generation — it's a targeted edit using SAM2 segmentation + re-generation + compositing.
   ONLY use this intent when timeline clips or an existing video URL is provided in the context above.
   IMPORTANT: Always use this intent when the user asks to edit an element, even if a previous attempt failed. Previous errors are transient and may be resolved now. NEVER refuse to try or suggest alternatives based on past failures.
   Examples: "change his shirt to blue", "make the car red", "remove the person in the background", "change his hair color"
   → Set "elementEditParams" with target (what to segment/extract) and modification (what to change).
   → Also set "needsReferenceImage": true and "referenceImagePrompt" describing the MODIFIED subject for re-generation.

8. CHARACTER CREATION (intent: "create_character"):
   If the user wants to create, design, or build a character for their project.
   Examples: "create a character named Marcus", "design a Nigerian woman in a red dress", "I need a character called Jake — tall, athletic, blue jacket", "create a hero character"
   Also use this intent when the user uploads/attaches an image and asks to create a character reference sheet from it.
   Examples with uploaded image: "create a character sheet from this image", "use this as a reference for a character named Zara", "make a reference sheet based on this photo"
   → Extract the character name (use the name they give, or generate a simple name like "Character 1")
   → Create a detailed appearance description for the character reference sheet. If the user uploaded an image, describe what you see in the image as the appearance description
   → Set "characterParams" with name and description
   → Do NOT ask follow-up questions — just generate it immediately.

9. CONVERSATION (intent: "conversation"):
   Greetings, questions, off-topic, or when you need more info for generation.

PROMPT ENGINEERING RULES (when intent IS generate_video or generate_image):
When the user confirms generation, compile ALL details into an extremely detailed, production-ready prompt:
A. STYLE: Default to photorealistic (real camera, real lighting) unless user requests otherwise. Include camera model/lens (e.g. "shot on ARRI Alexa Mini, 35mm Zeiss"), color grading, shading
B. SCENE: location, props, time of day, weather, lighting setup (key/fill/rim), environment details
C. CHARACTERS: age, gender, ethnicity, build, clothing with fabric textures, hair style/color, skin details, expression, posture, position in frame. Always describe as REAL HUMANS with natural skin, not stylized
D. CAMERA: shot type (wide/medium/close-up), angle (eye-level/low/high), movement (dolly/pan/track/static), framing (rule of thirds, centered)
E. ACTION: what happens second by second, character movements, physics, environment changes

CRITICAL CONSTRAINTS FOR GENERATION:
- SINGLE SHOT description only, under 2000 characters
- No shot numbers, no dialogue, no audio direction
- Focus on what is VISIBLE
- ALL human subjects must be described as photorealistic — real skin texture, real hair, real eyes. NEVER describe characters as "3D", "animated", "stylized", "rendered", or "cartoon" unless the user explicitly requests it
- When a tagged character (@name) is used, describe the SCENE and ACTION around them — do NOT describe their appearance in detail (the reference image handles that). Instead focus on environment, camera, lighting, and what they are doing

Respond with a JSON object:
{
  "intent": "generate_video" | "generate_image" | "conversation" | "edit_text" | "add_text" | "delete_text" | "generate_sfx" | "generate_tts" | "edit_element" | "create_character",
  "enhancedPrompt": "Only for generate_video/generate_image",
  "needsReferenceImage": true/false,
  "referenceImagePrompt": "Only when needsReferenceImage is true AND no uploaded/tagged images exist. A photorealistic prompt describing the subject as a REAL PERSON photographed by a camera — include age, gender, ethnicity, build, exact clothing with fabric textures, hair, expression. Describe them in a neutral standing pose against a plain background. NEVER use words like 'stylized', '3D', 'rendered', 'cartoon', 'animated'. The output must look like a real photograph.",
  "response": "Your reply to the user",
  "style": "cinematic" | "realistic" | "animated" | "stylized",
  "duration": 5,
  "editParams": {
    "searchText": "the text or keyword to find in existing overlays",
    "newText": "the replacement text (for edit_text only)",
    "text": "the full text content (for add_text only)",
    "startTime": 0,
    "endTime": 5
  },
  "audioParams": {
    "prompt": "detailed description of the sound effect (for generate_sfx)",
    "duration": 5,
    "text": "exact text to speak (for generate_tts)",
    "voiceId": "optional voice ID"
  },
  "elementEditParams": {
    "target": "description of element to segment/extract (e.g. 'the man', 'the car', 'the building')",
    "modification": "what to change about it (e.g. 'shirt color to blue', 'make it red', 'remove it')",
    "targetClipIndex": 1,
    "targetColor": "#FF0000"
  },
  "characterParams": {
    "name": "character name from the user's message (e.g. 'Marcus', 'Jake')",
    "description": "detailed appearance description for the character reference sheet"
  },
  "useTaggedAssetAsStartingFrame": true/false,
  "startingFrameAssetName": "@asset_name that the user wants as the starting frame (only when useTaggedAssetAsStartingFrame is true)"
}

RULES FOR editParams:
- For "edit_text": include "searchText" (what to find) and "newText" (what to replace the matched portion with). Example: user says "change ice cream to rice" → searchText: "ice cream", newText: "rice". The frontend will find the overlay containing "ice cream" and replace that substring.
- For "add_text": include "text", "startTime", "endTime"
- For "delete_text": include "searchText" only
- For other intents: omit editParams entirely

RULES FOR audioParams:
- For "generate_sfx": include "prompt" (detailed sound description) and optionally "duration" (1-30 seconds, default 5)
- For "generate_tts": include "text" (the exact words to speak) and optionally "voiceId"
  Available voices (use these names as voiceId):
  Male: "adam", "josh" (young), "arnold" (narrator), "antoni" (deep), "clyde" (deep), "james" (british), "daniel" (british), "callum", "charlie", "ethan", "fin", "liam", "patrick", "sam"
  Female: "rachel" (default), "bella" (young), "elli" (soft), "domi", "charlotte", "dorothy", "emily", "glinda", "grace", "lily", "nicole", "serena"
  Shortcuts: "male" → Adam, "female" → Rachel, "deep" → Clyde, "narrator" → Arnold, "british" → Daniel, "young male" → Josh, "young female" → Bella, "child" → Gigi
  If the user specifies a gender or voice style, pick the best match. If unspecified, default to "rachel".
- For other intents: omit audioParams entirely

RULES FOR elementEditParams:
- For "edit_element": include "target" (what to segment from the video), "modification" (what to change), "targetClipIndex" (which clip number from the TIMELINE CLIPS list above — defaults to 1 if only one clip), and "targetColor" (the hex color code the user wants, e.g. "#FF0000" for red, "#0000FF" for blue, "#FFFFFF" for white). The targetColor is used by FFmpeg to apply the color shift within the SAM2 mask region.
  Also set "needsReferenceImage": false for color-change edits (SAM2 + FFmpeg handles it directly). Only set "needsReferenceImage": true if the edit requires generating a completely new element (e.g. "replace the car with a truck").
- For other intents: omit elementEditParams entirely

RULES FOR characterParams:
- For "create_character": include "name" (the character name from the user's message) and "description" (a detailed, photorealistic appearance description: age, gender, ethnicity, build, hair style/color, clothing with fabric/color details, expression, distinctive features). If the user doesn't provide a name, generate a simple one.
- When the user has uploaded images: the system will automatically pass these images to the image generator as visual references. Your description should complement the image — describe any additional details the user mentioned (clothing changes, poses, etc.) but trust the image for the base appearance.
- NEVER describe characters using stylized language (no "3D model", "animated", "rendered", "illustrated"). Always describe as a real human being photographed in a studio.
- For other intents: omit characterParams entirely

RULES FOR @ TAGGED ASSETS:
- When the user uses @name syntax (e.g., "@Marcus", "@start_frame", "@video1"), these reference saved assets (characters, images, videos) from their library.
- The tagged asset's image URL will be attached to the video model request automatically.
- Your job is to make the enhancedPrompt clearly describe what the attached image represents to the video model.
- CRITICAL: When the user has tagged assets or uploaded images, set "needsReferenceImage": false. Do NOT generate a new reference image when the user already provided images. Use THEIR images.

CRITICAL — "useTaggedAssetAsStartingFrame" logic:
- Set TRUE **only** when the user EXPLICITLY says to use an asset as the starting frame / first frame / opening shot.
  Examples where TRUE: "use @start2 as the starting frame and @tony walks in", "begin with @forest_bg", "@opening_shot as the first frame"
- Set FALSE when the user just tags a character or asset for appearance reference WITHOUT mentioning starting frame.
  Examples where FALSE: "@tony walking through a park", "@marcus sitting on a bench", "a wide shot of @character1 running"

When useTaggedAssetAsStartingFrame = FALSE (character reference):
- The image URL will be sent to the video model as a CHARACTER REFERENCE — NOT as the starting frame.
- Your enhancedPrompt MUST start with: "THE ATTACHED IMAGE IS A CHARACTER REFERENCE SHOWING HOW THE CHARACTER SHOULD LOOK (face, body, clothing, features). DO NOT USE IT AS THE STARTING FRAME. Instead, generate the following scene:"
- Then describe a complete opening frame: environment, camera angle, subject position, lighting, and the character's appearance in detail (describe what they look like based on what you see in the attached image — skin tone, hair, build, clothing, expression, etc.)
- The video model needs to KNOW what the character looks like from your text description since it may not interpret the reference image correctly on its own.

When useTaggedAssetAsStartingFrame = TRUE (starting frame):
- Set "startingFrameAssetName" to the EXACT @name of the asset the user wants as the starting frame.
- The image IS the first frame and the video model will animate from it directly.
- Your enhancedPrompt MUST start with: "THE ATTACHED IMAGE IS THE STARTING FRAME. Animate this exact frame into motion:"
- Then describe ONLY the motion, camera movement, and action the USER ASKED FOR. Do NOT re-describe or guess the image contents — the video model already has the image. Focus entirely on what the USER said should happen in their message.
- CRITICAL: Use the USER'S WORDS from their current message to build the action description. Do NOT hallucinate scene details from previous messages or make up what the image contains. If the user says "two men crying", write about two men crying — not something from a previous conversation turn.
- If other @tagged assets are characters (NOT the starting frame), describe their appearance in the prompt text so the VM knows what they look like.

Return ONLY the JSON object.`;

    let intentResult;
    try {
      // Pass uploaded images + tagged asset images so Gemini can actually SEE them
      const allImageUrls: string[] = [
        ...(body.imageUrls || []),
        ...(body.taggedAssets?.filter(a => a.type === "image" || a.type === "character").map(a => a.url) || []),
      ];
      const thinkingResult = await gemini.thinkingAnalysis(intentPrompt, allImageUrls.length > 0 ? allImageUrls : undefined);
      let rawResponse = thinkingResult.response;
      console.log(`[ai/chat] Raw Gemini response (${rawResponse.length} chars, first 500): ${rawResponse.slice(0, 500)}`);
      console.log(`[ai/chat] Thinking text length: ${thinkingResult.thinking.length} chars`);

      // If response is empty but thinking has content, try extracting JSON from thinking
      if (!rawResponse || rawResponse.trim().length === 0) {
        console.warn("[ai/chat] Response text is empty — checking thinking text for JSON");
        rawResponse = thinkingResult.thinking;
      }

      // Brace-balanced JSON extraction (handles nested objects without capturing trailing text)
      let depth = 0;
      let jsonStart = -1;
      let jsonEnd = -1;
      for (let i = 0; i < rawResponse.length; i++) {
        if (rawResponse[i] === "{") {
          if (depth === 0) jsonStart = i;
          depth++;
        } else if (rawResponse[i] === "}") {
          depth--;
          if (depth === 0 && jsonStart >= 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }

      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        intentResult = JSON.parse(rawResponse.slice(jsonStart, jsonEnd));
      } else {
        console.error("[ai/chat] No valid JSON found in Gemini response");
        intentResult = null;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[ai/chat] Gemini thinking/parse error:", errMsg);
      console.error("[ai/chat] Full error:", err);
      intentResult = null;
    }

    if (!intentResult) {
      // If we have tagged assets or a clear generation request, try a simple fallback intent
      const hasAssets = (body.taggedAssets && body.taggedAssets.length > 0) || (body.imageUrls && body.imageUrls.length > 0);
      const looksLikeGenerate = /\b(video|generate|create|make|animate|starting frame|start frame)\b/i.test(body.message);

      if (hasAssets && looksLikeGenerate) {
        console.warn("[ai/chat] Gemini failed but request looks like video generation — creating fallback intent");
        intentResult = {
          intent: "generate_video",
          enhancedPrompt: body.message,
          needsReferenceImage: false,
          response: "Gemini had trouble analyzing the request, but I'll generate the video with your provided assets.",
          style: "cinematic",
          duration: 5,
        };
      } else {
        console.warn("[ai/chat] Gemini failed — returning fallback conversation response");
        intentResult = {
          intent: "conversation",
          enhancedPrompt: "",
          response: "Sorry, I had trouble processing that. Could you try rephrasing? If you're trying to generate a video, make sure to describe what you want to see.",
          style: "cinematic",
          duration: 5,
        };
      }
    }

    // Debug logging for reference image detection
    console.log(`[ai/chat] Intent: ${intentResult.intent}, needsReferenceImage: ${intentResult.needsReferenceImage}, referenceImagePrompt: ${intentResult.referenceImagePrompt ? "present" : "NONE"}`);

    // Fallback: if needsReferenceImage=true but no referenceImagePrompt, auto-generate one
    if (intentResult.needsReferenceImage && !intentResult.referenceImagePrompt) {
      console.warn("[ai/chat] needsReferenceImage=true but referenceImagePrompt missing. Auto-generating from enhanced prompt.");
      intentResult.referenceImagePrompt = `A detailed still frame of the subject from: ${(intentResult.enhancedPrompt || body.message).slice(0, 500)}. Photorealistic, clear lighting, detailed appearance, static pose.`;
    }

    // Safety net: if generating video with human subjects but Gemini didn't flag it
    // SKIP if user already provided images (tagged assets or uploads) — don't generate a new one
    const hasUserImages = (body.taggedAssets && body.taggedAssets.length > 0) || (body.imageUrls && body.imageUrls.length > 0);
    if (intentResult.intent === "generate_video" && !intentResult.needsReferenceImage && !hasUserImages) {
      const humanIndicators = /\b(man|woman|person|people|guy|girl|boy|child|kid|character|baby|athlete|soldier|dancer|driver|rider|worker|he |she |his |her |him |they |them )\b/i;
      if (humanIndicators.test(body.message)) {
        console.warn(`[ai/chat] Human subject detected in "${body.message.slice(0, 60)}" but needsReferenceImage=false. Forcing to true.`);
        intentResult.needsReferenceImage = true;
        if (!intentResult.referenceImagePrompt) {
          intentResult.referenceImagePrompt = `A photorealistic still frame of the subject described: ${(intentResult.enhancedPrompt || body.message).slice(0, 500)}. Clear lighting, detailed appearance.`;
        }
      }
    }

    // Step 2: If generation intent, enhance with Scene DNA and submit to queue
    if (intentResult.intent === "generate_video" || intentResult.intent === "generate_image") {
      let sceneDna;
      if (body.projectId) {
        try {
          sceneDna = await sceneDNAService.get(body.projectId);
        } catch {}
      }

      if (sceneDna) {
        try {
          const furtherEnhanced = await gemini.enhancePrompt({
            prompt: intentResult.enhancedPrompt,
            sceneDna: {
              theme: sceneDna.theme,
              mood: sceneDna.mood,
              colorPalette: sceneDna.colorPalette,
              lighting: sceneDna.lighting,
              cameraWork: sceneDna.cameraWork,
              characters: sceneDna.characters,
              objects: sceneDna.objects,
              visionIntelligence: sceneDna.visionIntelligence,
            },
            style: intentResult.style || "cinematic",
          });
          intentResult.enhancedPrompt = furtherEnhanced;
        } catch {}
      }

      // Submit to fal.ai queue (non-blocking — returns immediately)
      const falService = new FalService();

      if (intentResult.intent === "generate_video") {
        const selectedModel = (body.model || "kling-3.0") as import("../services/fal.js").VideoModelKey;

        // ─── Smart Reference Image Flow ───
        // 1. Check Gemini's response
        let useAsStartingFrame = intentResult.useTaggedAssetAsStartingFrame === true || intentResult.useTaggedAssetAsStartingFrame === "true";
        let startingFrameName = intentResult.startingFrameAssetName || "";

        // 2. Safety net: detect starting frame language directly from user's message
        //    Don't rely solely on Gemini — parse "@assetName as the starting frame" etc.
        if (!useAsStartingFrame && body.taggedAssets && body.taggedAssets.length > 0) {
          const msg = body.message.toLowerCase();
          const startFramePatterns = [
            /using\s+@(\S+)\s+as\s+(?:the\s+)?start(?:ing)?\s+frame/i,
            /@(\S+)\s+as\s+(?:the\s+)?start(?:ing)?\s+frame/i,
            /start(?:ing)?\s+frame\s+@(\S+)/i,
            /begin\s+with\s+@(\S+)/i,
            /first\s+frame\s+@(\S+)/i,
            /@(\S+)\s+as\s+(?:the\s+)?first\s+frame/i,
          ];
          for (const pattern of startFramePatterns) {
            const match = body.message.match(pattern);
            if (match) {
              useAsStartingFrame = true;
              startingFrameName = match[1];
              console.log(`[ai/chat] Safety net: detected starting frame from user message — asset: "${startingFrameName}"`);
              break;
            }
          }
          // Also check for simpler "as the starting frame" without regex capture
          if (!useAsStartingFrame && /as\s+(?:the\s+)?start(?:ing)?\s+frame/i.test(msg)) {
            useAsStartingFrame = true;
            // Find the @mention closest to "starting frame" in the message
            const atMentions = body.message.match(/@\S+/g);
            if (atMentions && atMentions.length > 0) {
              startingFrameName = atMentions[0].replace("@", "");
              console.log(`[ai/chat] Safety net: "starting frame" detected, using first @mention: "${startingFrameName}"`);
            }
          }
        }

        // Find the starting frame asset by name (if specified)
        let startingFrameAsset = startingFrameName
          ? body.taggedAssets?.find(a => a.name.toLowerCase().includes(startingFrameName.toLowerCase()))
          : null;
        // Fallback: if useAsStartingFrame is true but no name match, use the first non-character asset
        if (useAsStartingFrame && !startingFrameAsset) {
          // Try matching without file extension
          const nameNoExt = startingFrameName.replace(/\.\w+$/, "").toLowerCase();
          startingFrameAsset = body.taggedAssets?.find(a => a.name.toLowerCase().includes(nameNoExt)) || null;
        }
        if (useAsStartingFrame && !startingFrameAsset) {
          startingFrameAsset = body.taggedAssets?.find(a => a.type === "image") || body.taggedAssets?.[0] || null;
        }

        // Character reference assets = all tagged assets EXCEPT the starting frame
        const characterAssets = body.taggedAssets?.filter(a =>
          (a.type === "character" || a.type === "image") && a !== startingFrameAsset
        ) || [];

        // Also consider uploaded images as character refs if no starting frame
        const fallbackCharRef = characterAssets.length > 0
          ? characterAssets[0]
          : (!useAsStartingFrame && body.imageUrls?.length ? { name: "uploaded", url: body.imageUrls[0], type: "image" as const } : null);

        console.log(`[ai/chat] ═══ VIDEO GENERATION DECISION ═══`);
        console.log(`[ai/chat] taggedAssets received: ${body.taggedAssets?.map(a => `"${a.name}"(${a.type})[${a.url.slice(0, 60)}]`).join(", ") || "NONE"}`);
        console.log(`[ai/chat] imageUrls received: ${body.imageUrls?.length || 0}`);
        console.log(`[ai/chat] Gemini said: useTaggedAssetAsStartingFrame=${intentResult.useTaggedAssetAsStartingFrame}, startingFrameAssetName="${intentResult.startingFrameAssetName || ""}"`);
        console.log(`[ai/chat] After safety net: useAsStartingFrame=${useAsStartingFrame}, startingFrameName="${startingFrameName}"`);
        console.log(`[ai/chat] startingFrameAsset: ${startingFrameAsset ? `"${startingFrameAsset.name}" url=${startingFrameAsset.url.slice(0, 60)}` : "NOT FOUND"}`);
        console.log(`[ai/chat] characterAssets: ${characterAssets.map(a => a.name).join(", ") || "none"}`);
        console.log(`[ai/chat] fallbackCharRef: ${fallbackCharRef ? `"${fallbackCharRef.name}"` : "null"}`);
        console.log(`[ai/chat] hasUserImages: ${hasUserImages}, needsReferenceImage: ${intentResult.needsReferenceImage}`);

        if (useAsStartingFrame && startingFrameAsset) {
          // User explicitly wants this specific asset as the starting frame
          console.log(`[ai/chat] ▶ PATH: STARTING FRAME — "${startingFrameAsset.name}" → submitImageToVideo`);
          const cleanImageUrl = startingFrameAsset.url;
          console.log(`[ai/chat] >>> SENDING TO FAL.AI: imageUrl="${cleanImageUrl.slice(0, 120)}", model="${selectedModel}"`);
          // Ensure the VM prompt has the starting frame instruction (enhancePrompt may have stripped it)
          // Strip the user's @mention from the raw message to get clean action description
          const userAction = body.message.replace(/@[\w.:\-]+/g, "").replace(/\s+/g, " ").trim();
          let vmPrompt = intentResult.enhancedPrompt;
          if (!vmPrompt.startsWith("THE ATTACHED IMAGE IS THE STARTING FRAME")) {
            vmPrompt = `THE ATTACHED IMAGE IS THE STARTING FRAME. Animate this exact frame into motion. The user wants: ${userAction}. ${vmPrompt}`;
          }
          const { requestId, modelId } = await falService.submitImageToVideo({
            prompt: vmPrompt,
            model: selectedModel,
            aspectRatio: body.aspectRatio as "16:9" | "9:16" | "1:1",
            duration: intentResult.duration || 5,
            imageUrl: cleanImageUrl,
          });

          res.json({
            success: true,
            data: {
              type: "video",
              status: "queued",
              message: intentResult.response,
              enhancedPrompt: intentResult.enhancedPrompt,
              referenceImageUrl: startingFrameAsset.url,
              requestId,
              modelId,
            },
          });
          return;
        }

        if (fallbackCharRef) {
          // Character reference — send the image URL + descriptive prompt to VM
          console.log(`[ai/chat] ▶ PATH: CHARACTER REFERENCE — "${fallbackCharRef.name}" → submitImageToVideo`);
          const cleanImageUrl = fallbackCharRef.url;
          // Ensure the VM prompt has the character reference instruction
          let vmPrompt = intentResult.enhancedPrompt;
          if (!vmPrompt.startsWith("THE ATTACHED IMAGE IS A CHARACTER REFERENCE")) {
            vmPrompt = `THE ATTACHED IMAGE IS A CHARACTER REFERENCE SHOWING HOW THE CHARACTER SHOULD LOOK (face, body, clothing, features). DO NOT USE IT AS THE STARTING FRAME. Instead, generate the following scene: ${vmPrompt}`;
          }
          const { requestId, modelId } = await falService.submitImageToVideo({
            prompt: vmPrompt,
            model: selectedModel,
            aspectRatio: body.aspectRatio as "16:9" | "9:16" | "1:1",
            duration: intentResult.duration || 5,
            imageUrl: cleanImageUrl,
          });

          res.json({
            success: true,
            data: {
              type: "video",
              status: "queued",
              message: intentResult.response,
              enhancedPrompt: intentResult.enhancedPrompt,
              referenceImageUrl: fallbackCharRef.url,
              requestId,
              modelId,
            },
          });
          return;
        }

        if (intentResult.needsReferenceImage && intentResult.referenceImagePrompt && !hasUserImages) {
          // Only generate a reference image when user didn't provide any images
          console.log(`[ai/chat] ▶ PATH: GENERATING REFERENCE IMAGE (no user images) — needsReferenceImage=true, hasUserImages=false`);
          const refImagePrompt = intentResult.referenceImagePrompt;

          try {
            // 1. Generate reference image via Google Imagen 3 (Nano Banana Pro)
            //    Uses existing Gemini API key — no fal.ai call needed
            const aspectMap: Record<string, "1:1" | "3:4" | "4:3" | "9:16" | "16:9"> = {
              "1:1": "1:1", "9:16": "9:16", "16:9": "16:9",
              "4:3": "4:3", "4:5": "3:4",
            };
            const imagenResults = await gemini.generateImage(refImagePrompt, {
              aspectRatio: aspectMap[body.aspectRatio] || "16:9",
            });

            if (imagenResults.length > 0) {
              const { imageData, mimeType } = imagenResults[0];
              console.log(`[ai/chat] Imagen 3 reference image generated (${imageData.length} bytes)`);

              // 2. Upload reference image buffer to Supabase
              const ext = mimeType.includes("png") ? "png" : "jpg";
              const refFilename = `ref-image-${Date.now()}.${ext}`;
              let savedRefImageUrl: string;
              try {
                const uploaded = await storageService.uploadFile(
                  BUCKETS.MEDIA,
                  "ai-generations",
                  imageData,
                  refFilename,
                  { contentType: mimeType }
                );
                savedRefImageUrl = uploaded.url;
                console.log(`[ai/chat] Reference image saved to Supabase: ${savedRefImageUrl}`);
              } catch (uploadErr) {
                // Fallback: encode as data URL so i2v can still use it
                console.error("[ai/chat] Failed to save ref image to Supabase:", uploadErr);
                savedRefImageUrl = `data:${mimeType};base64,${imageData.toString("base64")}`;
              }

              // 3. Submit image-to-video with the reference image
              console.log(`[ai/chat] Submitting image-to-video (model: ${selectedModel})...`);
              const { requestId, modelId } = await falService.submitImageToVideo({
                prompt: intentResult.enhancedPrompt,
                model: selectedModel,
                aspectRatio: body.aspectRatio as "16:9" | "9:16" | "1:1",
                duration: intentResult.duration || 5,
                imageUrl: savedRefImageUrl,
              });
              console.log(`[ai/chat] Image-to-video queued: ${requestId}`);

              res.json({
                success: true,
                data: {
                  type: "video",
                  status: "queued",
                  message: intentResult.response,
                  enhancedPrompt: intentResult.enhancedPrompt,
                  referenceImageUrl: savedRefImageUrl,
                  requestId,
                  modelId,
                },
              });
              return;
            }
          } catch (refErr) {
            console.error("[ai/chat] Imagen 3 reference image failed, falling back to text-to-video:", refErr);
            // Fall through to normal text-to-video below
          }
        }

        // ─── Fallback: check for ANY available images before going pure text-to-video ───
        // This catches cases where tagged assets or uploaded images weren't matched above
        // (e.g. Gemini didn't output useTaggedAssetAsStartingFrame, or name mismatch)
        const fallbackImageUrl = (body.imageUrls && body.imageUrls.length > 0 ? body.imageUrls[0] : null)
          || (body.taggedAssets && body.taggedAssets.length > 0 ? body.taggedAssets[0].url : null);

        if (fallbackImageUrl) {
          // Check if user's message mentions "starting frame" — add instructions even in fallback
          const isStartingFrame = /start(?:ing)?\s+frame|first\s+frame|begin\s+with/i.test(body.message);
          let fallbackPrompt = intentResult.enhancedPrompt;
          if (isStartingFrame && !fallbackPrompt.startsWith("THE ATTACHED IMAGE IS THE STARTING FRAME")) {
            fallbackPrompt = `THE ATTACHED IMAGE IS THE STARTING FRAME. Animate this exact frame into motion: ${fallbackPrompt}`;
          }
          console.log(`[ai/chat] ▶ PATH: FALLBACK I2V — found unused image: ${fallbackImageUrl.slice(0, 80)}, isStartingFrame=${isStartingFrame}`);
          const { requestId, modelId } = await falService.submitImageToVideo({
            prompt: fallbackPrompt,
            model: selectedModel,
            aspectRatio: body.aspectRatio as "16:9" | "9:16" | "1:1",
            duration: intentResult.duration || 5,
            imageUrl: fallbackImageUrl,
          });
          console.log(`[ai/chat] Fallback i2v queued: ${requestId}`);

          res.json({
            success: true,
            data: {
              type: "video",
              status: "queued",
              message: intentResult.response,
              enhancedPrompt: intentResult.enhancedPrompt,
              referenceImageUrl: fallbackImageUrl,
              requestId,
              modelId,
            },
          });
          return;
        }

        // ─── Standard text-to-video flow (no images available at all) ───
        console.log(`[ai/chat] ▶ PATH: PURE TEXT-TO-VIDEO — no images available at all`);
        console.log(`[ai/chat] Prompt length: ${intentResult.enhancedPrompt.length} chars`);
        console.log(`[ai/chat] Submitting video to fal.ai queue (model: ${selectedModel})...`);
        const { requestId, modelId } = await falService.submitVideo({
          prompt: intentResult.enhancedPrompt,
          model: selectedModel,
          aspectRatio: body.aspectRatio as "16:9" | "9:16" | "1:1",
          duration: intentResult.duration || 5,
        });
        console.log(`[ai/chat] Video queued: ${requestId}`);

        res.json({
          success: true,
          data: {
            type: "video",
            status: "queued",
            message: intentResult.response,
            enhancedPrompt: intentResult.enhancedPrompt,
            requestId,
            modelId,
          },
        });
        return;
      }

      if (intentResult.intent === "generate_image") {
        const { requestId, modelId } = await falService.submitImage({
          prompt: intentResult.enhancedPrompt,
          aspectRatio: body.aspectRatio as "16:9" | "9:16" | "1:1",
        });

        res.json({
          success: true,
          data: {
            type: "image",
            status: "queued",
            message: intentResult.response,
            enhancedPrompt: intentResult.enhancedPrompt,
            requestId,
            modelId,
          },
        });
        return;
      }
    }

    // ─── Element Edit via SAM2 segmentation ───
    // User wants to modify a specific character/object in an existing video
    if (intentResult.intent === "edit_element") {
      const editParams = intentResult.elementEditParams || {};

      // Resolve the target clip URL — from timelineClips by index, or fallback to existingVideoUrl
      // IMPORTANT: Only video clips can be used for SAM2 element editing, not images
      let targetVideoUrl: string | undefined;
      let targetClipIndex: number | undefined;
      if (body.timelineClips && body.timelineClips.length > 0) {
        const clipIdx = editParams.targetClipIndex || 1;
        let targetClip = body.timelineClips.find(c => c.index === clipIdx);

        // If the resolved clip is an image, find the nearest video clip instead
        if (targetClip && targetClip.type === "image") {
          console.warn(`[ai/chat] Clip #${clipIdx} is an image, searching for nearest video clip...`);
          const videoClips = body.timelineClips.filter(c => c.type === "video" || !c.type);
          if (videoClips.length > 0) {
            // Find the video clip the user most likely meant
            targetClip = videoClips.reduce((closest, c) =>
              Math.abs(c.index - clipIdx) < Math.abs(closest.index - clipIdx) ? c : closest
            );
            console.log(`[ai/chat] Using video clip #${targetClip.index} instead`);
          } else {
            targetClip = undefined;
          }
        }

        if (targetClip) {
          targetVideoUrl = targetClip.url;
          targetClipIndex = targetClip.index;
          console.log(`[ai/chat] Resolved target clip #${targetClipIndex}: "${targetClip.name}" (${targetClip.type}) → ${targetClip.url.slice(0, 80)}...`);
        } else {
          // Fallback to first video clip
          const firstVideo = body.timelineClips.find(c => c.type === "video" || !c.type);
          if (firstVideo) {
            targetVideoUrl = firstVideo.url;
            targetClipIndex = firstVideo.index;
            console.warn(`[ai/chat] Clip #${clipIdx} not usable, falling back to video clip #${targetClipIndex}`);
          }
        }
      } else {
        targetVideoUrl = body.existingVideoUrl;
      }

      if (!targetVideoUrl) {
        res.json({
          success: true,
          data: {
            type: "text",
            status: "done",
            message: "I need a video on your timeline to edit an element. Generate a video first, then I can modify specific characters or objects in it.",
          },
        });
        return;
      }

      try {
        const targetColor = editParams.targetColor || null;
        console.log(`[ai/chat] Element edit: target="${editParams.target}", modification="${editParams.modification}", clipIndex=${targetClipIndex || "N/A"}, targetColor=${targetColor}`);

        // 1. SAM2 segment the target element (returns mask video with output_video=true)
        const replicate = new ReplicateService();
        console.log(`[ai/chat] Running SAM2 segmentation on video...`);
        const segResult = await replicate.segmentVideo({
          videoUrl: targetVideoUrl,
          points: [{ x: 0.5, y: 0.5, frameIndex: 0 }], // center point for auto-detect
        });
        console.log(`[ai/chat] SAM2 segmentation complete: maskedVideo=${!!segResult.maskedVideo}, maskFrames=${segResult.maskFrames?.length || 0}`);

        // 2. Apply modification via FFmpeg using SAM2 mask
        const maskUrl = segResult.maskedVideo || (segResult.maskFrames?.length > 0 ? segResult.maskFrames[0] : null);

        if (!maskUrl) {
          console.error("[ai/chat] SAM2 returned no mask video or frames");
          res.json({
            success: true,
            data: {
              type: "text",
              status: "done",
              message: "SAM2 segmentation completed but couldn't generate a usable mask. Please try again.",
            },
          });
          return;
        }

        // Call Python FFmpeg service to apply color change within mask
        const pythonUrl = process.env.PYTHON_API_URL || "http://localhost:8001";
        const projectId = body.projectId || "default";
        const fillType = targetColor ? "color" : "blur";
        const fillValue = targetColor || null;

        console.log(`[ai/chat] Requesting FFmpeg mask apply: fillType=${fillType}, fillValue=${fillValue}`);
        const compositeRes = await fetch(`${pythonUrl}/composite/mask/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            videoUrl: targetVideoUrl,
            maskUrl,
            fillType,
            fillValue,
            invert: false,
          }),
        });

        if (!compositeRes.ok) {
          const errText = await compositeRes.text();
          console.error(`[ai/chat] FFmpeg mask apply failed: ${compositeRes.status} - ${errText}`);
          res.json({
            success: true,
            data: {
              type: "text",
              status: "done",
              message: "I segmented the element but the color modification step failed. Please try again.",
            },
          });
          return;
        }

        const compositeData = await compositeRes.json() as { url?: string; success?: boolean };
        const resultVideoUrl = compositeData.url;
        console.log(`[ai/chat] FFmpeg mask apply result: ${resultVideoUrl}`);

        if (!resultVideoUrl) {
          res.json({
            success: true,
            data: {
              type: "text",
              status: "done",
              message: "The compositing step didn't return a result. Please try again.",
            },
          });
          return;
        }

        // 3. Upload result to media bucket for timeline use
        let finalUrl = resultVideoUrl;
        try {
          const filename = `element-edit-${Date.now()}.mp4`;
          const uploaded = await storageService.uploadFromUrl(
            BUCKETS.MEDIA,
            "ai-generations",
            resultVideoUrl,
            filename
          );
          finalUrl = uploaded.url;
          console.log(`[ai/chat] Element edit result uploaded to media: ${finalUrl}`);
        } catch {
          console.warn("[ai/chat] Failed to copy result to media bucket, using export URL directly");
        }

        res.json({
          success: true,
          data: {
            type: "element_edit",
            status: "done",
            message: intentResult.response,
            elementEdit: {
              target: editParams.target,
              modification: editParams.modification,
              resultVideoUrl: finalUrl,
              originalVideoUrl: targetVideoUrl,
              targetClipIndex,
            },
          },
        });
        return;
      } catch (err) {
        console.error("[ai/chat] Element edit failed:", err);
        res.json({
          success: true,
          data: {
            type: "text",
            status: "done",
            message: `I encountered a temporary issue while editing that element. Please try again — the issue may be resolved now.`,
          },
        });
        return;
      }
    }

    // ─── Character Creation via Imagen 3 Reference Sheet ───
    if (intentResult.intent === "create_character") {
      const charParams = intentResult.characterParams || {};
      const charName = charParams.name || `Character ${Date.now()}`;
      const charDescription = charParams.description || body.message;

      console.log(`[ai/chat] Creating character: "${charName}" — ${charDescription.slice(0, 80)}...`);

      try {
        // Collect reference images (uploaded images + tagged asset images)
        const referenceImageUrls: string[] = [];
        if (body.imageUrls && body.imageUrls.length > 0) {
          referenceImageUrls.push(...body.imageUrls);
        }
        if (body.taggedAssets && body.taggedAssets.length > 0) {
          for (const asset of body.taggedAssets) {
            if (asset.type === "image" || asset.type === "character") {
              referenceImageUrls.push(asset.url);
            }
          }
        }

        const hasReferenceImages = referenceImageUrls.length > 0;
        console.log(`[ai/chat] Character creation — ${hasReferenceImages ? `${referenceImageUrls.length} reference image(s) attached` : "no reference images, text-only"}`);

        // Build the character reference sheet prompt
        // NOTE: The Gemini image model already has a system instruction enforcing photorealism,
        // so we focus the user prompt on layout and identity matching.
        const refSheetPrompt = hasReferenceImages
          ? `Create a professional character reference sheet based STRICTLY on the attached reference image(s). The output MUST match the EXACT person — same face, skin tone, body type, hair, and features. Do NOT alter their appearance.

Additional details from the user: ${charDescription}.

LAYOUT — clean reference sheet, soft neutral gray studio backdrop:
Top row: four full-body standing views of the SAME person – front, left profile, right profile, back. Relaxed A-pose, consistent scale.
Bottom row: three close-up portrait headshots – front, left profile, right profile.

Perfect identity consistency with the reference across every panel. 3-point studio lighting (key, fill, rim). 8K detail.`
          : `Create a professional character reference sheet of this person:

${charDescription}.

LAYOUT — clean reference sheet, soft neutral gray studio backdrop, shot on Canon EOS R5, 85mm f/1.4:
Top row: four full-body standing views – front, left profile, right profile, back. Relaxed natural standing pose, consistent scale.
Bottom row: three close-up portrait headshots – front, left profile, right profile.

Perfect identity consistency across every panel. Real human skin with pores and texture, natural hair with individual strands, real eye reflections. 3-point studio lighting (key, fill, rim). 8K detail.`;

        // Generate the reference sheet with Imagen 3 — pass reference images if available
        const imagenResults = await gemini.generateImage(refSheetPrompt, {
          aspectRatio: "16:9",
          numberOfImages: 1,
          ...(hasReferenceImages && { referenceImageUrls }),
        });

        const savedImages: string[] = [];

        for (let i = 0; i < imagenResults.length; i++) {
          const { imageData, mimeType } = imagenResults[i];
          const ext = mimeType.includes("png") ? "png" : "jpg";
          const filename = `character-${charName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}-${i}.${ext}`;
          try {
            const uploaded = await storageService.uploadFile(
              BUCKETS.MEDIA,
              "characters",
              imageData,
              filename,
              { contentType: mimeType }
            );
            savedImages.push(uploaded.url);
            console.log(`[ai/chat] Character image saved: ${uploaded.url}`);
          } catch {
            const dataUrl = `data:${mimeType};base64,${imageData.toString("base64")}`;
            savedImages.push(dataUrl);
          }
        }

        if (savedImages.length === 0) {
          res.json({
            success: true,
            data: {
              type: "text",
              status: "done",
              message: "I couldn't generate the character reference sheet. Please try again with a different description.",
            },
          });
          return;
        }

        res.json({
          success: true,
          data: {
            type: "character",
            status: "done",
            message: intentResult.response,
            character: {
              name: charName,
              description: charDescription,
              images: savedImages,
            },
          },
        });
        return;
      } catch (err) {
        console.error("[ai/chat] Character creation failed:", err);
        res.json({
          success: true,
          data: {
            type: "text",
            status: "done",
            message: "I had trouble creating the character reference sheet. Please try again.",
          },
        });
        return;
      }
    }

    // Text editing operations — return lightweight params for frontend to execute
    if (intentResult.intent === "edit_text" || intentResult.intent === "add_text" || intentResult.intent === "delete_text") {
      res.json({
        success: true,
        data: {
          type: intentResult.intent,
          status: "done",
          message: intentResult.response,
          editParams: intentResult.editParams || {},
        },
      });
      return;
    }

    // Audio generation — call ElevenLabs directly (synchronous, returns audio URL)
    if (intentResult.intent === "generate_sfx" || intentResult.intent === "generate_tts") {
      const elevenlabs = new ElevenLabsService();

      try {
        let audioResult;

        if (intentResult.intent === "generate_sfx") {
          const params = intentResult.audioParams || {};
          console.log(`[ai/chat] Generating SFX: "${params.prompt}"`);
          audioResult = await elevenlabs.generateSFX({
            prompt: params.prompt || body.message,
            durationSeconds: params.duration || 5,
          });
        } else {
          const params = intentResult.audioParams || {};
          console.log(`[ai/chat] Generating TTS: "${params.text}"`);
          audioResult = await elevenlabs.textToSpeech({
            text: params.text || body.message,
            voiceId: params.voiceId,
          });
        }

        // Upload audio to Supabase for permanent storage
        let permanentUrl = audioResult.audioUrl;
        try {
          const filename = `ai-audio-${Date.now()}.mp3`;
          const audioBuffer = Buffer.from(
            audioResult.audioUrl.replace("data:audio/mpeg;base64,", ""),
            "base64"
          );
          const uploaded = await storageService.uploadFile(
            BUCKETS.MEDIA,
            "ai-generations",
            audioBuffer,
            filename,
            { contentType: "audio/mpeg" }
          );
          permanentUrl = uploaded.url;
          console.log(`[ai/chat] Audio saved to Supabase: ${permanentUrl}`);
        } catch (uploadErr) {
          console.error("[ai/chat] Audio upload to Supabase failed, using base64:", uploadErr);
        }

        res.json({
          success: true,
          data: {
            type: "audio",
            status: "done",
            message: intentResult.response,
            audioUrl: permanentUrl,
          },
        });
        return;
      } catch (audioErr) {
        console.error("[ai/chat] Audio generation failed:", audioErr);
        res.json({
          success: true,
          data: {
            type: "text",
            status: "done",
            message: `Sorry, I couldn't generate the audio. ${audioErr instanceof Error ? audioErr.message : "Please try again."}`,
          },
        });
        return;
      }
    }

    // Conversation — just return text
    res.json({
      success: true,
      data: {
        type: "text",
        status: "done",
        message: intentResult.response,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/ai/status/:requestId - Poll generation status
// When complete, downloads from fal.ai CDN → uploads to Supabase → returns permanent URL
aiRouter.get("/status/:requestId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requestId } = req.params;
    const modelId = (req.query.modelId as string) || "fal-ai/kling-video/v3/pro/text-to-video";
    const mediaType = (req.query.type as string) || "video";
    const projectId = req.query.projectId as string | undefined;
    const fal = new FalService();

    const result = await fal.checkJobStatus(requestId, modelId);

    if (result.status === "completed" && result.result?.url) {
      // Check if we already uploaded this file (repeated polls)
      const cached = uploadCache.get(requestId);
      if (cached) {
        console.log(`[ai/status] Returning cached upload for ${requestId}: ${cached.url}`);
        res.json({
          success: true,
          data: {
            status: "completed",
            result: {
              url: cached.url,
              requestId,
              path: cached.path,
              name: cached.name,
              type: cached.type,
            },
          },
        });
        return;
      }

      // If another poll is already uploading this file, wait for it
      const inFlight = uploadInFlight.get(requestId);
      if (inFlight) {
        try {
          console.log(`[ai/status] Upload already in progress for ${requestId}, waiting...`);
          const uploadResult = await inFlight;
          res.json({
            success: true,
            data: {
              status: "completed",
              result: { ...uploadResult, requestId },
            },
          });
          return;
        } catch {
          // In-flight upload failed, fall through to retry upload below
          console.warn(`[ai/status] In-flight upload failed for ${requestId}, will retry`);
        }
      }

      // Download from fal.ai temp CDN and save to Supabase permanently
      const ext = mediaType === "image" ? "png" : "mp4";
      const filename = `ai-generated-${Date.now()}.${ext}`;
      const projectFolder = "ai-generations";

      // Create the upload promise and register it as in-flight
      const uploadPromise = (async () => {
        console.log(`[ai/status] Saving to Supabase: ${result.result!.url}`);
        const uploaded = await storageService.uploadFromUrl(
          BUCKETS.MEDIA,
          projectFolder,
          result.result!.url,
          filename
        );
        console.log(`[ai/status] Saved to Supabase: ${uploaded.url}`);
        const cachedResult = { url: uploaded.url, path: uploaded.path, name: filename, type: mediaType };
        uploadCache.set(requestId, cachedResult);
        // Clean up cache after 10 minutes
        setTimeout(() => uploadCache.delete(requestId), 10 * 60 * 1000);
        return cachedResult;
      })();

      uploadInFlight.set(requestId, uploadPromise);

      try {
        const uploadResult = await uploadPromise;
        uploadInFlight.delete(requestId);

        // Auto-populate SceneDNA from generated video (fire-and-forget)
        if (projectId && mediaType === "video") {
          sceneDNAService.generateFromVideo(uploadResult.url, projectId).then((dna) => {
            console.log(`[ai/status] SceneDNA auto-populated for project ${projectId}: theme="${dna.theme}", mood="${dna.mood}"`);
          }).catch((err) => {
            console.error(`[ai/status] SceneDNA auto-population failed for project ${projectId}:`, err);
          });
        }

        // Return the permanent Supabase URL instead of fal.ai temp URL
        res.json({
          success: true,
          data: {
            status: "completed",
            result: {
              url: uploadResult.url,
              requestId,
              path: uploadResult.path,
              name: uploadResult.name,
              type: uploadResult.type,
            },
          },
        });
        return;
      } catch (uploadErr: any) {
        uploadInFlight.delete(requestId);
        console.error("[ai/status] Supabase upload failed, will retry:", uploadErr);

        // Retry once with a fresh filename
        try {
          const retryFilename = `ai-generated-retry-${Date.now()}.${ext}`;
          console.log(`[ai/status] Retrying upload as ${retryFilename}...`);
          const retryUploaded = await storageService.uploadFromUrl(
            BUCKETS.MEDIA,
            projectFolder,
            result.result!.url,
            retryFilename
          );
          console.log(`[ai/status] Retry succeeded: ${retryUploaded.url}`);
          const cachedResult = { url: retryUploaded.url, path: retryUploaded.path, name: retryFilename, type: mediaType };
          uploadCache.set(requestId, cachedResult);
          setTimeout(() => uploadCache.delete(requestId), 10 * 60 * 1000);

          if (projectId && mediaType === "video") {
            sceneDNAService.generateFromVideo(retryUploaded.url, projectId).catch(() => {});
          }

          res.json({
            success: true,
            data: {
              status: "completed",
              result: {
                url: retryUploaded.url,
                requestId,
                path: retryUploaded.path,
                name: retryFilename,
                type: mediaType,
              },
            },
          });
          return;
        } catch (retryErr) {
          console.error("[ai/status] Retry upload also failed:", retryErr);
          // Return error instead of falling back to temporary fal.ai URL
          res.json({
            success: false,
            error: "Failed to save generated media to permanent storage. Please try again.",
            data: {
              status: "upload_failed",
              requestId,
            },
          });
          return;
        }
      }
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});
