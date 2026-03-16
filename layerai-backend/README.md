# Klusta Backend

Backend services for Klusta — an AI-powered video editor that solves AI video's biggest problem: **consistency**.

## Architecture

The backend consists of two services:

1. **Node.js API** (`src/`) - Main API server handling:
   - REST API endpoints for video generation, analysis, enhancement
   - WebSocket connections for real-time updates
   - Job queue management with BullMQ
   - Integration with AI services (fal.ai, Gemini, Replicate, ElevenLabs)
   - **Starting frame & character reference tag resolution** — resolves `@mentions` from frontend into image URLs for image-to-video generation
   - **Gemini intent detection** (thinking mode) — classifies starting frames vs character references vs pure text-to-video
   - SceneDNA context injection into AI prompts
   - Project-scoped chat message persistence

2. **Python FFmpeg Service** (`python/`) - Video processing server handling:
   - Video compositing and layer operations
   - 28 transition types via FFmpeg xfade
   - Proxy generation for preview
   - Text overlay rendering (fade, captions, animated, presets)
   - Final video export/render

## The Consistency Pipeline

Klusta solves consistency via a multi-layered pipeline:

1. **Starting frame tags** — User tags `@asset as the starting frame` → backend sends image as the literal first frame to fal.ai's image-to-video endpoint with model-specific parameter names (`start_image_url` for Kling, `image_url` for others)
2. **Character reference tags** — User tags `@character` → backend sends image as appearance reference with explicit prompt instructions
3. **Gemini prompt enhancement** — Raw prompts enhanced with cinematic detail + Scene DNA context, preserving starting frame/character reference instructions after enhancement
4. **Scene DNA feedback loop** — After every generation, Gemini + Google Cloud Video Intelligence analyze the video in parallel → results merge into Scene DNA → injected into next prompt

## Tech Stack

- **Node.js**: Express, TypeScript, BullMQ, WebSockets
- **Python**: FastAPI, FFmpeg, aiohttp
- **Storage**: Supabase Storage
- **Queue**: Redis + BullMQ
- **AI Services**:
  - fal.ai (Kling 3.0, Veo 3, Seedance, Wan, Hailuo, LTX, Hunyuan — 12 video models, text-to-video + image-to-video)
  - Google Gemini 2.5 Flash (Google GenAI SDK) — Intent detection, prompt enhancement, video analysis, image generation
  - Google Gemini Imagen (`gemini-2.5-flash-image`) — Reference image generation for subject-heavy prompts
  - Google Cloud Video Intelligence API — Deep video analysis (labels, objects, OCR, logos, persons, shots)
  - Replicate (Meta SAM2 `meta/sam-2-video`) — Video segmentation for element editing
  - ElevenLabs — TTS, SFX generation, and speech-to-text transcription (Scribe v1) with 35+ voice presets

## Setup

### Prerequisites

- Node.js 20+
- Python 3.11+
- FFmpeg
- Redis

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd layerai-backend
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Install Python dependencies:
```bash
cd python
pip install -r requirements.txt
cd ..
```

4. Copy environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

### Environment Variables

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

### Google Cloud Setup

1. Create a Google Cloud project
2. Enable the **Video Intelligence API**
3. Create a service account and download the JSON key
4. Place the key file in the project root and set `GOOGLE_APPLICATION_CREDENTIALS` in `.env`
5. For Railway/cloud deployment: set `GOOGLE_CREDENTIALS_JSON` to the inline JSON string instead

### Development

Run both services in development mode:

```bash
# Terminal 1 - Node.js API
npm run dev

# Terminal 2 - Python FFmpeg Service
cd python
uvicorn main:app --reload --port 8001
```

### Production Build

```bash
# Build Node.js
npm run build

# Build Docker images
docker build -t klusta-api .
docker build -t klusta-ffmpeg ./python
```

## API Endpoints

### Health
- `GET /health` - Health check
- `GET /health/ready` - Readiness check with external services

### AI Chat
- `POST /api/ai/chat` - Conversational AI with intent detection (generate video, edit text, element editing, conversation). Resolves `taggedAssets[]` as starting frames or character references. Supports `existingVideoUrl` for SAM2 element editing context

### Generation
- `POST /api/generate` - Generate video/image via fal.ai (text-to-video or image-to-video)

### Analysis
- `POST /api/analyze` - Generate Scene DNA from video

