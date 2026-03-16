from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from services.ffmpeg_service import FFmpegService

router = APIRouter()
ffmpeg = FFmpegService()

class ClipData(BaseModel):
    id: str
    start: float  # Start time in timeline
    end: float    # End time in timeline
    source: str   # URL to source media
    sourceIn: float = 0  # In point in source
    sourceOut: Optional[float] = None  # Out point in source
    volume: float = 1.0
    opacity: float = 1.0
    effects: List[Dict[str, Any]] = []

class TrackData(BaseModel):
    id: str
    name: str
    type: str  # video, audio, overlay
    clips: List[ClipData]
    muted: bool = False
    locked: bool = False

class TimelineData(BaseModel):
    tracks: List[TrackData]
    duration: float

class TransitionData(BaseModel):
    type: str
    duration: float
    startTime: float
    clipAId: str
    clipBId: str

class TextOverlayData(BaseModel):
    text: str
    preset: Optional[str] = None
    startTime: float
    endTime: float
    position: Optional[Dict[str, float]] = None
    fontSize: Optional[int] = None
    fontColor: Optional[str] = None
    fontFamily: Optional[str] = None
    fontWeight: Optional[int] = None

class FinalRenderRequest(BaseModel):
    projectId: str
    timeline: TimelineData
    format: str = "mp4"
    quality: str = "hd"  # draft, preview, hd, 4k
    includeAudio: bool = True
    frameRate: int = 30
    transitions: List[TransitionData] = []
    textOverlays: List[TextOverlayData] = []

class RenderResponse(BaseModel):
    success: bool
    videoUrl: str
    duration: float
    fileSize: Optional[int] = None
    skippedClips: Optional[int] = None

@router.post("/final", response_model=RenderResponse)
async def render_final(request: FinalRenderRequest):
    """
    Render the final video from timeline data
    Processes all tracks, clips, transitions, and effects
    """
    try:
        # Map quality to resolution
        resolution_map = {
            "draft": (640, 360),
            "preview": (1280, 720),
            "hd": (1920, 1080),
            "4k": (3840, 2160),
        }
        resolution = resolution_map.get(request.quality, (1920, 1080))
        
        print(f"[EXPORT] Starting render for project {request.projectId}")
        print(f"[EXPORT] Timeline tracks: {len(request.timeline.tracks)}")
        print(f"[EXPORT] Resolution: {resolution}, Format: {request.format}")
        
        result = await ffmpeg.render_timeline(
            project_id=request.projectId,
            timeline=request.timeline.dict(),
            resolution=resolution,
            format=request.format,
            frame_rate=request.frameRate,
            include_audio=request.includeAudio,
            transitions=[t.dict() for t in request.transitions],
            text_overlays=[t.dict() for t in request.textOverlays],
        )
        
        print(f"[EXPORT] Render complete: {result.get('url')}")
        
        return RenderResponse(
            success=True,
            videoUrl=result["url"],
            duration=result["duration"],
            fileSize=result.get("file_size"),
            skippedClips=result.get("skipped_clips"),
        )
    except Exception as e:
        import traceback
        print(f"[EXPORT ERROR] {str(e)}")
        print(f"[EXPORT TRACEBACK] {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

class ConcatRequest(BaseModel):
    projectId: str
    clips: List[str]  # URLs to video clips
    transitions: Optional[List[Dict[str, Any]]] = None  # Optional transitions between clips
    format: str = "mp4"

@router.post("/concat", response_model=RenderResponse)
async def concat_clips(request: ConcatRequest):
    """
    Concatenate multiple clips with optional transitions
    Simpler than full timeline render for basic joining
    """
    try:
        result = await ffmpeg.concat_clips(
            project_id=request.projectId,
            clips=request.clips,
            transitions=request.transitions,
            format=request.format,
        )
        return RenderResponse(
            success=True,
            videoUrl=result["url"],
            duration=result["duration"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AudioMixRequest(BaseModel):
    projectId: str
    videoUrl: str
    audioTracks: List[Dict[str, Any]]  # [{url, volume, startTime, endTime}]
    normalizeAudio: bool = True

@router.post("/audio/mix", response_model=RenderResponse)
async def mix_audio(request: AudioMixRequest):
    """
    Mix multiple audio tracks onto a video
    Supports volume adjustment and normalization
    """
    try:
        result = await ffmpeg.mix_audio(
            project_id=request.projectId,
            video_url=request.videoUrl,
            audio_tracks=request.audioTracks,
            normalize=request.normalizeAudio,
        )
        return RenderResponse(
            success=True,
            videoUrl=result["url"],
            duration=result["duration"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class PreviewRenderRequest(BaseModel):
    projectId: str
    timeline: TimelineData
    startTime: float
    endTime: float
    quality: str = "preview"

@router.post("/preview", response_model=RenderResponse)
async def render_preview(request: PreviewRenderRequest):
    """
    Render a preview of a portion of the timeline
    Faster than full render, used for playback during editing
    """
    try:
        result = await ffmpeg.render_preview(
            project_id=request.projectId,
            timeline=request.timeline.dict(),
            start_time=request.startTime,
            end_time=request.endTime,
            quality=request.quality,
        )
        return RenderResponse(
            success=True,
            videoUrl=result["url"],
            duration=result["duration"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
