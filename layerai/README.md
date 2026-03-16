<p align="center">
  <img src="public/layerai-logo.svg" alt="Klusta" width="64" height="64" />
</p>

<h1 align="center">Klusta</h1>

<p align="center">
  <strong>The Figma of AI Video</strong> — a context-intelligent, asset-aware video editor<br/>
  that solves AI video's biggest problem: <em>consistency</em>.
</p>

<p align="center">
  <a href="#the-problem">The Problem</a> &bull;
  <a href="#how-klusta-solves-it">Our Solution</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#getting-started">Getting Started</a> &bull;
  <a href="#tech-stack">Tech Stack</a>
</p>

---

## The Problem

Every AI video tool has the same problem: you prompt, a model generates a video, you want to change one thing — a shirt color, a camera angle — and the model regenerates **everything**. The character looks different. The lighting shifted. The mood changed. **Twenty generations for one good clip.**

> This is the #1 frustration across every AI video community. Creators spend 20–30 generations trying to get a single consistent clip because there is no way to anchor the visual identity of a scene.

---

## How Klusta Solves It

Klusta attacks the consistency problem from **three angles**:

### 1. Starting Frame & Character Reference Tags

Users tag assets from their library using `@mentions` in the AI chat:

- **Starting Frame** — `"using @my_screenshot as the starting frame, animate two men crying"` — the tagged image becomes the literal first frame; the video model animates FROM that exact image
- **Character Reference** — `"@Marcus walking through a park at sunset"` — the tagged character image is sent as appearance reference only, generating a new scene with consistent character appearance

Detection uses Gemini intent analysis + regex safety net + fallback catch — three layers so tagged assets are never silently dropped.

### 2. Gemini Prompt Enhancement with Scene DNA

Raw user prompts are enhanced by Gemini 2.5 Flash into production-ready descriptions — without destroying user intent. When the user has provided a starting frame or character reference, those instructions are preserved after enhancement. Every enhancement is injected with **Scene DNA** — the project's accumulated visual profile — so new generations match existing footage.

### 3. Google Cloud Video Intelligence — Deep Analysis

After every video generation, Google Cloud Video Intelligence API runs **6 parallel analysis features** (label detection, object tracking, shot boundaries, OCR, logo recognition, person detection). Results merge into Scene DNA alongside Gemini's analysis, creating a feedback loop: **Generate → Analyze → Store Scene DNA → Inject into next prompt → Generate with full context**.

---

## Features

### AI Assistant (Gemini 2.5 Flash)
- **Conversational generation** — Gemini asks clarifying questions before generating
- **Starting frame tagging** — `@asset as the starting frame` sends the image as the literal first frame to the video model
- **Character reference tagging** — `@character` sends the image as appearance reference with explicit instructions
- **Smart reference image detection** — automatically detects human/character subjects and generates a reference image via Gemini Imagen when no user image is provided
- **Text overlay editing via natural language** — "Change the subtitle to say Hello World"
- **Image-to-Video pipeline** — model-specific i2v endpoints (Kling uses `start_image_url`, others use `image_url`)
- **SAM2 element editing** — Meta SAM2 (`meta/sam-2-video` on Replicate) segments target elements from video for targeted edits
- **Multi-shot mode** — consistent characters, voices, and lighting across shots
- **Scene DNA** — automatic visual style analysis enriched by Google Cloud Video Intelligence API (labels, objects, OCR, logos, person attributes, shot boundaries). Injected into every AI prompt
- **Project-scoped chat** — conversations tied to projects; switching projects loads different history
- **Sound effects & TTS** — ElevenLabs-powered audio generation with 35+ voice presets
- **Transcription** — ElevenLabs Scribe v1 speech-to-text with word-level timestamps auto-placed as captions

### Timeline Editor
- Multi-track timeline with drag-and-drop clips (powered by `@xzdarcy/react-timeline-editor`)
- Per-clip editing: volume, speed, crop, mirror, rotation
- **Audio extraction** — extract audio from video clips and place on a dedicated audio track
- **Move clips between tracks** — use toolbar up/down buttons
- **Video/image overlay layers** — drag-and-drop overlays with position, size, opacity, rotation, crop controls
- **Text overlays with Google Fonts** — 28+ curated fonts, weight selector, color picker, 5 animation types (fade, typewriter, slide, bounce, scale), drag-and-resize via react-moveable
- 28 transition types via FFmpeg xfade (fades, wipes, slides, cover/reveal, cinematic)
- **Free-form crop tool** — drag edges and corners directly; aspect ratio presets optional
- Keyboard shortcuts (Space=play, Delete=remove, D=duplicate, arrow keys=scrub)
- Undo/redo (Ctrl+Z / Ctrl+Shift+Z)
- Resizable timeline and AI panel via drag handles

