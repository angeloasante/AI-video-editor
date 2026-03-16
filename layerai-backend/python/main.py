from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

from routers import composite, transitions, proxy, export, text

app = FastAPI(
    title="LayerAI FFmpeg Service",
    description="Python service for FFmpeg operations and video processing",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(composite.router, prefix="/composite", tags=["Composite"])
app.include_router(transitions.router, prefix="/transitions", tags=["Transitions"])
app.include_router(proxy.router, prefix="/proxy", tags=["Proxy"])
app.include_router(export.router, prefix="/render", tags=["Export"])
app.include_router(text.router, prefix="/text", tags=["Text"])

# Additional endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    import subprocess
    import os
    
    # Check FFmpeg
    try:
        result = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, timeout=5)
        ffmpeg_ok = result.returncode == 0
        ffmpeg_version = result.stdout.split('\n')[0] if ffmpeg_ok else "not found"
    except Exception as e:
        ffmpeg_ok = False
        ffmpeg_version = str(e)
    
    # Check Supabase config
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    return {
        "status": "healthy" if ffmpeg_ok else "degraded",
        "service": "ffmpeg",
        "ffmpeg": {
            "installed": ffmpeg_ok,
            "version": ffmpeg_version
        },
        "supabase": {
            "url_configured": bool(supabase_url),
            "key_configured": bool(supabase_key),
            "url_preview": supabase_url[:30] + "..." if supabase_url else "not set"
        }
    }

@app.get("/extract/frame")
async def extract_frame_get():
    """Redirect to POST endpoint"""
    return {"error": "Use POST method"}

@app.post("/extract/frame")
async def extract_frame(request: dict):
    """Extract a single frame from video"""
    from services.ffmpeg_service import FFmpegService
    
    ffmpeg = FFmpegService()
    result = await ffmpeg.extract_frame(
        video_url=request["videoUrl"],
        timestamp=request.get("timestamp", 0),
        width=request.get("width", 640),
    )
    return result

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("NODE_ENV") != "production",
    )
