from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.ffmpeg_service import FFmpegService

router = APIRouter()
ffmpeg = FFmpegService()

class ProxyGenerateRequest(BaseModel):
    projectId: str
    clipId: str
    videoUrl: Optional[str] = None
    format: str = "webm"
    quality: str = "low"  # low, medium
    maxWidth: int = 640

class ProxyResponse(BaseModel):
    success: bool
    url: str
    width: int
    height: int
    duration: Optional[float] = None

@router.post("/generate", response_model=ProxyResponse)
async def generate_proxy(request: ProxyGenerateRequest):
    """
    Generate a low-resolution proxy for preview playback
    Optimized for fast seeking and real-time playback during editing
    """
    try:
        result = await ffmpeg.generate_proxy(
            project_id=request.projectId,
            clip_id=request.clipId,
            video_url=request.videoUrl,
            format=request.format,
            quality=request.quality,
            max_width=request.maxWidth,
        )
        return ProxyResponse(
            success=True,
            url=result["url"],
            width=result["width"],
            height=result["height"],
            duration=result.get("duration"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ThumbnailRequest(BaseModel):
    videoUrl: str
    timestamps: list[float]  # List of timestamps in seconds
    width: int = 160

class ThumbnailResponse(BaseModel):
    success: bool
    thumbnails: list[str]  # URLs to thumbnail images

@router.post("/thumbnails", response_model=ThumbnailResponse)
async def generate_thumbnails(request: ThumbnailRequest):
    """
    Generate thumbnail images at specified timestamps
    Used for timeline thumbnail strips
    """
    try:
        result = await ffmpeg.generate_thumbnails(
            video_url=request.videoUrl,
            timestamps=request.timestamps,
            width=request.width,
        )
        return ThumbnailResponse(success=True, thumbnails=result["thumbnails"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class WaveformRequest(BaseModel):
    audioUrl: str
    width: int = 1920
    height: int = 120
    color: str = "#4F46E5"
    backgroundColor: str = "transparent"

class WaveformResponse(BaseModel):
    success: bool
    url: str
    peaks: Optional[list[float]] = None

@router.post("/waveform", response_model=WaveformResponse)
async def generate_waveform(request: WaveformRequest):
    """
    Generate audio waveform visualization
    Returns both image and peak data for custom rendering
    """
    try:
        result = await ffmpeg.generate_waveform(
            audio_url=request.audioUrl,
            width=request.width,
            height=request.height,
            color=request.color,
            background_color=request.backgroundColor,
        )
        return WaveformResponse(
            success=True,
            url=result["url"],
            peaks=result.get("peaks"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class VideoInfoRequest(BaseModel):
    videoUrl: str

class VideoInfoResponse(BaseModel):
    success: bool
    duration: float
    width: int
    height: int
    fps: float
    codec: str
    bitrate: Optional[int] = None
    hasAudio: bool

@router.post("/info", response_model=VideoInfoResponse)
async def get_video_info(request: VideoInfoRequest):
    """Get metadata and technical info about a video file"""
    try:
        result = await ffmpeg.get_video_info(request.videoUrl)
        return VideoInfoResponse(
            success=True,
            duration=result["duration"],
            width=result["width"],
            height=result["height"],
            fps=result["fps"],
            codec=result["codec"],
            bitrate=result.get("bitrate"),
            hasAudio=result["has_audio"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ExtractAudioRequest(BaseModel):
    videoUrl: str

class ExtractAudioResponse(BaseModel):
    success: bool
    url: str
    duration: float
    format: str

@router.post("/extract-audio", response_model=ExtractAudioResponse)
async def extract_audio(request: ExtractAudioRequest):
    """Extract the audio track from a video as MP3"""
    try:
        result = await ffmpeg.extract_audio(video_url=request.videoUrl)
        return ExtractAudioResponse(
            success=True,
            url=result["url"],
            duration=result["duration"],
            format=result["format"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
