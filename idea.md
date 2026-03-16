# Kluxta

**The Figma of AI Video — Voice-First, Asset-Aware, Context-Intelligent Video Production**

> Gemini Live Agent Challenge · March 2026  
> 📅 March 5, 2026  
> 🏆 Submission Deadline: March 16, 2026  
> 🧠 Powered by Gemini

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [The Solution](#2-the-solution)
3. [Scene DNA — The Core Innovation](#3-scene-dna--the-core-innovation)
4. [Pre-Production Asset Library](#4-pre-production-asset-library)
5. [The Full Pipeline](#5-the-full-pipeline)
6. [Gemini's Role — The Brain](#6-geminis-role--the-brain)
7. [Video & Image Models (fal.ai)](#7-video--image-models-falai)
8. [Tech Stack](#8-tech-stack)
9. [Project Scaffold](#9-project-scaffold)
10. [Costs & Pricing](#10-costs--pricing)
11. [Gemini Live Challenge Fit](#11-gemini-live-challenge-fit)
12. [Demo Script](#12-demo-script)
13. [MVP Scope](#13-mvp-scope)
14. [11-Day Build Schedule](#14-11-day-build-schedule)
15. [Product Market Fit](#15-product-market-fit)
16. [The Moat](#16-the-moat)
17. [Honest Risk Assessment](#17-honest-risk-assessment)
18. [Post-Hackathon Roadmap](#18-post-hackathon-roadmap)

---

## 1. The Problem

### Every AI video platform is broken the same way

You prompt. A model generates a flat video. You want to change one thing. You reprompt. The model regenerates the *entire video*. The result is inconsistent. You do it again. And again. Twenty times for one good clip.

> **This is not a niche complaint.** It is the #1 frustration documented across every AI video community — Twitter/X, Reddit, Discord servers for Higgsfield, Runway, Kling. Creators are spending 20–30 generations trying to get one good clip because changing one element destroys everything else.

### The Deeper Problem

Nobody treats an AI-generated video as a structured, editable project. Every platform outputs a flat file. No layers. No asset memory. No scene intelligence. It is the equivalent of Photoshop giving you a JPG with no layers and saying "good luck."

| Today's workflow | Kluxta's workflow |
|------------------|-------------------|
| Prompt → flat video → want to change jacket colour → reprompt entire scene → character looks different → mood changed → lighting shifted → repeat 20x | Speak naturally → Gemini understands intent → edits only that element → context auto-matched → result is consistent → done in one pass |

---

## 2. The Solution

### Kluxta — voice-first, AI-orchestrated video production

Kluxta is the first AI video platform that decomposes generated video into editable layers, stores scene intelligence as persistent DNA, and uses Gemini as the orchestration brain — accepting voice input, enhancing prompts automatically, and ensuring every edit stays visually consistent.

Users speak or type naturally. Gemini understands intent, enhances prompts with full scene context, routes requests to the correct model (video, image, voice), and narrates results back. The experience feels like directing a production crew — not wrestling with a prompt box.

---

## 3. Scene DNA — The Core Innovation

Every video generated on Kluxta is paired with a structured JSON file called the **Scene DNA**. Every AI model in the pipeline reads from it and writes to it. It is the source of truth for the entire project.

```json
{
  "video_id": "vid_abc123",
  "source_prompt": "Marcus walks into a dark warehouse slowly",
  "source_model": "kling-3.0",
  "scene": {
    "theme": "dark cinematic",
    "mood": "tense suspense",
    "dominant_colors": ["#1a1a1a", "#2d2d2d", "#8B4513"],
    "color_temperature": "warm",
    "lighting": {
      "direction": "top-right",
      "intensity": "low",
      "shadows": "strong"
    },
    "grain_level": "medium",
    "background": { "description": "dimly lit industrial warehouse" }
  },
  "assets": [
    {
      "asset_id": "char_001",
      "type": "character",
      "label": "Marcus",
      "position": "left-center",
      "bounding_box": { "x": 120, "y": 80, "w": 340, "h": 600 },
      "layer_file": "char_001_layer.webm",
      "clothing": "red tracksuit",
      "dominant_colors": ["#cc0000", "#1a1a1a"],
      "last_edited": null
    }
  ],
  "edit_history": []
}
```

When a user edits any element, the thinking model reads this file. It knows the exact theme, lighting direction, dominant colours, and character profiles. It uses this to inject context into every regeneration request automatically — without the user knowing.

---

## 4. Pre-Production Asset Library

### Build characters before you shoot

Before a video is generated, users can build a persistent character library. This eliminates the hardest part of the pipeline — trying to extract a character cleanly from an already-generated video — by designing them upfront.

This maps to how real film production works. You cast your actors before you shoot. You design characters before you animate. Kluxta is the first AI video platform that enforces this correct production order.

### Workflow

1. **Describe your character**  
   "Nigerian man, late 30s, red tracksuit, confident, studio lighting"  
   → Gemini routes to Nano Banana Pro (image gen)

2. **Character saved to Asset Library**  
   Full visual profile stored — appearance, colours, style reference image  
   → Supabase Storage

3. **Set scene context**  
   "Dark warehouse, warm cinematic, tense mood"  
   → Saved to project

4. **Generate video with @Marcus**  
   Video model receives: character reference image + scene context + motion prompt  
   → Kling 3.0 via fal.ai

5. **Consistent result, no extraction needed**  
   Marcus already exists as a clean, defined asset. Edits reference the library directly.  
   → Scene DNA written automatically

> **Why this matters for agencies:** A client's brand character is built once, then used across 50 different ad variations, scenes, and campaigns. Change the background, action, or product — but Marcus always looks like Marcus. That is an agency's dream workflow.

---

## 5. The Full Pipeline

1. **User speaks or types**  
   "Change Marcus's jacket to blue"  
   `Gemini Live API — real-time voice input`

2. **Gemini — Intent & Routing**  
   Reads Scene DNA. Understands this is an element edit, not a new generation. Routes to segmentation + re-generation flow.  
   `gemini-2.5-pro (thinking)`

3. **Prompt Auto-Enhancement**  
   Raw: "blue jacket" → Enhanced: "char_001, blue jacket, MATCH dark warm cinematic theme, top-right directional lighting, dominant #1a1a1a bg, film grain medium, avoid cool/bright tones inconsistent with scene"  
   `gemini-2.0-flash`

4. **SAM2 Segmentation**  
   Extracts Marcus as isolated alpha-channel layer. Writes bounding box, frame range, position data to Scene DNA.  
   `SAM2 Video via Replicate ($0.02/run)`

5. **Asset Regeneration**  
   Sends extracted Marcus frames + context-enhanced prompt to video model. Only his frames processed — not the entire video.  
   `Kling 3.0 via fal.ai (~$0.145 for 5s)`

6. **Conflict Detection**  
   Thinking model compares new asset metadata vs original Scene DNA. Detects: new asset is blue/bright, scene is dark/warm. Generates correction instructions.  
   `gemini-2.5-pro (thinking)`

7. **FFmpeg Recomposite**  
   Layers all assets back in order. Applies colour correction instructions. Renders final video.  
   `FFmpeg — Python backend on Railway ($0.00)`

8. **Gemini narrates result**  
   "Done. Marcus's jacket is blue. I've adjusted the warmth to match your dark warehouse theme."  
   `Gemini Live API — voice output`

---

## 6. Gemini's Role — The Brain

Gemini is not just a feature in Kluxta. It is the entire nervous system. Every user action passes through Gemini. Every model call is dispatched by Gemini. Every result is narrated by Gemini.

| Gemini Role | Model | What it does |
|-------------|-------|--------------|
| Voice Interface | Gemini Live API | Real-time audio in/out. User speaks, Gemini listens, responds with voice. |
| Intent Routing | gemini-2.5-pro | Understands what the user wants and routes to the right model/flow. |
| Prompt Enhancement | gemini-2.0-flash | Rewrites rough user prompts into detailed, context-rich model instructions. |
| Scene Analysis | gemini-2.0-flash | Watches key video frames and writes the Scene DNA JSON file. |
| Context Injection | gemini-2.5-pro | Reads Scene DNA and injects full visual context into every edit prompt. |
| Conflict Detection | gemini-2.5-pro | Detects mismatches between new assets and original scene. Writes correction instructions. |
| Result Narration | Gemini Live API | Confirms what was done, explains adjustments made, in natural spoken language. |

### The Prompt Enhancement Button

One of the standout UX features. A single button that sends the user's rough prompt through Gemini Flash for automatic enrichment before it hits any video model.

```
User types:   "guy running scared"

After Gemini: "A Nigerian man in a red tracksuit sprinting in
              panic through a dimly lit industrial warehouse.
              Camera tracks at shoulder height. Tense cinematic
              mood. Top-right warm directional lighting.
              Film grain medium. Dark background #1a1a1a.
              Shallow depth of field. Cinematic 16:9."
```

Users get dramatically better outputs without knowing why. They attribute the quality to Kluxta, not to Kling or Runway underneath. That is how you build brand equity on top of commodity models.

---

## 7. Video & Image Models (fal.ai)

### Text-to-Video

| Model | fal.ai Endpoint | Price | Best For | Status |
|-------|-----------------|-------|----------|--------|
| Kling 3.0 Pro | `fal-ai/kling-video/v3/pro/text-to-video` | ~$0.10/sec | Primary — 4K, multi-shot, best value | ✅ Available |
| Seedance 2.0 | `fal-ai/seedance-2.0` | ~$0.10/min (720p) | Future premium — best physics, @ reference system | 🟡 Coming Soon |
| Veo 3 | `fal-ai/veo3` | ~$0.20/sec | Premium, native audio, Google ecosystem | ✅ Available |
| Wan 2.6 | `fal-ai/wan/v2.6/text-to-video` | ~$0.05/sec | Budget fallback | ✅ Available |

### Image-to-Video

| Model | fal.ai Endpoint | Price | Best For | Status |
|-------|-----------------|-------|----------|--------|
| Kling 3.0 Pro | `fal-ai/kling-video/v3/pro/image-to-video` | ~$0.10/sec | Character reference → video, best consistency | ✅ Available |
| Kling 2.6 Pro | `fal-ai/kling-video/v2.6/pro/image-to-video` | $0.07/sec | Cheaper, native audio option | ✅ Available |
| Veo 2 | `fal-ai/veo2/image-to-video` | ~$0.15/sec | High quality, Google ecosystem | ✅ Available |

### Image Generation (Character Creation)

| Model | fal.ai Endpoint | Price | Notes |
|-------|-----------------|-------|-------|
| Nano Banana Pro | `fal-ai/nano-banana-pro` | ~$0.04/image | Google model — excellent for hackathon judges. Fast, high quality. |
| FLUX Dev | `fal-ai/flux/dev` | ~$0.03/image | Fallback. Excellent quality for character portraits. |

> **On Seedance 2.0:** ByteDance's best model. Official API delayed from Feb 24 target — no confirmed date as of early March 2026. fal.ai has it listed as "Coming Soon." Design `lib/fal.ts` with a model config object so Seedance slots in as a one-line swap. When it lands, it becomes your premium tier automatically. Its @ reference system (pass character images + scene reference + audio simultaneously) maps perfectly to the Asset Library concept.

---

## 8. Tech Stack

| Layer | Technology | Role |
|-------|------------|------|
| Frontend | Next.js 14 + TypeScript | Studio UI, layer panel, voice interface |
| Styling | Tailwind CSS + shadcn/ui | Component library |
| Auth | Clerk | User management, sessions |
| Database | Supabase (Postgres) | Projects, DNA files, edit history, asset metadata |
| File Storage | Supabase Storage | Videos, layer files, character reference images |
| Voice Interface | Gemini Live API | Real-time audio input/output — the front-end UI |
| Brain / Orchestrator | Gemini 2.5 Pro (thinking) | Scene intelligence, conflict detection, routing |
| Prompt Enhancement | Gemini 2.0 Flash | Fast prompt rewriting + scene analysis |
| Video Generation | Kling 3.0 via fal.ai | Primary video model |
| Image Generation | Nano Banana Pro via fal.ai | Character creation |
| Segmentation | SAM2 via Replicate | Asset layer extraction from video |
| Voice Synthesis | ElevenLabs | Character voices, narration |
| Compositing | FFmpeg | Layer recomposition, colour grading |
| Python Backend | FastAPI on Railway | SAM2 + FFmpeg pipeline service |
| Frontend Deploy | Vercel | Next.js hosting |
| Cloud (Hackathon) | Google Cloud Run | Required for Gemini Live Challenge |

---

## 9. Project Scaffold

```
layerai/
├── app/
│   ├── page.tsx                     # Landing page
│   ├── studio/
│   │   └── page.tsx                 # Main editor UI
│   └── api/
│       ├── gemini/route.ts          # Gemini Live + orchestration
│       ├── generate/route.ts        # Video/image generation → fal.ai
│       ├── analyze/route.ts         # Vision analysis → Scene DNA
│       ├── segment/route.ts         # SAM2 via Replicate
│       ├── enhance-prompt/route.ts  # Gemini prompt enhancer
│       └── composite/route.ts       # FFmpeg trigger → Python backend
│
├── components/
│   ├── VoiceInterface.tsx           # Gemini Live mic + transcript UI
│   ├── LayerPanel.tsx               # Asset layers sidebar
│   ├── VideoPlayer.tsx              # Preview + layer overlay
│   ├── PromptBar.tsx                # Text input + Enhance button
│   └── AssetLibrary.tsx             # Saved characters + scenes
│
├── lib/
│   ├── fal.ts                       # fal.ai client + model configs
│   ├── gemini.ts                    # Gemini SDK + Live API setup
│   ├── replicate.ts                 # SAM2 segmentation calls
│   ├── ffmpeg.ts                    # Compositing helpers
│   ├── supabase.ts                  # DB + storage client
│   └── sceneDNA.ts                  # DNA schema + helpers
│
├── types/
│   └── index.ts                     # SceneDNA, Asset, Project types
│
├── python/                          # Railway microservice
│   ├── main.py                      # FastAPI app
│   ├── segment.py                   # SAM2 + frame extraction
│   ├── composite.py                 # FFmpeg compositing logic
│   └── requirements.txt
│
├── .env.local
├── cloudbuild.yaml                  # Automated Cloud Run deploy
└── README.md
```

### .env.local

```
GOOGLE_GEMINI_API_KEY=
FAL_KEY=
REPLICATE_API_TOKEN=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ELEVENLABS_API_KEY=
PYTHON_API_URL=
```

---

## 10. Costs & Pricing

### Cost Per Full Edit Cycle

| Item | Cost |
|------|------|
| Initial video generation (10s, Kling 3.0) | ~$0.290 |
| Vision analysis (10 frames, Gemini Flash) | ~$0.002 |
| SAM2 segmentation (Replicate) | ~$0.020 |
| Thinking model — context injection | ~$0.003 |
| Asset regeneration (5s, Kling 3.0) | ~$0.145 |
| Conflict detection pass | ~$0.003 |
| FFmpeg recomposite (self-hosted) | $0.000 |
| **Total per full edit cycle** | **~$0.46** |

### User Pricing & Margins

| Tier | Price | Includes | Est. Cost | Margin |
|------|-------|----------|-----------|--------|
| Free | $0/mo | 3 generations, 5 edits | ~$2.00 | Acquisition |
| Creator | $19/mo | 50 generations + 100 edits | ~$9.20 | ~$9.80 (52%) |
| Studio | $49/mo | 200 generations + 500 edits | ~$23.30 | ~$25.70 (52%) |
| Pro | $99/mo | ~300 generations, unlimited edits | ~$45 | ~$54 (55%) |
| API Access | Pay-per-use | $0.05/credit | ~$0.046/credit | ~8% markup |

---

## 11. Gemini Live Challenge Fit

### How Kluxta satisfies every requirement

| Requirement | How Kluxta satisfies it |
|-------------|-------------------------|
| Next-gen AI agent | Gemini orchestrates an entire video production pipeline end-to-end |
| Multimodal inputs + outputs | Voice in → video + image + audio out |
| Leverages Google Live API | Voice interface IS Gemini Live — the primary UI |
| Beyond text-in/text-out | Visual generation, scene analysis, layer editing, voice narration |
| Google GenAI SDK | Gemini 2.5 Pro + 2.0 Flash + Live API throughout |
| Google Cloud service | Google Cloud Run deployment |
| Video/image generation | Nano Banana Pro (Google image model) + Kling (video) |

### Bonus Points Checklist

- [ ] Blog post on dev.to / Medium with `#GeminiLiveAgentChallenge`
- [ ] Automated Cloud Run deploy — `cloudbuild.yaml` in public repo
- [ ] GDG membership link in submission
- [ ] Public GitHub repo with clean README
- [ ] 3-minute demo video — judges won't watch beyond 3 minutes

---

## 12. Demo Script

### 3-Minute Demo Script

#### [0:00 – 0:40] Character Creation

**Says:** "Create a Nigerian man, late 30s, red tracksuit, confident expression, studio lighting"

**Actions:**
- → Gemini routes to Nano Banana Pro
- → Character "Marcus" generated and displayed
- → Saved to Asset Library automatically
- → Gemini responds: *"Marcus is ready in your library."*

#### [0:40 – 1:20] Video Generation

**Says:** "Put Marcus in a dark warehouse walking slowly, cinematic"

**Actions:**
- → Gemini reads Asset Library, pulls Marcus reference
- → Auto-enhances prompt with scene context
- → Routes to Kling 3.0 with image reference
- → Video generates (~60 seconds)
- → Scene DNA written automatically (colours, lighting, mood)
- → Gemini: *"Done. I've saved the scene profile — dark warehouse, warm tone, top-right lighting."*

#### [1:20 – 1:50] Prompt Enhancement Demo

**User clicks "Enhance Prompt" button and types:** "make him look scared"

**Actions:**
- → Gemini Flash rewrites in real-time
- → Enhanced: *"Marcus, Nigerian man, red tracksuit, expression shifts to wide-eyed fear, pupils dilated, jaw slightly open. Dark warehouse, warm top-right directional lighting, film grain medium, cinematic 16:9. Match original dark theme #1a1a1a."*
- → Show before/after prompts side by side

#### [1:50 – 2:45] Layer Editing

**Says:** "Change his jacket to blue"

**Actions:**
- → Gemini reads Scene DNA: dark warm theme, dominant #1a1a1a
- → Auto-injects: *"blue jacket, MATCH dark warm cinematic, warm top-right lighting, avoid bright cool tones inconsistent with scene..."*
- → SAM2 extracts Marcus layer — show layer panel with bg/Marcus/foreground
- → Asset regenerated with context-aware prompt
- → FFmpeg recomposites all layers
- → Gemini: *"Done. Marcus's jacket is blue. I've adjusted the warmth to keep it consistent with your dark warehouse theme."*

#### [2:45 – 3:00] Closing

**Show:**
- Layer Panel — background, Marcus, foreground as separate clickable layers
- Scene DNA file briefly
- Asset Library with Marcus saved

**End.**

---

## 13. MVP Scope

### What ships on March 16

#### ✅ In Scope

- Gemini Live voice interface
- Text input + Enhance Prompt button
- Character creation via Nano Banana Pro
- Video generation via Kling 3.0 (fal.ai)
- Gemini Flash vision analysis → Scene DNA
- SAM2 segmentation → basic layer extraction
- Thinking model context injection
- FFmpeg recomposite
- Asset Library (save characters)
- Download final video
- Google Cloud Run deployment
- Public GitHub + README
- dev.to blog post

#### ❌ Out of Scope (v2)

- Seedance 2.0 (waiting on fal.ai)
- Colour grading final video pass
- Audio layer separation
- Multi-model user selection
- Physics correction
- Team collaboration
- Mobile app
- API access for developers
- Batch editing across scenes
- Style lock feature
- Subscription billing

---

## 14. 11-Day Build Schedule

### March 5 to March 15

| Days | Dates | Focus |
|------|-------|-------|
| **Days 1–2** | Mar 5–6 | **fal.ai integration + basic video generation** — Wire fal.ai client. Text prompt → Kling 3.0 → video URL working end-to-end. Test with 5 prompts. Get the pipe clean before building on top. |
| **Days 3–4** | Mar 7–8 | **Vision analysis + Scene DNA** — FFmpeg frame extraction. Gemini Flash analyses 10 frames. Scene DNA JSON written and stored in Supabase. Validate schema with 10 test videos. |
| **Days 5–6** | Mar 9–10 | **SAM2 segmentation + FFmpeg composite** — Python backend on Railway. SAM2 via Replicate on generated video. Extract bg + 1 character layer. Basic FFmpeg recomposite. Even if seams show — working pipeline first. |
| **Day 7** | Mar 11 | **Prompt enhancement button** — Gemini Flash rewrites user prompt. Show before/after in UI. This is a showstopper demo feature — make it feel fast and magical. |
| **Day 8** | Mar 12 | **Thinking model context injection** — Gemini 2.5 Pro reads Scene DNA before every edit. Auto-injects colour/theme/lighting context into user prompt. Test with "change jacket colour" edits. |
| **Day 9** | Mar 13 | **Gemini Live voice interface** — Mic button. Gemini Live receives audio. Transcribes intent. Routes to correct flow. Narrates result back in voice. This is the hackathon centrepiece. |
| **Day 10** | Mar 14 | **Asset Library + character creation** — Nano Banana Pro generates character from description. Save to library. Use as reference in video generation. @mention in prompts. |
| **Day 11** | Mar 15 | **Demo video + blog post + Cloud Run deploy + SUBMIT** — Record 3-minute demo. Write dev.to article with #GeminiLiveAgentChallenge. Push cloudbuild.yaml. Deploy to Cloud Run. Submit on Devpost before midnight. |

---

## 15. Product Market Fit

This is not an invented problem. The frustration of flat-video AI generation is documented loudly across every AI video community today. The question is whether people pay to solve it — and the answer is clearly yes in B2B contexts.

### Who pays, and why

| Segment | Pain | Willingness to Pay |
|---------|------|-------------------|
| Marketing agencies | Client says "change the jacket" — requires full video regeneration, inconsistent result, redo 15 times | High — Studio plan ($49/mo). Saves hours per client revision. |
| Animation / content studios | Character consistency across episodes is a genuine production problem today | High — Pro plan ($99/mo). Asset Library = core workflow. |
| Adtech / personalised video | Need to swap one element (product, CTA, character) without regenerating everything | Very High — API access. Direct ROI calculation. |
| Solo creators / influencers | Spending 20+ generations trying to get one consistent clip | Medium — Creator plan ($19/mo). Nice-to-have vs B2B must-have. |

> **Market validation:** HeyGen generates $20M+ monthly revenue solving a narrower version of the consistency problem (avatar lip-sync). That confirms this space pays at scale.

---

## 16. The Moat

1. **Asset decomposition — no one else does this**  
   Every other platform outputs a flat video file. Kluxta outputs a structured project — video + layers + Scene DNA. That is a fundamentally different product category.

2. **Persistent scene intelligence**  
   Scene DNA persists across every edit. The more you use Kluxta, the smarter it is about your project. Switching platforms means losing all of that accumulated context.

3. **Reason before regenerating**  
   Every other tool composites blindly. Kluxta detects conflicts before they happen and prevents mismatches at generation time. Users get seamless results without understanding why.

4. **Asset Library lock-in**  
   Users build their character roster, scene presets, and brand style guides on Kluxta. Switching means losing their entire creative asset library. Genuine value-based lock-in.

5. **Voice-first interface**  
   Gemini Live makes the experience feel like directing a crew, not fighting a prompt box. No competitor has a voice-native video production interface.

---

## 17. Honest Risk Assessment

| Problem | Reality | Mitigation |
|---------|---------|------------|
| SAM2 on AI-generated video | SAM2 trained on real footage. AI-generated textures are unusual. ~10% error rate on hair, smoke, blur. | Accept error rate in v0.1. Manual mask correction UI in v1. Test extensively before demo. |
| Character consistency after regen | Models drift even with reference images. Blue jacket Marcus won't be 100% identical. | Thinking model injects exact hex colors + descriptors from DNA. Reduces drift significantly but doesn't eliminate it. |
| Lighting seams on recomposite | Hard to match lighting perfectly with FFmpeg alone. Edges may be visible. | FFmpeg colour match filter in v1. Video model final correction pass in v2. |
| Latency (5–8 chained API calls) | Full edit cycle can take 2–4 minutes. Users may find this frustrating. | Step-by-step progress UI. Show each pipeline step completing in real-time. Async polling. |
| Seedance 2.0 unavailable | Best model, no stable fal.ai API yet. | Build on Kling 3.0. Design model config for one-line swap when Seedance lands. |
| Runway/Kling builds this natively | LTX Studio already moving toward asset persistence. Big players have users + infra. | Your window is real but not forever. Ship fast. The full loop (pre-built library + layer editing + scene DNA) is still unbuilt by anyone. |

---

## 18. Post-Hackathon Roadmap

| Phase | Timeline | Focus |
|-------|----------|-------|
| v0.1 MVP | Mar 16, 2026 | Hackathon submission — core pipeline working |
| v0.2 | April 2026 | Colour grading pass, Seedance 2.0 integration (when available) |
| v0.3 | May 2026 | Audio layer separation, multi-model selector, pricing tiers live |
| v1.0 | June 2026 | Public launch — Creator + Studio plans, ProductHunt |
| v1.1 | July 2026 | API access for developers, $0.05/credit billing |
| v2.0 | Q3 2026 | Team collaboration, batch editing across scenes, brand kits |

---

## Footer

**Kluxta** — Built with Gemini 2.5 Pro · Gemini 2.0 Flash · Gemini Live API · Nano Banana Pro · Kling 3.0 (fal.ai) · SAM2 (Replicate) · ElevenLabs · FFmpeg · Next.js · Supabase · Google Cloud Run

Submitted to: **Gemini Live Agent Challenge** — Deadline March 16, 2026