### Real-Time Preview
- Remotion-based video preview with frame-accurate playback
- Multi-clip composition with transitions rendered in-browser
- Text overlay rendering with live drag positioning
- Video/image overlay rendering — draggable, resizable layers
- Low-res proxy generation for smooth preview of large files
- Caption track — transcription captions on a dedicated timeline row

### Asset Library
- Upload images, videos, audio
- AI-generated content auto-saved to library
- Character creation with reference sheets
- Delete on hover — visible delete button for media items

### Export Pipeline
- Configurable export (MP4, quality: draft/preview/HD/4K, frame rate)
- Server-side rendering via FFmpeg with xfade transitions
- Audio track mixing (ElevenLabs audio + video audio combined)
- Progress tracking via WebSocket
- Direct upload to Supabase Storage

### Project Hub
- Create, list, delete projects with thumbnails and timestamps
- Scene context presets on creation (mood, theme, lighting direction/intensity)
- Initial SceneDNA auto-generated from scene context settings

### Auth & Persistence
- Supabase Auth (email/password, forgot password, OTP verify)
- Row Level Security — users only see their own data
- Full studio state persisted per project (clips, text overlays, transitions, video overlays, per-clip edits, extracted audio)
- Middleware-protected routes with automatic redirect

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (Next.js 16)                   │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Remotion    │  │   Timeline   │  │   AI Chat    │  │
│  │   Preview     │  │   Editor     │  │   Panel      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐  │
│  │ Asset Library │  │Export Dialog │  │ @Mention Tag │  │
│  │ + Characters  │  │             │  │   System     │  │
│  └──────────────┘  └─────────────┘  └──────────────┘  │
└────────┬──────────────────┬──────────────────┬─────────┘
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
     │  FFmpeg    │  │  2.5 Flash│  │ Kling 3.0│
     │  Service   │  │  (GenAI   │  │ (i2v +   │
     │  (FastAPI) │  │   SDK)    │  │  t2v)    │
     └────────────┘  └─────┬─────┘  └──────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌────────────┐ ┌───────────┐ ┌──────────┐
     │  GCP Video │ │ ElevenLabs│ │ Replicate│
     │Intelligence│ │ (TTS/SFX) │ │  (SAM2)  │
     │    API     │ │           │ │          │
     └────────────┘ └───────────┘ └──────────┘
```

**Data flow:**
1. User types in AI chat, optionally tagging assets with `@mentions` (starting frames or character references)
2. Frontend resolves @mentions to asset URLs, sends `taggedAssets[]` + message to backend
3. Gemini 2.5 Flash (thinking mode) analyzes intent — determines starting frames vs character references
4. Backend safety net parses raw message with regex to catch what Gemini might miss
5. For starting frames: image URL sent to fal.ai's image-to-video endpoint with model-specific parameter names
6. After generation: Gemini + Google Cloud Video Intelligence analyze the result in parallel → Scene DNA updated
7. Scene DNA injected into every subsequent AI interaction for consistency

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Supabase project (for auth, database, and storage)
- API keys: Google AI (Gemini), fal.ai, ElevenLabs (optional)

### 1. Clone & Install

```bash
git clone <repo-url>
cd layerai
pnpm install
```

### 2. Environment Variables

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 3. Database Setup

Run the SQL schema in your Supabase SQL Editor:

```bash
# The schema file creates:
# - profiles, projects, studio_state, transcriptions, ai_chat_messages, user_media, scene_dna tables
# - RLS policies for all tables
# - Storage policies for user-scoped media
# - Auto-create profile trigger
cat supabase-schema.sql
```

### 4. Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login` if not authenticated.

---

## Scene DNA + Vision Intelligence

Every generated video is automatically analyzed in parallel by:
1. **Gemini 2.5 Flash** — extracts theme, mood, color palette, lighting, camera work, characters
2. **Google Cloud Video Intelligence API** — deep analysis:
   - **Label Detection** — scene-level labels with confidence scores
   - **Object Tracking** — objects tracked across frames with bounding boxes
   - **Shot Change Detection** — precise cut/transition boundaries
   - **Text Detection (OCR)** — on-screen text extracted from video frames
   - **Logo Recognition** — brand/logo detection
   - **Person Detection** — clothing, accessories, and other person attributes

Both analyses merge into a single SceneDNA profile that is injected into every AI prompt, ensuring visual and tonal consistency across all generated content.

---

## Project Structure

