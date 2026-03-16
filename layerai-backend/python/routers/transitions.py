from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.ffmpeg_service import FFmpegService

router = APIRouter()
ffmpeg = FFmpegService()

class TransitionRequest(BaseModel):
    clipAUrl: str
    clipBUrl: str
    transitionType: str = "crossfade"
    duration: float = 0.5

class TransitionResponse(BaseModel):
    success: bool
    url: str
    duration: Optional[float] = None

@router.post("/apply", response_model=TransitionResponse)
async def apply_transition(request: TransitionRequest):
    """
    Apply a transition between two clips
    Supported types: crossfade, dissolve, wipe-left, wipe-right, whip, zoom, cut
    """
    try:
        result = await ffmpeg.apply_transition(
            clip_a=request.clipAUrl,
            clip_b=request.clipBUrl,
            transition_type=request.transitionType,
            duration=request.duration,
        )
        return TransitionResponse(
            success=True,
            url=result["url"],
            duration=result.get("duration"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TransitionPreviewRequest(BaseModel):
    clipAFrame: str
    clipBFrame: str
    transitionType: str
    progress: float = 0.5

class TransitionPreviewResponse(BaseModel):
    success: bool
    frameUrl: str

@router.post("/preview", response_model=TransitionPreviewResponse)
async def preview_transition(request: TransitionPreviewRequest):
    """
    Generate a single frame preview of a transition at a given progress point
    """
    try:
        result = await ffmpeg.preview_transition(
            frame_a=request.clipAFrame,
            frame_b=request.clipBFrame,
            transition_type=request.transitionType,
            progress=request.progress,
        )
        return TransitionPreviewResponse(success=True, frameUrl=result["url"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TransitionProxyRequest(BaseModel):
    clipAUrl: str
    clipBUrl: str
    transitionType: str = "fade"
    duration: float = 0.5
    clipAEndTime: float    # End time of clip A on the timeline (seconds)
    clipBStartTime: float  # Start time of clip B on the timeline (seconds)
    maxWidth: int = 640

class TransitionProxyResponse(BaseModel):
    success: bool
    url: str
    duration: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None

@router.post("/render-proxy", response_model=TransitionProxyResponse)
async def render_transition_proxy(request: TransitionProxyRequest):
    """
    Pre-render a transition overlap zone as a short proxy video using FFmpeg xfade.
    The frontend plays this single video instead of CSS-compositing two clips in real-time.
    """
    try:
        result = await ffmpeg.render_transition_proxy(
            clip_a_url=request.clipAUrl,
            clip_b_url=request.clipBUrl,
            transition_type=request.transitionType,
            duration=request.duration,
            clip_a_end_time=request.clipAEndTime,
            clip_b_start_time=request.clipBStartTime,
            max_width=request.maxWidth,
        )
        return TransitionProxyResponse(
            success=True,
            url=result["url"],
            duration=result.get("duration"),
            width=result.get("width"),
            height=result.get("height"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/types")
async def list_transitions():
    """List all available transition types - matches FFmpeg xfade filter options"""
    return {
        "transitions": [
            # Subtle / Professional
            {"id": "cut", "name": "Cut", "category": "subtle", "description": "Hard cut", "defaultDuration": 0},
            {"id": "fade", "name": "Fade", "category": "subtle", "description": "Smooth opacity blend", "defaultDuration": 0.5},
            {"id": "fadeblack", "name": "Fade Black", "category": "subtle", "description": "Fade through black", "defaultDuration": 0.8},
            {"id": "fadewhite", "name": "Fade White", "category": "subtle", "description": "Fade through white", "defaultDuration": 0.8},
            {"id": "dissolve", "name": "Dissolve", "category": "subtle", "description": "Gradual dissolve", "defaultDuration": 0.6},
            
            # Directional Wipes
            {"id": "wipeleft", "name": "Wipe Left", "category": "wipe", "description": "Wipe from right to left", "defaultDuration": 0.5},
            {"id": "wiperight", "name": "Wipe Right", "category": "wipe", "description": "Wipe from left to right", "defaultDuration": 0.5},
            {"id": "wipeup", "name": "Wipe Up", "category": "wipe", "description": "Wipe from bottom to top", "defaultDuration": 0.5},
            {"id": "wipedown", "name": "Wipe Down", "category": "wipe", "description": "Wipe from top to bottom", "defaultDuration": 0.5},
            
            # Slides
            {"id": "slideleft", "name": "Slide Left", "category": "slide", "description": "Slide in from right", "defaultDuration": 0.4},
            {"id": "slideright", "name": "Slide Right", "category": "slide", "description": "Slide in from left", "defaultDuration": 0.4},
            {"id": "slideup", "name": "Slide Up", "category": "slide", "description": "Slide in from bottom", "defaultDuration": 0.4},
            {"id": "slidedown", "name": "Slide Down", "category": "slide", "description": "Slide in from top", "defaultDuration": 0.4},
            
            # Cover/Reveal
            {"id": "coverleft", "name": "Cover Left", "category": "cover", "description": "Cover from right", "defaultDuration": 0.5},
            {"id": "coverright", "name": "Cover Right", "category": "cover", "description": "Cover from left", "defaultDuration": 0.5},
            {"id": "revealleft", "name": "Reveal Left", "category": "cover", "description": "Reveal to left", "defaultDuration": 0.5},
            {"id": "revealright", "name": "Reveal Right", "category": "cover", "description": "Reveal to right", "defaultDuration": 0.5},
            
            # Dynamic / CapCut-style
            {"id": "zoomin", "name": "Zoom In", "category": "dynamic", "description": "Zoom in transition", "defaultDuration": 0.4},
            {"id": "circleopen", "name": "Circle Open", "category": "dynamic", "description": "Circle iris open", "defaultDuration": 0.5},
            {"id": "circleclose", "name": "Circle Close", "category": "dynamic", "description": "Circle iris close", "defaultDuration": 0.5},
            {"id": "pixelize", "name": "Pixelize", "category": "dynamic", "description": "Pixelation transition", "defaultDuration": 0.5},
            {"id": "radial", "name": "Radial", "category": "dynamic", "description": "Radial wipe", "defaultDuration": 0.5},
            {"id": "hblur", "name": "H Blur", "category": "dynamic", "description": "Horizontal blur", "defaultDuration": 0.3},
            
            # Cinematic
            {"id": "smoothleft", "name": "Smooth Left", "category": "cinematic", "description": "Smooth pan left", "defaultDuration": 0.6},
            {"id": "smoothright", "name": "Smooth Right", "category": "cinematic", "description": "Smooth pan right", "defaultDuration": 0.6},
            {"id": "diagtl", "name": "Diagonal TL", "category": "cinematic", "description": "Diagonal to top-left", "defaultDuration": 0.5},
            {"id": "diagtr", "name": "Diagonal TR", "category": "cinematic", "description": "Diagonal to top-right", "defaultDuration": 0.5},
            {"id": "diagbl", "name": "Diagonal BL", "category": "cinematic", "description": "Diagonal to bottom-left", "defaultDuration": 0.5},
            {"id": "diagbr", "name": "Diagonal BR", "category": "cinematic", "description": "Diagonal to bottom-right", "defaultDuration": 0.5},
            {"id": "squeezev", "name": "Squeeze V", "category": "cinematic", "description": "Vertical squeeze", "defaultDuration": 0.4},
            {"id": "squeezeh", "name": "Squeeze H", "category": "cinematic", "description": "Horizontal squeeze", "defaultDuration": 0.4},
        ]
    }
