from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from services.ffmpeg_service import FFmpegService

router = APIRouter()
ffmpeg = FFmpegService()

class LayerInput(BaseModel):
    url: str
    x: int = 0
    y: int = 0
    width: Optional[int] = None
    height: Optional[int] = None
    opacity: float = 1.0
    startTime: float = 0
    endTime: Optional[float] = None
    blendMode: str = "normal"

class CompositeRequest(BaseModel):
    projectId: str
    baseVideoUrl: str
    layers: List[LayerInput]
    outputFormat: str = "mp4"

class CompositeResponse(BaseModel):
    success: bool
    url: str
    duration: Optional[float] = None

@router.post("/layers", response_model=CompositeResponse)
async def composite_layers(request: CompositeRequest):
    """
    Composite multiple layers onto a base video
    Supports video, image, and mask layers with positioning and timing
    """
    try:
        result = await ffmpeg.composite_layers(
            project_id=request.projectId,
            base_video=request.baseVideoUrl,
            layers=[layer.dict() for layer in request.layers],
            output_format=request.outputFormat,
        )
        return CompositeResponse(
            success=True,
            url=result["url"],
            duration=result.get("duration"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class MaskApplyRequest(BaseModel):
    projectId: str
    videoUrl: str
    maskUrl: str
    fillType: str = "blur"  # blur, color, transparent, replace
    fillValue: Optional[str] = None  # color hex or replacement video URL
    invert: bool = False

@router.post("/mask/apply", response_model=CompositeResponse)
async def apply_mask(request: MaskApplyRequest):
    """
    Apply a mask to a video
    Can blur, color fill, make transparent, or replace masked area
    """
    try:
        result = await ffmpeg.apply_mask(
            project_id=request.projectId,
            video_url=request.videoUrl,
            mask_url=request.maskUrl,
            fill_type=request.fillType,
            fill_value=request.fillValue,
            invert=request.invert,
        )
        return CompositeResponse(success=True, url=result["url"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ColorGradeRequest(BaseModel):
    projectId: str
    videoUrl: str
    brightness: float = 0
    contrast: float = 1
    saturation: float = 1
    temperature: float = 0
    tint: float = 0
    lut: Optional[str] = None  # URL to LUT file

@router.post("/color/grade", response_model=CompositeResponse)
async def color_grade(request: ColorGradeRequest):
    """Apply color grading to a video"""
    try:
        result = await ffmpeg.color_grade(
            project_id=request.projectId,
            video_url=request.videoUrl,
            brightness=request.brightness,
            contrast=request.contrast,
            saturation=request.saturation,
            temperature=request.temperature,
            tint=request.tint,
            lut=request.lut,
        )
        return CompositeResponse(success=True, url=result["url"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CropRequest(BaseModel):
    projectId: str
    videoUrl: str
    x: int
    y: int
    width: int
    height: int

@router.post("/crop", response_model=CompositeResponse)
async def crop_video(request: CropRequest):
    """Crop a video to specified dimensions"""
    try:
        result = await ffmpeg.crop(
            project_id=request.projectId,
            video_url=request.videoUrl,
            x=request.x,
            y=request.y,
            width=request.width,
            height=request.height,
        )
        return CompositeResponse(success=True, url=result["url"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SpeedRequest(BaseModel):
    projectId: str
    videoUrl: str
    speed: float  # 0.5 = half speed, 2.0 = double speed
    maintainPitch: bool = True

@router.post("/speed", response_model=CompositeResponse)
async def change_speed(request: SpeedRequest):
    """Change video playback speed"""
    try:
        result = await ffmpeg.change_speed(
            project_id=request.projectId,
            video_url=request.videoUrl,
            speed=request.speed,
            maintain_pitch=request.maintainPitch,
        )
        return CompositeResponse(success=True, url=result["url"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
