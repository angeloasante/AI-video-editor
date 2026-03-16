<p align="center">
  <img src="layerai/public/logo-with-name.png" alt="Kluxta" width="280" />
</p>

<h1 align="center">Kluxta — The Figma of AI Video</h1>

<p align="center">
  <strong>Category:</strong> Creative Storyteller<br/>
  A context-intelligent, asset-aware video editor that solves AI video's biggest problem: <strong>consistency</strong>.<br/>
  Built with Gemini 2.5 Flash, Google Cloud Video Intelligence, Google GenAI SDK, fal.ai, and FFmpeg.
</p>

<p align="center">
  <a href="https://kluxta.com">Landing Page</a> &bull;
  <a href="https://studio.kluxta.com">Studio App</a> &bull;
  <a href="SUBMISSION.md">Full Submission Details</a> &bull;
  <a href="https://kluxta.com/architecture">Architecture (Visual)</a>
</p>

---

## The Problem

Every AI video tool has the same problem: you prompt, a model generates a video, you want to change one thing, and the model regenerates **everything**. The character looks different. The lighting shifted. The mood changed. **Twenty generations for one good clip.**

This is the #1 frustration across every AI video community. Creators spend 20-30 generations trying to get a single consistent clip because there is no way to anchor the visual identity of a scene.

## How Kluxta Solves It

Kluxta attacks consistency from **three angles**:

1. **Starting Frame & Character Reference Tags** — Tag assets with `@mentions` in the AI chat. Starting frames become the literal first frame of the video. Character references maintain appearance across shots. Three detection layers (Gemini intent analysis + regex safety net + fallback catch) ensure tags are never silently dropped.

2. **Gemini Prompt Enhancement with Scene DNA** — Raw prompts are enhanced by Gemini 2.5 Flash with cinematic detail + Scene DNA context, without destroying user intent. Starting frame and character reference instructions are preserved after enhancement.

3. **Google Cloud Video Intelligence** — After every generation, 6 parallel analysis features (labels, objects, shots, OCR, logos, person detection) feed back into Scene DNA. The consistency loop: Generate → Analyze → Store → Inject → Generate.

---

## Features & Functionality

- **AI Chat with @Mention Tags** — Conversational video generation with starting frame and character reference tagging
- **12 Video Models** — Kling 3.0, Veo 3, Seedance, Wan, Hailuo, LTX, Hunyuan via fal.ai (text-to-video + image-to-video)
- **Scene DNA** — Persistent visual identity profile (theme, mood, colors, lighting, characters, objects) injected into every prompt
- **Google Cloud Video Intelligence** — 6 analysis features per video feeding back into Scene DNA
- **Multi-Track Timeline** — Drag-and-drop clips, 28 FFmpeg xfade transitions, text overlays with Google Fonts, video/image overlay layers
- **Audio Generation** — ElevenLabs TTS (35+ voices), SFX, and Scribe v1 transcription with auto-captions
- **Remotion Preview** — Frame-accurate in-browser preview with multi-clip composition
- **Export Pipeline** — Server-side FFmpeg rendering with transitions + audio mixing + progress via WebSocket
- **Smart Reference Images** — Gemini Imagen auto-generates photorealistic reference images for subject-heavy prompts
- **Natural Language Editing** — "Change the subtitle to say Hello World" → text overlay updated instantly

---

## Google Cloud & Gemini Integration

### Gemini Model Usage — Gemini 2.5 Flash (Google GenAI SDK)

| Usage | How |
|-------|-----|
| **Intent Detection** | Every user message analyzed with thinking mode — determines intent, detects starting frame vs character reference, identifies @tagged assets |
| **Prompt Enhancement** | User prompts enhanced with cinematic details + full Scene DNA context. Preserves starting frame / character reference instructions |
| **Reference Image Generation** | Gemini Imagen generates photorealistic reference images for subject-heavy prompts |
| **Video Analysis** | Generated videos analyzed by Gemini to extract Scene DNA (theme, mood, colors, lighting, characters, camera) |
| **Conversational AI** | Multi-turn dialogue with clarifying questions before generating |
| **Safety Settings** | `BLOCK_NONE` on all harm categories for creative/cinematic content |