```
layerai/
├── app/
│   ├── (auth)/              # Auth pages (login, signup, forgot-password)
│   │   └── layout.tsx       # Shared auth layout with branding panel
│   ├── auth/callback/       # OAuth/email verification callback
│   ├── projects/page.tsx    # Project hub -- create, list, delete projects
│   ├── studio/page.tsx      # Main editor -- state management hub
│   └── layout.tsx           # Root layout
├── components/
│   ├── editor/
│   │   ├── AIPanel.tsx      # AI chat with @mention tagging, generation, text editing
│   │   ├── AssetLibrary.tsx # Media/text/effects/transitions browser
│   │   ├── Timeline.tsx     # Multi-track timeline editor
│   │   ├── VideoPreview.tsx # Remotion-based preview player
│   │   ├── MultiClipComposition.tsx  # Multi-clip + transitions
│   │   ├── ExportDialog.tsx # Export configuration & progress
│   │   ├── CropDialog.tsx  # Free-form crop with edge/corner handles
│   │   ├── OverlayDialog.tsx # Video/image overlay layer management
│   │   ├── EditorSidebar.tsx # Per-clip editing tools
│   │   └── TextOverlayDialog.tsx     # Text overlay properties
│   ├── layout/
│   │   └── EditorHeader.tsx # Top bar with user avatar & actions
│   └── ui/                  # shadcn/ui primitives
├── hooks/
│   ├── useAuth.ts           # Auth state + sign out
│   ├── usePlaybackEngine.ts # Ref-based playback clock
│   └── useProxyGeneration.ts # Low-res proxy generation
├── lib/
│   ├── api.ts               # Backend API client
│   ├── supabase.ts          # Storage, chat, state, project helpers
│   └── supabase/
│       ├── client.ts        # Browser Supabase client
│       ├── server.ts        # Server Supabase client (cookies)
│       └── middleware.ts    # Auth middleware (route protection)
├── types/
│   └── editor.ts            # TextOverlay, Transition, ClipEdits, VideoOverlay types
├── middleware.ts             # Next.js middleware entry point
└── supabase-schema.sql      # Full database schema + RLS policies
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Video Preview | Remotion |
| Timeline | @xzdarcy/react-timeline-editor |
| UI Components | shadcn/ui + Radix |
| Icons | Lucide React |
| Auth & DB | Supabase (Auth, Postgres, Storage, RLS) |
| AI Brain | Google Gemini 2.5 Flash (Google GenAI SDK) |
| Image Generation | Google Gemini Imagen for reference images |
| Video Analysis | Google Cloud Video Intelligence API (6 features) |
| Video Segmentation | Meta SAM2 via Replicate (`meta/sam-2-video`) |
| Video Gen | fal.ai — Kling 3.0, Veo 3, Seedance, Wan, Hailuo, LTX, Hunyuan (12 models, t2v + i2v) |
| Audio Gen | ElevenLabs (TTS + SFX + Scribe v1 transcription) |
| Media Processing | FFmpeg (Python/FastAPI) — 28 transitions, compositing, text rendering |
| Backend API | Express + WebSocket |
| Cloud | Google Cloud (Video Intelligence API) |
| Deployment | Vercel (frontend) + Railway (backends) |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/chat` | POST | Conversational AI — generation, editing, element editing (SAM2), or conversation |
| `/api/ai/status/:id` | GET | Poll generation job status |
| `/api/segment` | POST | SAM2 video segmentation via Replicate |
| `/api/generate` | POST | Direct video/image generation |
| `/api/text/overlay` | POST | Add text overlay to video |
| `/api/text/preset` | POST | Add text with preset styling |
| `/api/sfx/generate` | POST | Generate sound effect |
| `/api/sfx/tts` | POST | Text-to-speech |
| `/api/sfx/transcribe` | POST | Transcribe audio/video with word-level timestamps |
| `/api/export` | POST | Start video export |
| `/api/export/status/:id` | GET | Export progress |

---

## Database Schema

**Tables:** `profiles`, `projects`, `studio_state`, `transcriptions`, `ai_chat_messages`, `user_media`, `scene_dna`

- `projects` — Name, description, thumbnail, inline `scene_dna` JSON column
- `scene_dna` — Dedicated SceneDNA table (frontend writes here)
- `ai_chat_messages` — Chat history scoped by `user_id` + `project_id`
- `user_media` — Tracks uploaded/generated media per user with source tagging
- `transcriptions` — Per-clip speech-to-text results with word-level captions
- `studio_state` — Persisted timeline state (clips, text overlays, transitions, video overlays, clip edits) per project

All tables enforce Row Level Security — users can only access their own data.

---

## Contributing

This project is built for the **Gemini Live Agent Challenge** (deadline March 16, 2026).

---

<p align="center">
  Built with Gemini 2.5 Flash, Google Cloud Video Intelligence, and a lot of FFmpeg flags.<br/>
  <strong>Klusta</strong> — consistent AI video. Finally.
</p>
