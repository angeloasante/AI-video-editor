<p align="center">
  <img src="layerai/public/logo-with-name.png" alt="Kluxta" width="280" />
</p>

<h1 align="center">Kluxta — The Figma of AI Video</h1>

<p align="center">
  A context-intelligent, asset-aware video editor that solves AI video's biggest problem: <strong>consistency</strong>.<br/>
  Built with Gemini 2.5 Flash, Google Cloud Video Intelligence, fal.ai, and FFmpeg.
</p>

<p align="center">
  <a href="https://kluxta.com">Landing Page</a> &bull;
  <a href="https://studio.kluxta.com">Studio App</a> &bull;
  <a href="SUBMISSION.md">Submission Details</a>
</p>

---

## The Problem

Every AI video tool has the same problem: you prompt, a model generates a video, you want to change one thing, and the model regenerates **everything**. The character looks different. The lighting shifted. The mood changed. **Twenty generations for one good clip.**

## How Kluxta Solves It

Kluxta attacks consistency from **three angles**:

1. **Starting Frame & Character Reference Tags** — Tag assets with `@mentions` in the AI chat. Starting frames become the literal first frame of the video. Character references maintain appearance across shots. Three detection layers (Gemini intent analysis + regex safety net + fallback catch) ensure tags are never silently dropped.

2. **Gemini Prompt Enhancement with Scene DNA** — Raw prompts are enhanced by Gemini 2.5 Flash with cinematic detail + Scene DNA context, without destroying user intent. Starting frame and character reference instructions are preserved after enhancement.

3. **Google Cloud Video Intelligence** — After every generation, 6 parallel analysis features (labels, objects, shots, OCR, logos, person detection) feed back into Scene DNA. The consistency loop: Generate → Analyze → Store → Inject → Generate.

---

## Repository Structure

```
├── layerai/                # Frontend — Next.js 16 + Remotion + Tailwind
├── layerai-backend/        # Backend  — Node.js (Express) + Python (FastAPI/FFmpeg)
├── kluxta-landing/         # Landing page — Next.js (kluxta.com)
├── SUBMISSION.md           # Gemini Live Agent Challenge submission
├── LICENSE                 # MIT License
└── idea.md                 # Original project concept
```

| Directory | What It Does | Runs On |
|-----------|-------------|---------|
| `layerai/` | Studio editor — timeline, AI chat panel, Remotion preview, asset library, export | `studio.kluxta.com` (Vercel) |
| `layerai-backend/src/` | Node.js API — Gemini intent detection, fal.ai video gen, Scene DNA, WebSocket | Railway |
| `layerai-backend/python/` | Python FFmpeg service — compositing, transitions, text rendering, export | Railway |
| `kluxta-landing/` | Marketing landing page | `kluxta.com` (Vercel) |

---

## Key Features

- **AI Chat with @Mention Tags** — Conversational video generation with starting frame and character reference tagging
- **12 Video Models** — Kling 3.0, Veo 3, Seedance, Wan, Hailuo, LTX, Hunyuan via fal.ai (text-to-video + image-to-video)
- **Scene DNA** — Persistent visual identity profile (theme, mood, colors, lighting, characters, objects) injected into every prompt
- **Google Cloud Video Intelligence** — 6 analysis features per video feeding back into Scene DNA
- **Multi-Track Timeline** — Drag-and-drop clips, 28 FFmpeg xfade transitions, text overlays with Google Fonts, video/image overlay layers
- **Audio Generation** — ElevenLabs TTS (35+ voices), SFX, and Scribe v1 transcription with auto-captions
- **Remotion Preview** — Frame-accurate in-browser preview with multi-clip composition
- **Export Pipeline** — Server-side FFmpeg rendering with transitions + audio mixing + progress via WebSocket

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Remotion, shadcn/ui |
| AI Brain | Google Gemini 2.5 Flash (Google GenAI SDK) |
| Image Gen | Google Gemini Imagen for reference images |
| Video Analysis | Google Cloud Video Intelligence API (6 features) |
| Video Gen | fal.ai — 12 models (t2v + i2v) |
| Video Segmentation | Meta SAM2 via Replicate |
| Audio | ElevenLabs (TTS + SFX + Scribe v1) |
| Media Processing | FFmpeg (Python/FastAPI) |
| Backend API | Express + WebSocket + BullMQ |
| Auth & DB | Supabase (Auth, Postgres, Storage, RLS) |
| Deployment | Vercel (frontends) + Railway (backends) |

---

## Quick Start

### Prerequisites

- Node.js 20+, Python 3.11+, FFmpeg, Redis
- Supabase project, Google Cloud project (Video Intelligence API enabled)
- API keys: Gemini, fal.ai, ElevenLabs

### 1. Install

```bash
# Frontend
cd layerai && pnpm install

# Backend
cd ../layerai-backend && npm install

# Python service
cd python && pip install -r requirements.txt

# Landing page
cd ../../kluxta-landing && npm install
```

### 2. Environment Variables

See [layerai/README.md](layerai/README.md) for frontend env vars, [layerai-backend/README.md](layerai-backend/README.md) for backend env vars.

### 3. Run

```bash
# Terminal 1 — Frontend (port 3000)
cd layerai && pnpm dev

# Terminal 2 — Node.js API (port 3001)
cd layerai-backend && npm run dev

# Terminal 3 — Python FFmpeg (port 8001)
cd layerai-backend/python && uvicorn main:app --reload --port 8001

# Terminal 4 — Landing page (port 3002)
cd kluxta-landing && npm run dev
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (Next.js 16)                   │
│  Remotion Preview │ Timeline Editor │ AI Chat + @Tags    │
│  Asset Library    │ Export Dialog   │ Scene DNA Panel     │
└────────┬──────────────────┬──────────────────┬──────────┘
         │                  │                  │
         ▼                  ▼                  ▼
   ┌──────────┐      ┌──────────────┐   ┌──────────┐
   │ Supabase │      │  Node.js API │   │WebSocket │
   │Auth + DB │      │  (Express)   │   │(Real-time│
   │+ Storage │      └──────┬───────┘   │ updates) │
   └──────────┘             │           └──────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
     ┌────────────┐  ┌───────────┐  ┌──────────┐
     │   Python   │  │  Gemini   │  │ fal.ai   │
     │  FFmpeg    │  │  2.5 Flash│  │(12 video │
     │  (FastAPI) │  │  (GenAI)  │  │ models)  │
     └────────────┘  └─────┬─────┘  └──────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌────────────┐ ┌───────────┐ ┌──────────┐
     │  GCP Video │ │ ElevenLabs│ │ Replicate│
     │Intelligence│ │(TTS/SFX)  │ │  (SAM2)  │
     └────────────┘ └───────────┘ └──────────┘
```

---

## License

[MIT](LICENSE) — Travis Moore (Angelo Asante)

---

<p align="center">
  Built with Gemini 2.5 Flash, Google Cloud Video Intelligence, and a lot of FFmpeg flags.<br/>
  <strong>Kluxta</strong> — consistent AI video. Finally.
</p>