### Enhancement
- `POST /api/enhance` - Enhance prompts with full Scene DNA context (including Vision Intelligence)

### Segmentation
- `POST /api/segment` - SAM2 video segmentation via Replicate (`meta/sam-2-video`)

### Compositing
- `POST /api/composite` - FFmpeg layer compositing (supports video/image overlays with position, opacity, crop)

### Transitions
- `POST /api/transitions/apply` - Apply transitions between clips
- `GET /api/transitions/types` - List available transitions

### Audio
- `POST /api/sfx/generate` - Generate AI sound effects
- `POST /api/sfx/tts` - Text-to-speech generation
- `POST /api/sfx/transcribe` - Transcribe audio/video to text with word-level timestamps (ElevenLabs Scribe v1)
- `GET /api/sfx/voices` - List available TTS voices

### Audio Extraction
Audio can be extracted from video clips on the frontend and placed on a dedicated audio track. Extracted audio clips are persisted as part of the studio state and survive page refreshes.

### Upload
- `POST /api/upload` - Upload media file
- `POST /api/upload/url` - Import from URL
- `GET /api/upload/signed-url` - Get signed URL for direct upload

### Projects
- `POST /api/projects` - Create project
- `GET /api/projects` - List projects
- `GET /api/projects/:id` - Get project
- `PUT /api/projects/:id` - Update project
- `PUT /api/projects/:id/timeline` - Update timeline
- `PUT /api/projects/:id/scene-dna` - Update Scene DNA
- `DELETE /api/projects/:id` - Delete project

### Export
- `POST /api/export` - Queue final render job
- `GET /api/export/status/:jobId` - Check job status

### Preview
- `POST /api/preview/proxy` - Generate preview proxy
- `GET /api/preview/stream/:projectId` - Get streaming URL
- `POST /api/preview/frame` - Extract single frame

## WebSocket Events

Connect to `/ws` for real-time updates:

### Client Messages
- `subscribe` - Subscribe to a channel
- `unsubscribe` - Unsubscribe from a channel
- `ping` - Heartbeat

### Server Messages
- `connected` - Connection established
- `job:progress` - Job progress update
- `job:completed` - Job completed
- `job:failed` - Job failed
- `generation:complete` - AI generation result

## Deployment (Railway)

1. Create a new project on Railway
2. Add two services:
   - Connect GitHub repo for Node.js API
   - Connect GitHub repo `/python` folder for FFmpeg service
3. Add Redis service
4. Configure environment variables
5. Deploy

The `railway.toml` file configures the Node.js service. For Python, create a separate service pointing to the `/python` directory.

## Scene DNA

Scene DNA captures the visual identity of your video and is the core mechanism for cross-generation consistency:

```json
{
  "theme": "cinematic",
  "mood": "dramatic",
  "colorPalette": ["#1a1a2e", "#16213e", "#e94560"],
  "lighting": {
    "type": "artificial",
    "intensity": "low",
    "direction": "side"
  },
  "cameraWork": {
    "shotTypes": ["close-up", "medium"],
    "movements": ["slow dolly", "static"]
  },
  "characters": [...],
  "objects": [...],
  "visionIntelligence": {
    "sceneLabels": [...],
    "trackedObjects": [...],
    "shotBoundaries": [...],
    "onScreenText": [...],
    "logos": [...],
    "personAttributes": [...]
  }
}
```

### How It Works

1. **Initial creation** — When a user creates a project with scene context (mood, theme, lighting), an initial SceneDNA is written to the `scene_dna` table
2. **Auto-population** — When a video generation completes (`GET /api/ai/status/:id`), the backend fires two parallel tasks:
   - **Gemini 2.5 Flash** analyzes the video for theme, mood, colors, lighting, camera, characters
   - **Google Cloud Video Intelligence API** runs deep analysis: label detection, object tracking, shot boundaries, OCR text, logo recognition, person attributes
   - Both results merge into a single enriched SceneDNA
3. **Context injection** — Before every `POST /api/ai/chat` request, the backend fetches the project's SceneDNA (including Vision Intelligence data) and injects it into Gemini's system prompt
4. **Dual storage** — `services/sceneDNA.ts` reads from both the `scene_dna` table (frontend writes) and `projects.scene_dna` column (backend writes)
5. **Frontend display** — The editor shows SceneDNA in a slide-in Sheet panel

### Google Cloud Video Intelligence

The `VisionIntelligenceService` (`src/services/visionIntelligence.ts`) uses the Google Cloud Video Intelligence API with a service account to run 6 analysis features on every generated video:

| Feature | What It Detects | SceneDNA Field |
|---------|----------------|----------------|
| Label Detection | Scene-level concepts (beach, sunset, urban) | `visionIntelligence.sceneLabels` |
| Object Tracking | Objects tracked across frames with bounding boxes | `visionIntelligence.trackedObjects` |
| Shot Change Detection | Cut/transition boundaries | `visionIntelligence.shotBoundaries` |
| Text Detection (OCR) | On-screen text in video frames | `visionIntelligence.onScreenText` |
| Logo Recognition | Brand logos | `visionIntelligence.logos` |
| Person Detection | Clothing, accessories, person attributes | `visionIntelligence.personAttributes` |

Results are deduplicated, filtered by confidence (>50%), and merged into the SceneDNA alongside Gemini's analysis. This runs as a fire-and-forget background task via `Promise.allSettled()` — if Vision Intelligence fails, Gemini results still save.

**Setup:** Set `GOOGLE_APPLICATION_CREDENTIALS` in `.env` to point to a Google Cloud service account JSON key file (local dev), or `GOOGLE_CREDENTIALS_JSON` to an inline JSON string of the service account key (Railway/cloud). Requests are serialized through a queue with retry logic (15s/30s backoff) to avoid `RESOURCE_EXHAUSTED` quota errors.

### Smart Reference Image Pipeline

When a user's prompt involves specific subjects (people, characters, vehicles), the AI chat flow automatically generates a reference image before video creation:

1. **Detection** — Gemini flags `needsReferenceImage: true` in its intent analysis. A regex safety net also catches common keywords that Gemini might miss
2. **Gemini Imagen generation** — `GeminiService.generateImage()` calls `gemini-2.5-flash-image` with `responseModalities: ["IMAGE", "TEXT"]`. The enhanced prompt includes full SceneDNA context
3. **Upload to Supabase** — The base64 image buffer is uploaded to `media/{projectId}/ref-*.png`
4. **Image-to-Video** — `FalService.submitImageToVideo()` routes to model-specific i2v endpoints. All 12 supported video models have corresponding i2v endpoint mappings
5. **Frontend display** — The reference image URL is returned in the chat response as `referenceImageUrl`

### SAM2 Element Editing

SAM2 enables targeted editing of specific elements within existing videos — the AI identifies the correct clip from natural language:

1. **Timeline-aware clip resolution** — Frontend sends all timeline clips in the chat request. Gemini picks the right clip
2. **Intent detection** — Gemini classifies intent as `edit_element` with `elementEditParams: { target, modification, targetClipIndex }`
3. **Video segmentation** — `ReplicateService.segmentVideo()` calls `meta/sam-2-video` on Replicate
4. **Modified element generation** — `GeminiService.generateImage()` creates the modified element reference image
5. **FFmpeg recomposite** — `POST /composite/mask/apply` with `fillType: "replace"` composites the modified element back
6. **Auto-add to timeline** — Result returned in chat response and added to timeline + Asset Library

### Chat Scoping

AI chat messages are scoped to projects via the `project_id` column in `ai_chat_messages`. When the frontend switches projects, it reloads only that project's conversation history.

## Key Files

| File | Purpose |
|------|---------|
| `src/routes/ai.ts` | Main AI chat endpoint — intent detection, starting frame/character reference logic, video generation dispatch |
| `src/services/gemini.ts` | Gemini 2.5 Flash — thinking, enhance, analyze, image gen, safety settings |
| `src/services/fal.ts` | fal.ai client — 12 video models, model-specific i2v parameter handling |
| `src/services/visionIntelligence.ts` | Google Cloud Video Intelligence — 6 analysis features |
| `src/services/sceneDNA.ts` | Scene DNA read/write from dual storage |
| `src/services/replicate.ts` | Meta SAM2 video segmentation |
| `src/routes/projects.ts` | Project CRUD + timeline/scene-dna updates |
| `src/routes/sfx.ts` | ElevenLabs TTS/SFX/transcription |
| `python/services/ffmpeg_service.py` | Core FFmpeg engine (1500+ lines) |
| `python/routers/export.py` | Final render, concat, audio mix, preview |
| `python/routers/composite.py` | Layer composition, mask apply, color grade, crop, speed |
| `python/routers/transitions.py` | 28 transition types via FFmpeg xfade |

## License

MIT