**SDK:** `@google/generative-ai` (Google GenAI SDK) — `gemini-2.5-flash` model with thinking mode, native video understanding, image generation via `responseModalities: ["IMAGE", "TEXT"]`

### Google Cloud Service — Video Intelligence API

When a video is generated, the API runs **6 parallel analysis features** via a service account:

| Feature | What It Detects |
|---------|----------------|
| **Label Detection** | Scene concepts (beach, sunset, urban, indoor) |
| **Object Tracking** | Objects across frames with bounding boxes |
| **Shot Change Detection** | Cut/transition boundaries |
| **Text Detection (OCR)** | On-screen text in video |
| **Logo Recognition** | Brand logos in footage |
| **Person Detection** | Clothing, accessories, physical attributes |

**File:** [`layerai-backend/src/services/gemini.ts`](layerai-backend/src/services/gemini.ts) — All Gemini interactions via Google GenAI SDK
**File:** [`layerai-backend/src/routes/ai.ts`](layerai-backend/src/routes/ai.ts) — Intent detection, prompt enhancement, video analysis, Vision Intelligence API calls

---

## Architecture Diagram

> **Interactive visual version:** [kluxta.com/architecture](https://kluxta.com/architecture)
> **SVG source:** [`kluxta-landing/public/architecture.svg`](kluxta-landing/public/architecture.svg)

```
┌──────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                      │
│  Remotion Preview │ Timeline Editor │ AI Chat + @Mention Tags │
│  Asset Library    │ Export Dialog   │ Scene DNA Panel          │
└────────┬──────────────────┬──────────────────┬───────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
   ┌──────────┐      ┌──────────────┐   ┌──────────┐
   │ Supabase │      │  Node.js API │   │WebSocket │
   │Auth + DB │      │  (Express)   │   │(Real-time│
   │+ Storage │      └──────┬───────┘   │ updates) │
   └──────────┘             │           └──────────┘
                  ┌─────────┼──────────┐
                  ▼         ▼          ▼
          ┌────────────┐ ┌──────────────────────────┐
          │   Python   │ │  Gemini 2.5 Flash (GenAI)│
          │  FFmpeg    │ │      — AI Brain —        │
          │  (FastAPI) │ └────────────┬─────────────┘
          └────────────┘              │
                      ┌───────┬──────┼───────┐
                      ▼       ▼      ▼       ▼
               ┌────────┐┌──────┐┌──────┐┌──────────┐
               │GCP Vid.││fal.ai││Repli-││ElevenLabs│
               │Intelli-││Kling ││cate  ││(TTS/SFX/ │
               │gence   ││3.0   ││(SAM2)││ Scribe)  │
               └────────┘└──────┘└──────┘└──────────┘

        ┌────────────────────────────────────────┐
        │       Nano Banana Pro (fal.ai)         │
        │  Reference Image Generation (direct)   │
        └────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Remotion, shadcn/ui |
| AI Brain | Google Gemini 2.5 Flash (Google GenAI SDK — `@google/generative-ai`) |
| Image Gen | Google Gemini Imagen for reference images |
| Video Analysis | Google Cloud Video Intelligence API (6 features, service account) |
| Video Gen | fal.ai — 12 models (t2v + i2v), including Kling 3.0, Veo 3, Seedance |
| Video Segmentation | Meta SAM2 via Replicate |
| Audio | ElevenLabs (TTS + SFX + Scribe v1 transcription) |
| Media Processing | FFmpeg (Python/FastAPI) — 28 transition types, compositing, text rendering |
| Backend API | Express + WebSocket |
| Auth & DB | Supabase (Auth, Postgres, Storage, RLS) |
| Deployment | Vercel (frontends) + Railway (backends) + Google Cloud Run (Docker) |

---

## Repository Structure

```
├── layerai/                    # Frontend — Next.js 16 + Remotion + Tailwind
├── layerai-backend/            # Backend  — Node.js (Express) + Python (FastAPI/FFmpeg)
│   ├── src/                    #   Node.js API source
│   │   ├── services/gemini.ts  #   ★ All Gemini interactions (GenAI SDK)
│   │   ├── services/fal.ts     #   ★ fal.ai video generation (12 models)
│   │   └── routes/ai.ts        #   ★ AI chat endpoint + Vision Intelligence
│   └── python/                 #   Python FFmpeg service
├── kluxta-landing/             # Landing page — Next.js (kluxta.com)
├── Dockerfile                  # ★ Combined Docker for Google Cloud Run deployment
├── SUBMISSION.md               # Full submission details
├── LICENSE                     # MIT License
└── idea.md                     # Original project concept
```

---

## Setup & Deployment Instructions

### Prerequisites

- Node.js 20+, Python 3.11+, FFmpeg
- Supabase project (auth, database, storage)
- Google Cloud project with **Video Intelligence API** enabled
- API keys: Google Gemini, fal.ai, ElevenLabs

### 1. Clone & Install

```bash
git clone https://github.com/angeloasante/AI-video-editor.git
cd AI-video-editor

# Frontend
cd layerai && pnpm install

# Backend
cd ../layerai-backend && npm install

# Python FFmpeg service
cd python && pip install -r requirements.txt

# Landing page
cd ../../kluxta-landing && npm install
```

### 2. Environment Variables

**Frontend** (`layerai/.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

**Backend** (`layerai-backend/.env`):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GOOGLE_GEMINI_API_KEY=your-gemini-api-key
GOOGLE_APPLICATION_CREDENTIALS=./your-service-account-key.json
FAL_KEY=your-fal-api-key
ELEVENLABS_API_KEY=your-elevenlabs-key
PYTHON_API_URL=http://localhost:8001
PORT=3001
```

### 3. Google Cloud Setup

1. Create a Google Cloud project
2. Enable the **Video Intelligence API**
3. Create a service account and download the JSON key
4. Place the key file in `layerai-backend/` and set `GOOGLE_APPLICATION_CREDENTIALS` in `.env`

### 4. Run Locally

```bash
# Terminal 1 — Frontend (port 3000)
cd layerai && pnpm dev

# Terminal 2 — Node.js API (port 3001)
cd layerai-backend && npm run dev

# Terminal 3 — Python FFmpeg (port 8001)
cd layerai-backend/python && uvicorn main:app --reload --port 8001
```

### 5. Deploy to Google Cloud Run (Docker)

A unified `Dockerfile` at the repo root runs both Node.js API + Python FFmpeg in a single container:

```bash
# Build
docker build -t gcr.io/YOUR_PROJECT/kluxta-backend .

# Push
docker push gcr.io/YOUR_PROJECT/kluxta-backend

# Deploy
gcloud run deploy kluxta-backend \
  --image gcr.io/YOUR_PROJECT/kluxta-backend \
  --region us-central1 \
  --port 3001 \
  --memory 2Gi \
  --cpu 2 \
  --set-env-vars "PYTHON_API_URL=http://localhost:8001" \
  --allow-unauthenticated
```

---

## What We Learned

1. **Consistency is a pipeline problem, not a model problem** — No single model can guarantee consistency. The solution is a system: reference images + starting frames + Scene DNA + prompt injection + Vision Intelligence feedback.

2. **Video models ignore images unless you speak their language** — Kling uses `start_image_url`, others use `image_url`. We built model-specific parameter mapping.

3. **Prompt enhancement can destroy user intent** — Gemini's enhancement would rewrite starting frame instructions. We now re-prepend critical instructions AFTER enhancement.

4. **Google Cloud Video Intelligence fills gaps Gemini can't** — Gemini handles high-level understanding (mood, theme), but Video Intelligence catches precise details (exact clothing labels, object bounding boxes, OCR text).

---

## License

[MIT](LICENSE) — Travis Moore (Angelo Asante)

---

<p align="center">
  Built with Gemini 2.5 Flash, Google Cloud Video Intelligence, Google GenAI SDK, and a lot of FFmpeg flags.<br/>
  <strong>Kluxta</strong> — consistent AI video. Finally.
</p>
