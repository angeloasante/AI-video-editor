from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from services.ffmpeg_service import FFmpegService

router = APIRouter()
ffmpeg = FFmpegService()


class TextPosition(BaseModel):
    """Position configuration for text overlay"""
    x: str = "(w-text_w)/2"  # centered horizontally by default
    y: str = "h-th-40"       # near bottom by default


class TextStyle(BaseModel):
    """Style configuration for text overlay"""
    fontSize: int = 48
    fontColor: str = "white"
    fontFile: str = "/app/fonts/Inter-Bold.ttf"
    # Background box
    box: bool = True
    boxColor: str = "black@0.5"
    boxBorderWidth: int = 10
    # Shadow
    shadowX: int = 2
    shadowY: int = 2
    shadowColor: str = "black@0.8"


class TextOverlayRequest(BaseModel):
    """Request to add a single text overlay to video"""
    projectId: str
    videoUrl: str
    text: str
    position: Optional[TextPosition] = None
    style: Optional[TextStyle] = None
    startTime: float = 0.0
    endTime: Optional[float] = None


class TextOverlayResponse(BaseModel):
    success: bool
    url: str
    duration: Optional[float] = None


@router.post("/overlay", response_model=TextOverlayResponse)
async def add_text_overlay(request: TextOverlayRequest):
    """
    Add a text overlay to a video using FFmpeg drawtext filter.
    Server-side rendering ensures consistent fonts across all devices.
    """
    try:
        position = request.position or TextPosition()
        style = request.style or TextStyle()
        
        result = await ffmpeg.add_text_overlay(
            project_id=request.projectId,
            video_url=request.videoUrl,
            text=request.text,
            x=position.x,
            y=position.y,
            font_size=style.fontSize,
            font_color=style.fontColor,
            font_file=style.fontFile,
            start_time=request.startTime,
            end_time=request.endTime,
            box=style.box,
            box_color=style.boxColor,
            box_border=style.boxBorderWidth,
            shadow_x=style.shadowX,
            shadow_y=style.shadowY,
            shadow_color=style.shadowColor,
        )
        return TextOverlayResponse(
            success=True,
            url=result["url"],
            duration=result.get("duration"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class FadeTextRequest(BaseModel):
    """Request for text with fade in/out animation"""
    projectId: str
    videoUrl: str
    text: str
    position: Optional[TextPosition] = None
    style: Optional[TextStyle] = None
    startTime: float = 0.0
    fadeInDuration: float = 0.5
    holdDuration: float = 2.0
    fadeOutDuration: float = 0.5


@router.post("/fade", response_model=TextOverlayResponse)
async def add_fade_text(request: FadeTextRequest):
    """
    Add text that fades in, holds, then fades out.
    Pure FFmpeg - no browser rendering required.
    """
    try:
        position = request.position or TextPosition()
        style = request.style or TextStyle()
        
        result = await ffmpeg.add_fade_text(
            project_id=request.projectId,
            video_url=request.videoUrl,
            text=request.text,
            x=position.x,
            y=position.y,
            font_size=style.fontSize,
            font_color=style.fontColor,
            font_file=style.fontFile,
            start_time=request.startTime,
            fade_in=request.fadeInDuration,
            hold=request.holdDuration,
            fade_out=request.fadeOutDuration,
            box=style.box,
            box_color=style.boxColor,
            shadow_x=style.shadowX,
            shadow_y=style.shadowY,
            shadow_color=style.shadowColor,
        )
        return TextOverlayResponse(
            success=True,
            url=result["url"],
            duration=result.get("duration"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CaptionWord(BaseModel):
    """Single word with timing from ElevenLabs or transcription"""
    text: str
    startTime: float
    endTime: float


class TypewriterCaptionsRequest(BaseModel):
    """Request for typewriter/word-by-word captions like CapCut"""
    projectId: str
    videoUrl: str
    words: List[CaptionWord]
    position: Optional[TextPosition] = None
    style: Optional[TextStyle] = None
    highlightColor: Optional[str] = None  # Highlight current word


@router.post("/captions", response_model=TextOverlayResponse)
async def add_typewriter_captions(request: TypewriterCaptionsRequest):
    """
    Add typewriter-style captions with word-by-word timing.
    Uses ElevenLabs word timestamps for precise sync.
    Each word appears exactly when spoken.
    """
    try:
        position = request.position or TextPosition()
        style = request.style or TextStyle()
        
        result = await ffmpeg.add_typewriter_captions(
            project_id=request.projectId,
            video_url=request.videoUrl,
            words=[w.dict() for w in request.words],
            x=position.x,
            y=position.y,
            font_size=style.fontSize,
            font_color=style.fontColor,
            font_file=style.fontFile,
            box=style.box,
            box_color=style.boxColor,
            highlight_color=request.highlightColor,
        )
        return TextOverlayResponse(
            success=True,
            url=result["url"],
            duration=result.get("duration"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Animation types for text overlays
from enum import Enum

class TextAnimationType(str, Enum):
    NONE = "none"
    FADE = "fade"
    TYPEWRITER = "typewriter"
    SLIDE_UP = "slide-up"
    SLIDE_DOWN = "slide-down"
    SCALE = "scale"
    BOUNCE = "bounce"


class TextAnimation(BaseModel):
    """Animation settings for text overlay"""
    type: TextAnimationType = TextAnimationType.FADE
    fadeIn: float = 0.3
    fadeOut: float = 0.3


class AnimatedTextRequest(BaseModel):
    """Request for animated text overlay matching frontend TextOverlay type"""
    projectId: str
    videoUrl: str
    text: str
    preset: str  # title, subtitle, body, caption, quote
    startTime: float
    endTime: float
    position: Optional[dict] = None  # { x: 0-100, y: 0-100 }
    animation: TextAnimation = TextAnimation()


@router.post("/animated", response_model=TextOverlayResponse)
async def add_animated_text(request: AnimatedTextRequest):
    """
    Add animated text overlay to video.
    Supports: fade, typewriter, slide-up, slide-down, scale, bounce
    This matches the frontend TextOverlay interface for seamless export.
    """
    try:
        # Get preset style or default
        preset = TEXT_PRESETS.get(request.preset, TEXT_PRESETS["body"])
        
        # Convert position from percentage to FFmpeg expression
        x = "(w-text_w)/2"  # default centered
        y = "h*0.8"  # default near bottom
        if request.position:
            px = request.position.get("x", 50)
            py = request.position.get("y", 80)
            x = f"w*{px/100}-text_w/2"
            y = f"h*{py/100}-text_h/2"
        
        anim_type = request.animation.type
        fade_in = request.animation.fadeIn
        fade_out = request.animation.fadeOut
        
        # Route to appropriate FFmpeg implementation
        if anim_type == TextAnimationType.FADE:
            hold = (request.endTime - request.startTime) - fade_in - fade_out
            result = await ffmpeg.add_fade_text(
                project_id=request.projectId,
                video_url=request.videoUrl,
                text=request.text,
                x=x,
                y=y,
                font_size=preset.fontSize,
                font_color=preset.fontColor,
                font_file=preset.fontFile,
                start_time=request.startTime,
                fade_in=fade_in,
                hold=max(0.1, hold),
                fade_out=fade_out,
                box=preset.box,
                box_color=preset.boxColor,
                shadow_x=preset.shadowX,
                shadow_y=preset.shadowY,
                shadow_color="black@0.8",
            )
        elif anim_type == TextAnimationType.SLIDE_UP:
            result = await ffmpeg.add_slide_text(
                project_id=request.projectId,
                video_url=request.videoUrl,
                text=request.text,
                x=x,
                y_start="h+text_h",
                y_end=y,
                font_size=preset.fontSize,
                font_color=preset.fontColor,
                font_file=preset.fontFile,
                start_time=request.startTime,
                end_time=request.endTime,
                slide_in=fade_in,
                slide_out=fade_out,
                direction="up",
            )
        elif anim_type == TextAnimationType.SLIDE_DOWN:
            result = await ffmpeg.add_slide_text(
                project_id=request.projectId,
                video_url=request.videoUrl,
                text=request.text,
                x=x,
                y_start="-text_h",
                y_end=y,
                font_size=preset.fontSize,
                font_color=preset.fontColor,
                font_file=preset.fontFile,
                start_time=request.startTime,
                end_time=request.endTime,
                slide_in=fade_in,
                slide_out=fade_out,
                direction="down",
            )
        elif anim_type == TextAnimationType.SCALE:
            result = await ffmpeg.add_scale_text(
                project_id=request.projectId,
                video_url=request.videoUrl,
                text=request.text,
                x=x,
                y=y,
                font_size=preset.fontSize,
                font_color=preset.fontColor,
                font_file=preset.fontFile,
                start_time=request.startTime,
                end_time=request.endTime,
                scale_in=fade_in,
                scale_out=fade_out,
            )
        else:
            # Default to simple text overlay with enable timing
            result = await ffmpeg.add_text_overlay(
                project_id=request.projectId,
                video_url=request.videoUrl,
                text=request.text,
                x=x,
                y=y,
                font_size=preset.fontSize,
                font_color=preset.fontColor,
                font_file=preset.fontFile,
                start_time=request.startTime,
                end_time=request.endTime,
                box=preset.box,
                box_color=preset.boxColor,
                box_border=10,
                shadow_x=preset.shadowX,
                shadow_y=preset.shadowY,
                shadow_color="black@0.8",
            )
        
        return TextOverlayResponse(
            success=True,
            url=result["url"],
            duration=result.get("duration"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class MultiTextOverlay(BaseModel):
    """Single text element in a multi-text composition"""
    text: str
    x: str = "(w-text_w)/2"
    y: str = "h/2"
    fontSize: int = 48
    fontColor: str = "white"
    fontFile: str = "/app/fonts/Inter-Bold.ttf"
    startTime: float = 0.0
    endTime: Optional[float] = None


class MultiTextRequest(BaseModel):
    """Request to add multiple text overlays at once"""
    projectId: str
    videoUrl: str
    textElements: List[MultiTextOverlay]


@router.post("/multi", response_model=TextOverlayResponse)
async def add_multiple_text(request: MultiTextRequest):
    """
    Add multiple text overlays to a video in a single pass.
    More efficient than adding them one by one.
    """
    try:
        result = await ffmpeg.add_multiple_text(
            project_id=request.projectId,
            video_url=request.videoUrl,
            text_elements=[t.dict() for t in request.textElements],
        )
        return TextOverlayResponse(
            success=True,
            url=result["url"],
            duration=result.get("duration"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TextPreset(BaseModel):
    """Predefined text style presets"""
    name: str
    fontSize: int
    fontFile: str
    fontColor: str
    box: bool
    boxColor: str
    shadowX: int
    shadowY: int


# Predefined text presets matching the frontend
TEXT_PRESETS = {
    "title": TextPreset(
        name="Title",
        fontSize=72,
        fontFile="/app/fonts/Inter-Bold.ttf",
        fontColor="white",
        box=True,
        boxColor="black@0.6",
        shadowX=3,
        shadowY=3,
    ),
    "subtitle": TextPreset(
        name="Subtitle",
        fontSize=48,
        fontFile="/app/fonts/Inter-Medium.ttf",
        fontColor="white",
        box=True,
        boxColor="black@0.5",
        shadowX=2,
        shadowY=2,
    ),
    "body": TextPreset(
        name="Body Text",
        fontSize=32,
        fontFile="/app/fonts/Inter-Regular.ttf",
        fontColor="white",
        box=False,
        boxColor="black@0.4",
        shadowX=1,
        shadowY=1,
    ),
    "caption": TextPreset(
        name="Caption",
        fontSize=24,
        fontFile="/app/fonts/Inter-Light.ttf",
        fontColor="white",
        box=True,
        boxColor="black@0.7",
        shadowX=1,
        shadowY=1,
    ),
    "quote": TextPreset(
        name="Quote",
        fontSize=40,
        fontFile="/app/fonts/Inter-Italic.ttf",
        fontColor="white",
        box=False,
        boxColor="black@0.4",
        shadowX=2,
        shadowY=2,
    ),
}


@router.get("/presets")
async def get_text_presets():
    """Get available text style presets"""
    return {
        "success": True,
        "presets": {k: v.dict() for k, v in TEXT_PRESETS.items()},
    }


class PresetTextRequest(BaseModel):
    """Request to add text using a preset style"""
    projectId: str
    videoUrl: str
    text: str
    preset: str  # title, subtitle, body, caption, quote
    position: Optional[TextPosition] = None
    startTime: float = 0.0
    endTime: Optional[float] = None


@router.post("/preset", response_model=TextOverlayResponse)
async def add_preset_text(request: PresetTextRequest):
    """
    Add text using a predefined style preset.
    Matches the presets shown in the AssetLibrary.
    """
    try:
        if request.preset not in TEXT_PRESETS:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown preset: {request.preset}. Available: {list(TEXT_PRESETS.keys())}",
            )
        
        preset = TEXT_PRESETS[request.preset]
        position = request.position or TextPosition()
        
        result = await ffmpeg.add_text_overlay(
            project_id=request.projectId,
            video_url=request.videoUrl,
            text=request.text,
            x=position.x,
            y=position.y,
            font_size=preset.fontSize,
            font_color=preset.fontColor,
            font_file=preset.fontFile,
            start_time=request.startTime,
            end_time=request.endTime,
            box=preset.box,
            box_color=preset.boxColor,
            box_border=10,
            shadow_x=preset.shadowX,
            shadow_y=preset.shadowY,
            shadow_color="black@0.8",
        )
        return TextOverlayResponse(
            success=True,
            url=result["url"],
            duration=result.get("duration"),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
