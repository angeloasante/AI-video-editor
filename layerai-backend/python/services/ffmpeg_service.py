import os
import asyncio
import tempfile
import subprocess
import json
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
import aiohttp
import aiofiles

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
MEDIA_BUCKET = "layerai-media"
PROXIES_BUCKET = "layerai-proxies"
EXPORTS_BUCKET = "layerai-exports"


class FFmpegService:
    """Service for FFmpeg video processing operations"""

    def __init__(self):
        self.temp_dir = tempfile.gettempdir()

    def _get_file_extension(self, url: str, content_type: str = None) -> str:
        """Determine file extension from URL or content type"""
        # Image extensions
        image_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
        # Video extensions
        video_extensions = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}
        
        # Try to get extension from URL path (before query params)
        url_path = url.split("?")[0].lower()
        for ext in image_extensions | video_extensions:
            if url_path.endswith(ext):
                return ext
        
        # Fallback to content type
        if content_type:
            content_type = content_type.lower()
            if "image/jpeg" in content_type or "image/jpg" in content_type:
                return ".jpg"
            elif "image/png" in content_type:
                return ".png"
            elif "image/gif" in content_type:
                return ".gif"
            elif "image/webp" in content_type:
                return ".webp"
            elif "video/mp4" in content_type:
                return ".mp4"
            elif "video/quicktime" in content_type:
                return ".mov"
        
        # Default to mp4 for unknown
        return ".mp4"

    def _is_image_file(self, filepath: str) -> bool:
        """Check if a file is an image based on extension"""
        image_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
        return any(filepath.lower().endswith(ext) for ext in image_extensions)

    async def _download_file(self, url: str, suffix: str = None, retries: int = 2) -> str:
        """Download a file from URL to temp directory, auto-detecting file type"""
        last_error = None
        for attempt in range(retries + 1):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=120)) as response:
                        if response.status != 200:
                            body = await response.text()
                            raise Exception(f"Failed to download {url}: {response.status} - {body[:200]}")

                        # Auto-detect suffix if not provided
                        if suffix is None:
                            content_type = response.headers.get("Content-Type", "")
                            suffix = self._get_file_extension(url, content_type)
                            print(f"[FFMPEG] Detected file type: {suffix} (content-type: {content_type})")

                        temp_file = tempfile.NamedTemporaryFile(
                            suffix=suffix, delete=False, dir=self.temp_dir
                        )
                        async with aiofiles.open(temp_file.name, "wb") as f:
                            await f.write(await response.read())
                        return temp_file.name
            except Exception as e:
                last_error = e
                if attempt < retries:
                    import asyncio
                    wait = 2 ** attempt
                    print(f"[FFMPEG] Download attempt {attempt + 1} failed, retrying in {wait}s: {e}")
                    await asyncio.sleep(wait)
        raise last_error

    def _guess_content_type(self, file_path: str) -> str:
        """Guess MIME content type from file extension"""
        ext = os.path.splitext(file_path)[1].lower()
        types = {
            ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
            ".avi": "video/x-msvideo", ".mkv": "video/x-matroska",
            ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac",
            ".wav": "audio/wav", ".ogg": "audio/ogg",
            ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
            ".gif": "image/gif", ".webp": "image/webp",
        }
        return types.get(ext, "application/octet-stream")

    async def _upload_file(
        self, file_path: str, bucket: str, dest_path: str
    ) -> str:
        """Upload a file to Supabase storage"""
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise Exception(f"Supabase not configured. URL: {bool(SUPABASE_URL)}, KEY: {bool(SUPABASE_KEY)}")

        async with aiofiles.open(file_path, "rb") as f:
            content = await f.read()

        async with aiohttp.ClientSession() as session:
            url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{dest_path}"
            headers = {
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": self._guess_content_type(file_path),
            }
            async with session.post(url, headers=headers, data=content) as response:
                if response.status not in [200, 201]:
                    error_text = await response.text()
                    raise Exception(f"Upload failed: {response.status} - {error_text}")

        return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{dest_path}"

    # Weight number → Google Fonts file suffix
    WEIGHT_SUFFIXES = {
        100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular",
        500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black",
    }

    def _resolve_font(self, font_family: str = None, weight: int = 400) -> str:
        """Resolve a font family name + weight to a .ttf file, downloading from Google Fonts if needed"""
        fonts_dir = "/app/fonts"
        os.makedirs(fonts_dir, exist_ok=True)

        if not font_family:
            font_family = "Inter"

        safe_name = font_family.replace(" ", "")
        weight_suffix = self.WEIGHT_SUFFIXES.get(weight, "Regular")

        # Try exact weight first, then Regular as fallback
        candidates = [
            f"{safe_name}-{weight_suffix}.ttf",
            f"{safe_name}-Regular.ttf",
            f"{safe_name}.ttf",
        ]
        for c in candidates:
            path = os.path.join(fonts_dir, c)
            if os.path.exists(path):
                return path

        # Not found locally — download from Google Fonts API
        downloaded = self._download_google_font(font_family, weight, fonts_dir)
        if downloaded:
            return downloaded

        # Fallback chain
        fallbacks = [
            os.path.join(fonts_dir, "Inter-Regular.ttf"),
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
            "/Library/Fonts/Arial.ttf",
        ]
        for fb in fallbacks:
            if os.path.exists(fb):
                return fb
        return ""

    def _download_google_font(self, font_family: str, weight: int, fonts_dir: str) -> str:
        """Download a font from Google Fonts CSS API (synchronous)"""
        import urllib.request
        import re

        safe_name = font_family.replace(" ", "")
        weight_suffix = self.WEIGHT_SUFFIXES.get(weight, "Regular")
        target_file = os.path.join(fonts_dir, f"{safe_name}-{weight_suffix}.ttf")

        try:
            # Google Fonts CSS API — request with a browser User-Agent to get .ttf URLs
            family_param = font_family.replace(" ", "+")
            css_url = f"https://fonts.googleapis.com/css2?family={family_param}:wght@{weight}&display=swap"
            req = urllib.request.Request(css_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            with urllib.request.urlopen(req, timeout=10) as resp:
                css_text = resp.read().decode("utf-8")

            # Extract .ttf URL from the CSS
            ttf_urls = re.findall(r"url\((https://fonts\.gstatic\.com/[^)]+\.ttf)\)", css_text)
            if not ttf_urls:
                print(f"[FFMPEG] No .ttf URL found in Google Fonts CSS for {font_family}:{weight}")
                return ""

            ttf_url = ttf_urls[0]
            print(f"[FFMPEG] Downloading font: {font_family} {weight_suffix} from {ttf_url}")
            urllib.request.urlretrieve(ttf_url, target_file)
            print(f"[FFMPEG] Font saved: {target_file}")
            return target_file
        except Exception as e:
            print(f"[FFMPEG] Font download failed for {font_family}:{weight}: {e}")
            # Try downloading Regular weight as fallback
            if weight != 400:
                regular_file = os.path.join(fonts_dir, f"{safe_name}-Regular.ttf")
                if not os.path.exists(regular_file):
                    try:
                        family_param = font_family.replace(" ", "+")
                        css_url = f"https://fonts.googleapis.com/css2?family={family_param}:wght@400&display=swap"
                        req = urllib.request.Request(css_url, headers={
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                        })
                        with urllib.request.urlopen(req, timeout=10) as resp:
                            css_text = resp.read().decode("utf-8")
                        ttf_urls = re.findall(r"url\((https://fonts\.gstatic\.com/[^)]+\.ttf)\)", css_text)
                        if ttf_urls:
                            urllib.request.urlretrieve(ttf_urls[0], regular_file)
                            print(f"[FFMPEG] Fallback font saved: {regular_file}")
                            return regular_file
                    except:
                        pass
            return ""

    def _run_ffmpeg(self, args: List[str]) -> subprocess.CompletedProcess:
        """Run FFmpeg command"""
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "warning"] + args
        print(f"[FFMPEG] Running: ffmpeg {' '.join(args[:6])}...")
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"[FFMPEG] Error: {result.stderr}")
            raise Exception(f"FFmpeg failed: {result.stderr}")
        if result.stderr:
            print(f"[FFMPEG] Warnings: {result.stderr}")
        return result

    def _run_ffprobe(self, input_file: str) -> Dict[str, Any]:
        """Get video info using ffprobe"""
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            input_file,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return json.loads(result.stdout)

    async def get_video_info(self, video_url: str) -> Dict[str, Any]:
        """Get metadata about a video file"""
        input_file = await self._download_file(video_url)
        try:
            info = self._run_ffprobe(input_file)
            video_stream = next(
                (s for s in info.get("streams", []) if s["codec_type"] == "video"),
                None,
            )
            audio_stream = next(
                (s for s in info.get("streams", []) if s["codec_type"] == "audio"),
                None,
            )

            return {
                "duration": float(info["format"].get("duration", 0)),
                "width": video_stream["width"] if video_stream else 0,
                "height": video_stream["height"] if video_stream else 0,
                "fps": eval(video_stream.get("r_frame_rate", "30/1")) if video_stream else 30,
                "codec": video_stream.get("codec_name", "unknown") if video_stream else "unknown",
                "bitrate": int(info["format"].get("bit_rate", 0)),
                "has_audio": audio_stream is not None,
            }
        finally:
            os.unlink(input_file)

    async def extract_frame(
        self, video_url: str, timestamp: float, width: int = 640
    ) -> Dict[str, Any]:
        """Extract a single frame from video"""
        input_file = await self._download_file(video_url)
        output_file = tempfile.NamedTemporaryFile(
            suffix=".jpg", delete=False, dir=self.temp_dir
        )

        try:
            self._run_ffmpeg([
                "-ss", str(timestamp),
                "-i", input_file,
                "-vframes", "1",
                "-vf", f"scale={width}:-1",
                output_file.name,
            ])

            # Upload and return URL
            dest_path = f"frames/{os.path.basename(output_file.name)}"
            url = await self._upload_file(output_file.name, PROXIES_BUCKET, dest_path)
            return {"url": url}
        finally:
            os.unlink(input_file)
            os.unlink(output_file.name)

    async def extract_audio(self, video_url: str) -> Dict[str, Any]:
        """Extract audio track from a video file as MP3"""
        input_file = await self._download_file(video_url)
        output_file = tempfile.NamedTemporaryFile(
            suffix=".mp3", delete=False, dir=self.temp_dir
        )

        try:
            # Check if video has audio
            info = self._run_ffprobe(input_file)
            audio_stream = next(
                (s for s in info.get("streams", []) if s["codec_type"] == "audio"),
                None,
            )
            if not audio_stream:
                raise Exception("Video has no audio track")

            duration = float(info["format"].get("duration", 0))

            # Extract audio as MP3 192kbps
            self._run_ffmpeg([
                "-i", input_file,
                "-vn",              # no video
                "-acodec", "libmp3lame",
                "-ab", "192k",
                "-ar", "44100",     # standard sample rate
                output_file.name,
            ])

            # Upload to Supabase
            dest_path = f"extracted-audio/{os.path.basename(output_file.name)}"
            url = await self._upload_file(output_file.name, PROXIES_BUCKET, dest_path)

            return {
                "url": url,
                "duration": duration,
                "format": "mp3",
            }
        finally:
            os.unlink(input_file)
            if os.path.exists(output_file.name):
                os.unlink(output_file.name)

    async def generate_proxy(
        self,
        project_id: str,
        clip_id: str,
        video_url: str,
        format: str = "webm",
        quality: str = "low",
        max_width: int = 640,
    ) -> Dict[str, Any]:
        """Generate low-resolution proxy for preview"""
        input_file = await self._download_file(video_url)
        output_file = tempfile.NamedTemporaryFile(
            suffix=f".{format}", delete=False, dir=self.temp_dir
        )

        # Quality presets
        crf_map = {"low": 35, "medium": 28}
        crf = crf_map.get(quality, 35)

        try:
            # Get input dimensions
            info = self._run_ffprobe(input_file)
            video_stream = next(
                (s for s in info.get("streams", []) if s["codec_type"] == "video"),
                None,
            )
            
            input_width = video_stream["width"] if video_stream else 1920
            input_height = video_stream["height"] if video_stream else 1080
            
            # Calculate output dimensions maintaining aspect ratio
            if input_width > max_width:
                scale = max_width / input_width
                output_width = max_width
                output_height = int(input_height * scale)
                # Ensure even dimensions
                output_height = output_height + (output_height % 2)
            else:
                output_width = input_width
                output_height = input_height

            if format == "webm":
                self._run_ffmpeg([
                    "-i", input_file,
                    "-c:v", "libvpx-vp9",
                    "-crf", str(crf),
                    "-b:v", "0",
                    "-vf", f"scale={output_width}:{output_height}",
                    "-c:a", "libopus",
                    "-b:a", "64k",
                    output_file.name,
                ])
            else:
                self._run_ffmpeg([
                    "-i", input_file,
                    "-c:v", "libx264",
                    "-crf", str(crf),
                    "-preset", "fast",
                    "-vf", f"scale={output_width}:{output_height}",
                    "-c:a", "aac",
                    "-b:a", "64k",
                    output_file.name,
                ])

            # Upload
            dest_path = f"{project_id}/proxies/{clip_id}.{format}"
            url = await self._upload_file(output_file.name, PROXIES_BUCKET, dest_path)
            
            duration = float(info["format"].get("duration", 0))

            return {
                "url": url,
                "width": output_width,
                "height": output_height,
                "duration": duration,
            }
        finally:
            os.unlink(input_file)
            os.unlink(output_file.name)

    async def apply_transition(
        self,
        clip_a: str,
        clip_b: str,
        transition_type: str,
        duration: float,
    ) -> Dict[str, Any]:
        """Apply transition between two clips using FFmpeg xfade"""
        file_a = await self._download_file(clip_a)
        file_b = await self._download_file(clip_b)
        output_file = tempfile.NamedTemporaryFile(
            suffix=".mp4", delete=False, dir=self.temp_dir
        )

        try:
            # Get durations
            info_a = self._run_ffprobe(file_a)
            info_b = self._run_ffprobe(file_b)
            duration_a = float(info_a["format"].get("duration", 5))
            duration_b = float(info_b["format"].get("duration", 5))

            # Calculate offset (when transition starts)
            offset = duration_a - duration
            
            # Map transition names to FFmpeg xfade types
            # All these are native FFmpeg xfade transitions
            xfade_map = {
                # Subtle / Professional
                "fade": "fade",
                "crossfade": "fade",
                "fadeblack": "fadeblack",
                "fadewhite": "fadewhite",
                "dissolve": "dissolve",
                
                # Directional Wipes
                "wipeleft": "wipeleft",
                "wipe-left": "wipeleft",
                "wiperight": "wiperight",
                "wipe-right": "wiperight",
                "wipeup": "wipeup",
                "wipe-up": "wipeup",
                "wipedown": "wipedown",
                "wipe-down": "wipedown",
                
                # Slides
                "slideleft": "slideleft",
                "slideright": "slideright",
                "slideup": "slideup",
                "slidedown": "slidedown",
                
                # Cover/Reveal
                "coverleft": "coverleft",
                "coverright": "coverright",
                "coverup": "coverup",
                "coverdown": "coverdown",
                "revealleft": "revealleft",
                "revealright": "revealright",
                "revealup": "revealup",
                "revealdown": "revealdown",
                
                # Dynamic / CapCut-style
                "zoomin": "zoomin",
                "zoom": "zoomin",
                "circleopen": "circleopen",
                "circleclose": "circleclose",
                "circlecrop": "circlecrop",
                "radial": "radial",
                "pixelize": "pixelize",
                "hblur": "hblur",
                
                # Cinematic
                "smoothleft": "smoothleft",
                "smoothright": "smoothright",
                "smoothup": "smoothup",
                "smoothdown": "smoothdown",
                "diagtl": "diagtl",
                "diagtr": "diagtr",
                "diagbl": "diagbl",
                "diagbr": "diagbr",
                "squeezev": "squeezev",
                "squeezeh": "squeezeh",
                
                # Additional
                "hlslice": "hlslice",
                "hrslice": "hrslice",
                "vuslice": "vuslice",
                "vdslice": "vdslice",
                "horzopen": "horzopen",
                "horzclose": "horzclose",
                "vertopen": "vertopen",
                "vertclose": "vertclose",
            }
            
            # Get actual FFmpeg transition name
            xfade_type = xfade_map.get(transition_type.lower(), "fade")

            # Check if both clips have audio
            has_audio_a = any(s.get("codec_type") == "audio" for s in info_a.get("streams", []))
            has_audio_b = any(s.get("codec_type") == "audio" for s in info_b.get("streams", []))
            both_have_audio = has_audio_a and has_audio_b

            if both_have_audio:
                filter_complex = (
                    f"[0:v][1:v]xfade=transition={xfade_type}:duration={duration}:offset={offset}[v];"
                    f"[0:a][1:a]acrossfade=d={duration}:c1=tri:c2=tri[a]"
                )
                map_args = ["-map", "[v]", "-map", "[a]", "-c:a", "aac", "-ar", "48000", "-ac", "2"]
            else:
                filter_complex = (
                    f"[0:v][1:v]xfade=transition={xfade_type}:duration={duration}:offset={offset}[v]"
                )
                map_args = ["-map", "[v]", "-an"]

            self._run_ffmpeg([
                "-i", file_a,
                "-i", file_b,
                "-filter_complex", filter_complex,
                *map_args,
                "-c:v", "libx264",
                "-crf", "23",
                "-vsync", "cfr",
                "-pix_fmt", "yuv420p",
                output_file.name,
            ])

            # Upload
            import uuid
            dest_path = f"transitions/{uuid.uuid4()}.mp4"
            url = await self._upload_file(output_file.name, EXPORTS_BUCKET, dest_path)

            return {
                "url": url,
                "duration": duration_a + duration_b - duration,
            }
        finally:
            os.unlink(file_a)
            os.unlink(file_b)
            os.unlink(output_file.name)

    async def render_transition_proxy(
        self,
        clip_a_url: str,
        clip_b_url: str,
        transition_type: str,
        duration: float,
        clip_a_end_time: float,
        clip_b_start_time: float,
        max_width: int = 640,
    ) -> Dict[str, Any]:
        """
        Render a short proxy video of JUST the transition overlap zone.

        Instead of the browser CSS-compositing two video streams in real-time,
        we pre-render the transition segment using FFmpeg xfade (same engine
        as the final export) and return a small proxy video the frontend can
        play as a single <video> element during the transition zone.

        Args:
            clip_a_url: URL of the outgoing clip (or its proxy)
            clip_b_url: URL of the incoming clip (or its proxy)
            transition_type: FFmpeg xfade transition name
            duration: Transition duration in seconds
            clip_a_end_time: End time of clip A on the timeline (seconds)
            clip_b_start_time: Start time of clip B on the timeline (seconds)
            max_width: Max width for the proxy output (default 640px)

        Returns:
            { url, duration, width, height }
        """
        file_a = await self._download_file(clip_a_url)
        file_b = await self._download_file(clip_b_url)
        trimmed_a = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False, dir=self.temp_dir)
        trimmed_b = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False, dir=self.temp_dir)
        output_file = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False, dir=self.temp_dir)

        try:
            # Probe both clips for duration and resolution
            info_a = self._run_ffprobe(file_a)
            info_b = self._run_ffprobe(file_b)
            duration_a = float(info_a["format"].get("duration", 5))
            duration_b = float(info_b["format"].get("duration", 5))

            # Figure out resolution for normalization
            video_stream_a = next((s for s in info_a.get("streams", []) if s.get("codec_type") == "video"), None)
            video_stream_b = next((s for s in info_b.get("streams", []) if s.get("codec_type") == "video"), None)

            # Use max_width and maintain aspect ratio from clip A
            if video_stream_a:
                orig_w = int(video_stream_a.get("width", 1280))
                orig_h = int(video_stream_a.get("height", 720))
            else:
                orig_w, orig_h = 1280, 720

            scale_factor = min(1.0, max_width / orig_w)
            out_w = int(orig_w * scale_factor)
            out_h = int(orig_h * scale_factor)
            # Ensure even dimensions (required by libx264)
            out_w = out_w + (out_w % 2)
            out_h = out_h + (out_h % 2)

            # Add a small padding so the xfade has clean edges
            padding = 0.1  # 100ms extra on each side

            # Trim clip A: take the LAST (duration + padding) seconds
            trim_a_duration = min(duration + padding, duration_a)
            trim_a_start = max(0, duration_a - trim_a_duration)

            # Trim clip B: take the FIRST (duration + padding) seconds
            trim_b_duration = min(duration + padding, duration_b)

            # Trim + normalize clip A
            self._run_ffmpeg([
                "-ss", str(trim_a_start),
                "-i", file_a,
                "-t", str(trim_a_duration),
                "-vf", f"scale={out_w}:{out_h}:force_original_aspect_ratio=decrease,pad={out_w}:{out_h}:(ow-iw)/2:(oh-ih)/2,setsar=1",
                "-c:v", "libx264", "-crf", "28", "-preset", "ultrafast",
                "-an",  # No audio for proxy — audio is handled separately
                "-vsync", "cfr",
                "-r", "30",
                "-pix_fmt", "yuv420p",
                trimmed_a.name,
            ])

            # Trim + normalize clip B
            self._run_ffmpeg([
                "-i", file_b,
                "-t", str(trim_b_duration),
                "-vf", f"scale={out_w}:{out_h}:force_original_aspect_ratio=decrease,pad={out_w}:{out_h}:(ow-iw)/2:(oh-ih)/2,setsar=1",
                "-c:v", "libx264", "-crf", "28", "-preset", "ultrafast",
                "-an",
                "-vsync", "cfr",
                "-r", "30",
                "-pix_fmt", "yuv420p",
                trimmed_b.name,
            ])

            # Get actual trimmed durations (may differ slightly)
            info_trimmed_a = self._run_ffprobe(trimmed_a.name)
            actual_dur_a = float(info_trimmed_a["format"].get("duration", trim_a_duration))

            # Map transition type
            xfade_map = {
                "fade": "fade", "crossfade": "fade",
                "fadeblack": "fadeblack", "fadewhite": "fadewhite", "dissolve": "dissolve",
                "wipeleft": "wipeleft", "wiperight": "wiperight",
                "wipeup": "wipeup", "wipedown": "wipedown",
                "slideleft": "slideleft", "slideright": "slideright",
                "slideup": "slideup", "slidedown": "slidedown",
                "coverleft": "coverleft", "coverright": "coverright",
                "coverup": "coverup", "coverdown": "coverdown",
                "revealleft": "revealleft", "revealright": "revealright",
                "revealup": "revealup", "revealdown": "revealdown",
                "zoomin": "zoomin", "zoom": "zoomin",
                "circleopen": "circleopen", "circleclose": "circleclose",
                "circlecrop": "circlecrop", "radial": "radial",
                "pixelize": "pixelize", "hblur": "hblur",
                "smoothleft": "smoothleft", "smoothright": "smoothright",
                "smoothup": "smoothup", "smoothdown": "smoothdown",
                "diagtl": "diagtl", "diagtr": "diagtr",
                "diagbl": "diagbl", "diagbr": "diagbr",
                "squeezev": "squeezev", "squeezeh": "squeezeh",
                "hlslice": "hlslice", "hrslice": "hrslice",
                "vuslice": "vuslice", "vdslice": "vdslice",
                "horzopen": "horzopen", "horzclose": "horzclose",
                "vertopen": "vertopen", "vertclose": "vertclose",
            }
            xfade_type = xfade_map.get(transition_type.lower(), "fade")

            # Xfade offset = when transition starts relative to clip A start
            # Since we trimmed clip A to just the tail, offset = actual_dur_a - duration
            offset = max(0, actual_dur_a - duration)
            # Snap to frame boundary
            frame_dur = 1.0 / 30.0
            offset = round(offset / frame_dur) * frame_dur
            xfade_duration = round(duration / frame_dur) * frame_dur

            filter_complex = (
                f"[0:v][1:v]xfade=transition={xfade_type}"
                f":duration={xfade_duration}:offset={offset}[v]"
            )

            self._run_ffmpeg([
                "-i", trimmed_a.name,
                "-i", trimmed_b.name,
                "-filter_complex", filter_complex,
                "-map", "[v]",
                "-an",
                "-c:v", "libx264", "-crf", "26", "-preset", "fast",
                "-vsync", "cfr",
                "-r", "30",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",  # Enable streaming playback
                output_file.name,
            ])

            # Upload to proxies bucket
            import uuid
            dest_path = f"transition-proxies/{uuid.uuid4()}.mp4"
            url = await self._upload_file(output_file.name, PROXIES_BUCKET, dest_path)

            # Get output info
            output_info = self._run_ffprobe(output_file.name)
            output_duration = float(output_info["format"].get("duration", duration))

            return {
                "url": url,
                "duration": output_duration,
                "width": out_w,
                "height": out_h,
            }
        finally:
            for f in [file_a, file_b, trimmed_a.name, trimmed_b.name, output_file.name]:
                try:
                    os.unlink(f)
                except OSError:
                    pass

    async def composite_layers(
        self,
        project_id: str,
        base_video: str,
        layers: List[Dict[str, Any]],
        output_format: str = "mp4",
    ) -> Dict[str, Any]:
        """Composite multiple layers onto base video"""
        base_file = await self._download_file(base_video)
        layer_files = []
        output_file = tempfile.NamedTemporaryFile(
            suffix=f".{output_format}", delete=False, dir=self.temp_dir
        )

        try:
            # Download all layer files
            for layer in layers:
                layer_file = await self._download_file(layer["url"])
                layer_files.append(layer_file)

            # Build complex filter
            inputs = ["-i", base_file]
            for lf in layer_files:
                inputs.extend(["-i", lf])

            # Simple overlay for now
            filter_parts = []
            current_input = "0:v"
            
            for i, layer in enumerate(layers):
                x = layer.get("x", 0)
                y = layer.get("y", 0)
                output_label = f"v{i+1}"
                filter_parts.append(
                    f"[{current_input}][{i+1}:v]overlay={x}:{y}[{output_label}]"
                )
                current_input = output_label

            filter_complex = ";".join(filter_parts)

            self._run_ffmpeg(
                inputs + [
                    "-filter_complex", filter_complex,
                    "-map", f"[{current_input}]",
                    "-map", "0:a?",
                    "-c:v", "libx264",
                    "-crf", "23",
                    "-c:a", "copy",
                    output_file.name,
                ]
            )

            # Upload
            import uuid
            dest_path = f"{project_id}/composites/{uuid.uuid4()}.{output_format}"
            url = await self._upload_file(output_file.name, EXPORTS_BUCKET, dest_path)

            info = self._run_ffprobe(output_file.name)
            duration = float(info["format"].get("duration", 0))

            return {"url": url, "duration": duration}
        finally:
            os.unlink(base_file)
            for lf in layer_files:
                os.unlink(lf)
            os.unlink(output_file.name)

    async def render_timeline(
        self,
        project_id: str,
        timeline: Dict[str, Any],
        resolution: Tuple[int, int],
        format: str,
        frame_rate: int,
        include_audio: bool,
        transitions: List[Dict[str, Any]] = None,
        text_overlays: List[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Render full timeline to final video with transitions and text overlays"""
        transitions = transitions or []
        text_overlays = text_overlays or []
        
        print(f"[FFMPEG] Starting render_timeline for {project_id}")
        print(f"[FFMPEG] Resolution: {resolution}, Format: {format}, FPS: {frame_rate}")
        print(f"[FFMPEG] Transitions: {len(transitions)}, Text overlays: {len(text_overlays)}")
        for i, to in enumerate(text_overlays):
            print(f"[FFMPEG] Text overlay {i}: text='{to.get('text', '')[:30]}', pos={to.get('position')}, time={to.get('startTime')}-{to.get('endTime')}")
        
        output_file = tempfile.NamedTemporaryFile(
            suffix=f".{format}", delete=False, dir=self.temp_dir
        )
        downloaded_files = []

        try:
            tracks = timeline.get("tracks", [])
            video_track = next((t for t in tracks if t["type"] == "video"), None)
            
            if not video_track or not video_track.get("clips"):
                raise Exception("No video clips in timeline")

            clips = video_track["clips"]
            width, height = resolution
            
            print(f"[FFMPEG] Found {len(clips)} clips to process")

            # Download all clips
            clip_files = {}  # id -> file path
            for i, clip in enumerate(clips):
                print(f"[FFMPEG] Downloading clip {i+1}/{len(clips)}: {clip.get('source', 'NO SOURCE')[:80]}")
                try:
                    file = await self._download_file(clip["source"])
                    downloaded_files.append(file)
                    clip_files[clip["id"]] = file
                    print(f"[FFMPEG] Downloaded to: {file}")
                except Exception as e:
                    print(f"[FFMPEG] Warning: Download failed for clip {clip['id']}, skipping: {str(e)}")

            # Filter out clips that failed to download
            skipped_ids = {c["id"] for c in clips if c["id"] not in clip_files}
            clips = [c for c in clips if c["id"] in clip_files]
            if not clips:
                raise Exception("All clip downloads failed - nothing to render")
            if skipped_ids:
                print(f"[FFMPEG] Skipped {len(skipped_ids)} clips with failed downloads")
                # Remove transitions that reference skipped clips
                transitions = [t for t in transitions if t.get("clipAId") not in skipped_ids and t.get("clipBId") not in skipped_ids]
            print(f"[FFMPEG] Proceeding with {len(clips)} clips, {len(transitions)} transitions")

            # First, normalize all clips to same resolution and codec
            normalized_files = []
            clip_durations = []  # Store durations for transition calculations
            for i, clip in enumerate(clips):
                norm_file = tempfile.NamedTemporaryFile(
                    suffix=".mp4", delete=False, dir=self.temp_dir
                )
                downloaded_files.append(norm_file.name)
                
                # Calculate clip duration from timeline data
                clip_duration = clip.get("end", 5) - clip.get("start", 0)
                source_file = clip_files[clip["id"]]
                is_image = self._is_image_file(source_file)
                
                # Build normalize args based on media type
                if is_image:
                    # For images: loop the image for the clip duration
                    # IMPORTANT: All inputs must come before output options
                    print(f"[FFMPEG] Converting image to video: {source_file}")
                    normalize_args = [
                        # Image input
                        "-loop", "1",
                        "-i", source_file,
                        # Silent audio input (must come after image input, before output options)
                        "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                        # Output options (must come after ALL inputs)
                        "-t", str(clip_duration),
                        "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,fps={frame_rate}",
                        "-c:v", "libx264",
                        "-preset", "fast",
                        "-crf", "18",
                        "-pix_fmt", "yuv420p",
                        "-c:a", "aac",
                        "-ar", "48000",
                        "-ac", "2",
                        "-b:a", "192k",
                        "-shortest",
                        "-map", "0:v", "-map", "1:a",  # Explicitly map video from input 0, audio from input 1
                        norm_file.name
                    ]
                else:
                    # For videos: check if source has audio, add silent audio if not
                    source_info = self._run_ffprobe(source_file)
                    source_has_audio = any(s.get("codec_type") == "audio" for s in source_info.get("streams", []))
                    
                    if source_has_audio:
                        # Video has audio - normalize normally
                        normalize_args = [
                            "-i", source_file,
                            "-t", str(clip_duration),
                            "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,fps={frame_rate}",
                            "-c:v", "libx264",
                            "-preset", "fast",
                            "-crf", "18",
                            "-c:a", "aac",
                            "-ar", "48000",
                            "-ac", "2",
                            "-b:a", "192k",
                            norm_file.name
                        ]
                    else:
                        # Video has NO audio - add silent audio track
                        print(f"[FFMPEG] Video has no audio, adding silent audio track")
                        normalize_args = [
                            "-i", source_file,
                            "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                            "-t", str(clip_duration),
                            "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,fps={frame_rate}",
                            "-c:v", "libx264",
                            "-preset", "fast",
                            "-crf", "18",
                            "-c:a", "aac",
                            "-ar", "48000",
                            "-ac", "2",
                            "-b:a", "192k",
                            "-shortest",
                            "-map", "0:v", "-map", "1:a",
                            norm_file.name
                        ]
                print(f"[FFMPEG] Normalizing clip {i+1}/{len(clips)} (duration: {clip_duration:.2f}s, isImage: {is_image})")
                self._run_ffmpeg(normalize_args)
                normalized_files.append(norm_file.name)
                
                # Get actual duration from normalized file
                info = self._run_ffprobe(norm_file.name)
                actual_duration = float(info["format"].get("duration", clip_duration))
                clip_durations.append(actual_duration)
                print(f"[FFMPEG] Clip {i+1} actual duration: {actual_duration:.2f}s")

            # Build transition lookup: clipBId -> transition
            transition_map = {}
            for t in transitions:
                transition_map[t.get("clipBId")] = t
            
            # Decide rendering method
            has_transitions = len(transitions) > 0 and len(clips) > 1
            
            if has_transitions:
                print(f"[FFMPEG] Using xfade transitions for {len(transitions)} transitions")
                await self._render_with_transitions(
                    normalized_files, clip_durations, clips, transitions,
                    text_overlays, timeline, output_file.name,
                    width, height, frame_rate, include_audio
                )
            else:
                print(f"[FFMPEG] Using simple concat (no transitions)")
                await self._render_simple_concat(
                    normalized_files, text_overlays, timeline, output_file.name,
                    width, height, include_audio
                )

            # Check output file exists
            if not os.path.exists(output_file.name):
                raise Exception(f"FFmpeg failed to create output file: {output_file.name}")

            output_size = os.path.getsize(output_file.name)
            print(f"[FFMPEG] Output file created: {output_file.name} ({output_size} bytes)")

            # --- Mix in separate audio tracks ---
            audio_tracks = [t for t in tracks if t.get("type") == "audio" and t.get("clips")]
            if audio_tracks and include_audio:
                print(f"[FFMPEG] Found {len(audio_tracks)} audio track(s) with clips to mix in")
                audio_clip_files = []
                try:
                    for atrack in audio_tracks:
                        for aclip in atrack.get("clips", []):
                            audio_source = aclip.get("source")
                            if not audio_source:
                                continue
                            try:
                                afile = await self._download_file(audio_source)
                                downloaded_files.append(afile)
                                audio_clip_files.append({
                                    "file": afile,
                                    "start": aclip.get("start", 0),
                                    "end": aclip.get("end", None),
                                    "volume": aclip.get("volume", 1.0),
                                })
                            except Exception as ae:
                                print(f"[FFMPEG] Warning: failed to download audio clip, skipping: {ae}")

                    if audio_clip_files:
                        mixed_output = tempfile.NamedTemporaryFile(
                            suffix=f".{format}", delete=False, dir=self.temp_dir
                        )
                        downloaded_files.append(mixed_output.name)

                        # Build FFmpeg command to mix audio tracks onto the rendered video
                        mix_inputs = ["-i", output_file.name]
                        filter_parts = []
                        mix_labels = []

                        for idx, ac in enumerate(audio_clip_files):
                            mix_inputs.extend(["-i", ac["file"]])
                            inp_idx = idx + 1  # 0 is the video file
                            vol = ac.get("volume", 1.0)
                            start = ac.get("start", 0)
                            # Delay audio to its timeline position and set volume
                            delay_ms = int(start * 1000)
                            label = f"aud{idx}"
                            filter_parts.append(
                                f"[{inp_idx}:a]adelay={delay_ms}|{delay_ms},volume={vol}[{label}]"
                            )
                            mix_labels.append(f"[{label}]")

                        # Mix: video's existing audio + all audio track clips
                        all_audio = f"[0:a]{''.join(mix_labels)}amix=inputs={len(audio_clip_files) + 1}:duration=longest:normalize=0[amixed]"
                        filter_parts.append(all_audio)
                        full_filter = ";".join(filter_parts)

                        mix_args = mix_inputs + [
                            "-filter_complex", full_filter,
                            "-map", "0:v",
                            "-map", "[amixed]",
                            "-c:v", "copy",
                            "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k",
                            mixed_output.name,
                        ]
                        print(f"[FFMPEG] Mixing {len(audio_clip_files)} audio clip(s) into final video")
                        self._run_ffmpeg(mix_args)

                        # Replace the output file with the mixed version
                        os.unlink(output_file.name)
                        os.rename(mixed_output.name, output_file.name)
                        # Remove from downloaded_files since we renamed it
                        downloaded_files.remove(mixed_output.name)

                        output_size = os.path.getsize(output_file.name)
                        print(f"[FFMPEG] Audio mixed output: {output_file.name} ({output_size} bytes)")
                except Exception as audio_err:
                    print(f"[FFMPEG] WARNING: Audio track mixing failed: {str(audio_err)}")
                    print(f"[FFMPEG] Continuing with video-only output")

            # Upload
            import uuid
            dest_path = f"{project_id}/exports/{uuid.uuid4()}.{format}"
            print(f"[FFMPEG] Uploading to Supabase: {EXPORTS_BUCKET}/{dest_path}")
            url = await self._upload_file(output_file.name, EXPORTS_BUCKET, dest_path)
            print(f"[FFMPEG] Upload complete: {url}")

            info = self._run_ffprobe(output_file.name)
            duration = float(info["format"].get("duration", 0))
            file_size = os.path.getsize(output_file.name)

            result = {"url": url, "duration": duration, "file_size": file_size}
            if skipped_ids:
                result["skipped_clips"] = len(skipped_ids)
            return result
        finally:
            for f in downloaded_files:
                try:
                    os.unlink(f)
                except:
                    pass
            try:
                os.unlink(output_file.name)
            except:
                pass

    async def _render_with_transitions(
        self,
        normalized_files: List[str],
        clip_durations: List[float],
        clips: List[Dict],
        transitions: List[Dict],
        text_overlays: List[Dict],
        timeline: Dict,
        output_path: str,
        width: int,
        height: int,
        frame_rate: int,
        include_audio: bool
    ):
        """Render video with xfade transitions between clips"""
        print(f"[FFMPEG] _render_with_transitions called with {len(normalized_files)} clips, {len(transitions)} transitions")
        
        # Log all transitions received
        for i, t in enumerate(transitions):
            print(f"[FFMPEG] Received transition {i+1}: type='{t.get('type')}' clipAId='{t.get('clipAId')}' clipBId='{t.get('clipBId')}' duration={t.get('duration')}")
        
        # Log all clip IDs
        for i, c in enumerate(clips):
            print(f"[FFMPEG] Clip {i+1} ID: '{c.get('id')}'")
        
        # Build transition lookup: clipBId -> transition
        transition_map = {}
        for t in transitions:
            transition_map[t.get("clipBId")] = t
        
        print(f"[FFMPEG] Transition map keys: {list(transition_map.keys())}")
        
        # Also create a position-based transition lookup
        # Sort transitions by startTime for position-based matching
        sorted_transitions = sorted(transitions, key=lambda t: t.get("startTime", 0))
        print(f"[FFMPEG] Sorted transitions by startTime: {[(t.get('type'), t.get('startTime'), t.get('duration')) for t in sorted_transitions]}")
        
        # Map transition types to FFmpeg xfade names
        # Must match every id from /transitions/types endpoint
        xfade_types = {
            # Subtle / Professional
            "cut": "fade",
            "fade": "fade",
            "crossfade": "fade",
            "fadeblack": "fadeblack",
            "fadewhite": "fadewhite",
            "dissolve": "dissolve",

            # Directional Wipes
            "wipe": "wipeleft",
            "wipeleft": "wipeleft",
            "wiperight": "wiperight",
            "wipeup": "wipeup",
            "wipedown": "wipedown",

            # Slides
            "slideleft": "slideleft",
            "slideright": "slideright",
            "slideup": "slideup",
            "slidedown": "slidedown",

            # Cover / Reveal
            "coverleft": "coverleft",
            "coverright": "coverright",
            "coverup": "coverup",
            "coverdown": "coverdown",
            "revealleft": "revealleft",
            "revealright": "revealright",
            "revealup": "revealup",
            "revealdown": "revealdown",

            # Dynamic / CapCut-style
            "zoomin": "zoomin",
            "zoom": "zoomin",
            "circleopen": "circleopen",
            "circleclose": "circleclose",
            "circlecrop": "circlecrop",
            "pixelize": "pixelize",
            "radial": "radial",
            "hblur": "hblur",

            # Cinematic
            "smoothleft": "smoothleft",
            "smoothright": "smoothright",
            "smoothup": "smoothup",
            "smoothdown": "smoothdown",
            "diagtl": "diagtl",
            "diagtr": "diagtr",
            "diagbl": "diagbl",
            "diagbr": "diagbr",
            "squeezev": "squeezev",
            "squeezeh": "squeezeh",

            # Additional slice/open/close
            "hlslice": "hlslice",
            "hrslice": "hrslice",
            "vuslice": "vuslice",
            "vdslice": "vdslice",
            "horzopen": "horzopen",
            "horzclose": "horzclose",
            "vertopen": "vertopen",
            "vertclose": "vertclose",

            # Legacy camelCase aliases
            "wipeLeft": "wipeleft",
            "wipeRight": "wiperight",
            "wipeUp": "wipeup",
            "wipeDown": "wipedown",
            "slideLeft": "slideleft",
            "slideRight": "slideright",
            "slideUp": "slideup",
            "slideDown": "slidedown",
        }

        # Frame duration for snapping offsets to frame boundaries
        frame_dur = 1.0 / frame_rate

        # Normalization already ensures all clips have audio (silent if needed),
        # so we always try to include audio. Verify anyway for safety.
        clips_with_audio = []
        for i, f in enumerate(normalized_files):
            info = self._run_ffprobe(f)
            has_audio = any(s.get("codec_type") == "audio" for s in info.get("streams", []))
            clips_with_audio.append(has_audio)
            if not has_audio:
                print(f"[FFMPEG] WARNING: Clip {i+1} missing audio after normalization, adding silent track")
                # Re-mux with silent audio
                fixed_file = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False, dir=self.temp_dir)
                self._run_ffmpeg([
                    "-i", f,
                    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                    "-c:v", "copy",
                    "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k",
                    "-shortest",
                    "-map", "0:v", "-map", "1:a",
                    fixed_file.name,
                ])
                # Replace the file in-place
                os.unlink(f)
                os.rename(fixed_file.name, f)
                clips_with_audio[i] = True

        all_have_audio = all(clips_with_audio)
        print(f"[FFMPEG] Audio status after fix-up: all_have_audio={all_have_audio}")

        # Build FFmpeg command with xfade filter chain
        inputs = []
        for f in normalized_files:
            inputs.extend(["-i", f])

        # Build xfade filter chain
        filter_parts = []
        current_offset = 0

        for i in range(len(normalized_files) - 1):
            clip_id = clips[i + 1]["id"] if i + 1 < len(clips) else None

            # Try ID-based lookup first
            trans = transition_map.get(clip_id, None)

            # If ID-based lookup fails, try position-based (use transition at index i)
            if trans is None and i < len(sorted_transitions):
                trans = sorted_transitions[i]
                print(f"[FFMPEG] ID lookup failed for clipBId={clip_id}, using position-based transition {i+1}")
            elif trans is None:
                trans = {}

            trans_type = trans.get("type", "fade")
            # Ensure minimum duration of 0.1s for transitions
            trans_duration = max(0.1, min(trans.get("duration", 0.5), clip_durations[i] * 0.4, clip_durations[i + 1] * 0.4))
            # Snap transition duration to frame boundary to prevent sub-frame glitches
            trans_duration = round(trans_duration / frame_dur) * frame_dur
            trans_duration = max(frame_dur, trans_duration)  # At least one frame
            xfade_name = xfade_types.get(trans_type, "fade")

            print(f"[FFMPEG] Transition {i+1}: clipBId={clip_id}, requested_type='{trans_type}' -> xfade='{xfade_name}'")

            # Calculate offset (when transition starts) and snap to frame boundary
            offset = current_offset + clip_durations[i] - trans_duration
            offset = round(offset / frame_dur) * frame_dur
            offset = max(0, offset)  # Never negative

            if i == 0:
                # First transition: [0:v][1:v]xfade=...
                filter_parts.append(
                    f"[0:v][1:v]xfade=transition={xfade_name}:duration={trans_duration}:offset={offset}[v{i}]"
                )
            else:
                # Subsequent transitions: [prev][N:v]xfade=...
                filter_parts.append(
                    f"[v{i-1}][{i+1}:v]xfade=transition={xfade_name}:duration={trans_duration}:offset={offset}[v{i}]"
                )

            # Update offset for next clip (accounting for overlap)
            current_offset = offset

            print(f"[FFMPEG] Transition {i+1}: {trans_type} ({xfade_name}), duration={trans_duration:.4f}s, offset={offset:.4f}s")

        # Add text overlays to final video output
        last_video = f"[v{len(normalized_files) - 2}]" if len(normalized_files) > 1 else "[0:v]"

        if text_overlays:
            text_filter = ""
            for text in text_overlays:
                text_content = text.get("text", "").replace("\\", "\\\\").replace("'", "\\'").replace(":", "\\:")
                pos = text.get("position") or {}
                # Position can be 0-100 (percentage) or 0-1 (fraction) — normalize
                raw_x = pos.get("x", 50)
                raw_y = pos.get("y", 10)
                x = (raw_x / 100.0 * width) if raw_x > 1 else (raw_x * width)
                y = (raw_y / 100.0 * height) if raw_y > 1 else (raw_y * height)
                font_size = text.get("fontSize", 48)
                font_color = text.get("fontColor", "white")
                start_time = text.get("startTime", 0)
                end_time = text.get("endTime", timeline.get("duration", 10))
                font_file = self._resolve_font(text.get("fontFamily"), text.get("fontWeight", 400))

                text_filter += f"drawtext=text='{text_content}':fontfile='{font_file}':fontcolor={font_color}:fontsize={font_size}:x={int(x)}:y={int(y)}:enable='between(t\\,{start_time}\\,{end_time})',"

            text_filter = text_filter.rstrip(",")
            filter_parts.append(f"{last_video}{text_filter}[vout]")
            last_video = "[vout]"
            print(f"[FFMPEG] Text overlay filter applied: {len(text_overlays)} overlay(s)")

        # Handle audio — normalization guarantees all clips have audio (real or silent)
        audio_filter = ""
        audio_output = None
        if include_audio and all_have_audio and len(normalized_files) > 1:
            # Build audio crossfade chain to match video transitions
            audio_parts = []

            for i in range(len(normalized_files) - 1):
                clip_id = clips[i + 1]["id"] if i + 1 < len(clips) else None
                trans = transition_map.get(clip_id, {})
                if trans is None and i < len(sorted_transitions):
                    trans = sorted_transitions[i]
                if trans is None:
                    trans = {}
                trans_duration = max(0.1, min(trans.get("duration", 0.5), clip_durations[i] * 0.4, clip_durations[i + 1] * 0.4))
                trans_duration = round(trans_duration / frame_dur) * frame_dur
                trans_duration = max(frame_dur, trans_duration)

                if i == 0:
                    audio_parts.append(
                        f"[0:a][1:a]acrossfade=d={trans_duration}:c1=tri:c2=tri[a{i}]"
                    )
                else:
                    audio_parts.append(
                        f"[a{i-1}][{i+1}:a]acrossfade=d={trans_duration}:c1=tri:c2=tri[a{i}]"
                    )

            audio_filter = ";" + ";".join(audio_parts)
            audio_output = f"[a{len(normalized_files) - 2}]"
            print(f"[FFMPEG] Audio crossfade enabled with {len(audio_parts)} transitions")
        elif include_audio and len(normalized_files) == 1:
            audio_output = "[0:a]"
        elif include_audio and len(normalized_files) > 1 and not all_have_audio:
            # Fallback: concat audio streams without crossfade
            concat_parts = "".join(f"[{i}:a]" for i in range(len(normalized_files)))
            audio_filter = f";{concat_parts}concat=n={len(normalized_files)}:v=0:a=1[aout]"
            audio_output = "[aout]"
            print(f"[FFMPEG] Audio concat fallback (not all clips have audio)")
        else:
            print(f"[FFMPEG] Skipping audio (include_audio={include_audio})")

        # Build complete filter_complex
        video_filter = ";".join(filter_parts)
        full_filter = video_filter + audio_filter

        print(f"[FFMPEG] Filter complex: {full_filter[:500]}...")

        # Build output args
        output_args = inputs + ["-filter_complex", full_filter]

        # Map outputs
        if last_video == "[vout]":
            output_args.extend(["-map", "[vout]"])
        else:
            output_args.extend(["-map", last_video])

        if audio_output:
            output_args.extend(["-map", audio_output])
        else:
            output_args.append("-an")

        output_args.extend([
            "-c:v", "libx264",
            "-crf", "18",
            "-preset", "fast",
            "-vsync", "cfr",  # Constant frame rate to prevent timing glitches
            "-pix_fmt", "yuv420p",
        ])

        if audio_output:
            output_args.extend(["-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k"])

        output_args.append(output_path)
        
        print(f"[FFMPEG] Running xfade render with filter_complex")
        self._run_ffmpeg(output_args)

    async def _render_simple_concat(
        self,
        normalized_files: List[str],
        text_overlays: List[Dict],
        timeline: Dict,
        output_path: str,
        width: int,
        height: int,
        include_audio: bool
    ):
        """Render video with simple concatenation (no transitions)"""
        # Create concat file
        concat_file = tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False, dir=self.temp_dir
        )
        for nf in normalized_files:
            concat_file.write(f"file '{nf}'\n")
        concat_file.close()
        
        print(f"[FFMPEG] Concatenating {len(normalized_files)} normalized clips")
        
        # Build video filter for text overlays
        video_filter = None
        if text_overlays:
            filter_parts = []
            for text in text_overlays:
                text_content = text.get("text", "").replace("\\", "\\\\").replace("'", "\\'").replace(":", "\\:")
                pos = text.get("position") or {}
                # Position can be 0-100 (percentage) or 0-1 (fraction) — normalize
                raw_x = pos.get("x", 50)
                raw_y = pos.get("y", 10)
                x = (raw_x / 100.0 * width) if raw_x > 1 else (raw_x * width)
                y = (raw_y / 100.0 * height) if raw_y > 1 else (raw_y * height)
                font_size = text.get("fontSize", 48)
                font_color = text.get("fontColor", "white")
                start_time = text.get("startTime", 0)
                end_time = text.get("endTime", timeline.get("duration", 10))
                font_file = self._resolve_font(text.get("fontFamily"), text.get("fontWeight", 400))
                filter_parts.append(
                    f"drawtext=text='{text_content}':fontfile='{font_file}':fontcolor={font_color}:fontsize={font_size}:x={int(x)}:y={int(y)}:enable='between(t,{start_time},{end_time})'"
                )
            video_filter = ",".join(filter_parts)
            print(f"[FFMPEG] Text overlay filter applied (simple concat): {len(text_overlays)} overlay(s)")
        
        # Final concat command
        concat_args = [
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file.name,
        ]
        
        if video_filter:
            concat_args.extend(["-vf", video_filter])
        
        concat_args.extend([
            "-c:v", "libx264",
            "-crf", "18",
            "-preset", "fast",
            "-c:a", "aac" if include_audio else "copy",
        ])
        
        if not include_audio:
            concat_args.append("-an")
        
        concat_args.append(output_path)
        
        self._run_ffmpeg(concat_args)
        
        try:
            os.unlink(concat_file.name)
        except:
            pass

    async def generate_thumbnails(
        self, video_url: str, timestamps: List[float], width: int
    ) -> Dict[str, Any]:
        """Generate thumbnails at specified timestamps"""
        input_file = await self._download_file(video_url)
        thumbnails = []

        try:
            for ts in timestamps:
                output_file = tempfile.NamedTemporaryFile(
                    suffix=".jpg", delete=False, dir=self.temp_dir
                )
                
                self._run_ffmpeg([
                    "-ss", str(ts),
                    "-i", input_file,
                    "-vframes", "1",
                    "-vf", f"scale={width}:-1",
                    output_file.name,
                ])

                import uuid
                dest_path = f"thumbnails/{uuid.uuid4()}.jpg"
                url = await self._upload_file(output_file.name, PROXIES_BUCKET, dest_path)
                thumbnails.append(url)
                os.unlink(output_file.name)

            return {"thumbnails": thumbnails}
        finally:
            os.unlink(input_file)

    async def generate_waveform(
        self,
        audio_url: str,
        width: int,
        height: int,
        color: str,
        background_color: str,
    ) -> Dict[str, Any]:
        """Generate waveform visualization"""
        input_file = await self._download_file(audio_url, suffix=".mp3")
        output_file = tempfile.NamedTemporaryFile(
            suffix=".png", delete=False, dir=self.temp_dir
        )

        try:
            self._run_ffmpeg([
                "-i", input_file,
                "-filter_complex",
                f"showwavespic=s={width}x{height}:colors={color}",
                "-frames:v", "1",
                output_file.name,
            ])

            import uuid
            dest_path = f"waveforms/{uuid.uuid4()}.png"
            url = await self._upload_file(output_file.name, PROXIES_BUCKET, dest_path)

            return {"url": url}
        finally:
            os.unlink(input_file)
            os.unlink(output_file.name)

    async def apply_mask(
        self,
        project_id: str,
        video_url: str,
        mask_url: str,
        fill_type: str = "blur",
        fill_value: str = None,
        invert: bool = False,
    ) -> Dict[str, Any]:
        """
        Apply a mask to a video. The mask (from SAM2) marks the target element.

        fill_type options:
        - "blur": Gaussian blur the masked region
        - "color": Tint/shift the color in the masked region (fill_value = hex color like "#FF0000")
        - "transparent": Make masked region transparent (outputs webm with alpha)
        - "replace": Overlay a replacement image in the masked region (fill_value = image URL)
        """
        video_file = await self._download_file(video_url, suffix=".mp4")
        mask_file = await self._download_file(mask_url)
        replace_file = None
        output_suffix = ".webm" if fill_type == "transparent" else ".mp4"
        output_file = tempfile.NamedTemporaryFile(
            suffix=output_suffix, delete=False, dir=self.temp_dir
        )

        try:
            # Build FFmpeg filter based on fill_type
            invert_suffix = ",negate" if invert else ""

            # Prepare mask: convert to grayscale, scale to match video dimensions
            # Get video dimensions first via ffprobe
            video_info = self._run_ffprobe(video_file)
            v_stream = next((s for s in video_info.get("streams", []) if s.get("codec_type") == "video"), {})
            vw = v_stream.get("width", 1280)
            vh = v_stream.get("height", 720)
            mask_prep = f"[1:v]scale={vw}:{vh}:flags=bilinear,format=gray{invert_suffix}[mask]"

            if fill_type == "blur":
                # Blur the masked region
                filter_complex = (
                    f"[0:v]split[orig][toblur];"
                    f"{mask_prep};"
                    f"[toblur]gblur=sigma=30[blurred];"
                    f"[orig][blurred][mask]maskedmerge[out]"
                )
            elif fill_type == "color" and fill_value:
                # Color change in masked region using colorchannelmixer
                # This actually changes colors (even dark/black) by cross-mixing channels
                hex_color = fill_value.lstrip("#")
                r = int(hex_color[0:2], 16) / 255.0
                g = int(hex_color[2:4], 16) / 255.0
                b = int(hex_color[4:6], 16) / 255.0

                # colorchannelmixer: each output channel is a weighted sum of input channels
                # For target color, we mix all input channels toward the target
                # This preserves luminance (texture/detail) while shifting color
                # rr=how much input-red → output-red, rg=how much input-green → output-red, etc.
                rr = 0.2 + r * 0.6
                rg = r * 0.3
                rb = r * 0.3
                gr = g * 0.3
                gg = 0.2 + g * 0.6
                gb = g * 0.3
                br = b * 0.3
                bg = b * 0.3
                bb = 0.2 + b * 0.6

                mixer = (
                    f"colorchannelmixer="
                    f"rr={rr:.2f}:rg={rg:.2f}:rb={rb:.2f}:"
                    f"gr={gr:.2f}:gg={gg:.2f}:gb={gb:.2f}:"
                    f"br={br:.2f}:bg={bg:.2f}:bb={bb:.2f}"
                )

                filter_complex = (
                    f"[0:v]split[orig][tocolor];"
                    f"{mask_prep};"
                    f"[tocolor]{mixer}[colored];"
                    f"[orig][colored][mask]maskedmerge[out]"
                )
            elif fill_type == "replace" and fill_value:
                # Download replacement image/video
                replace_file = await self._download_file(fill_value)

                filter_complex = (
                    f"{mask_prep};"
                    f"[2:v]scale={vw}:{vh}:flags=bilinear[replacement];"
                    f"[0:v][replacement][mask]maskedmerge[out]"
                )
            elif fill_type == "transparent":
                # Make masked area transparent
                filter_complex = (
                    f"{mask_prep};"
                    f"[mask]negate[alphamask];"
                    f"[0:v][alphamask]alphamerge[out]"
                )
            else:
                # Default: blur
                filter_complex = (
                    f"[0:v]split[orig][toblur];"
                    f"{mask_prep};"
                    f"[toblur]gblur=sigma=30[blurred];"
                    f"[orig][blurred][mask]maskedmerge[out]"
                )

            # Build command
            inputs = ["-i", video_file, "-i", mask_file]
            if replace_file:
                inputs.extend(["-i", replace_file])

            codec_args = []
            if fill_type == "transparent":
                codec_args = ["-c:v", "libvpx-vp9", "-auto-alt-ref", "0", "-pix_fmt", "yuva420p"]
            else:
                codec_args = ["-c:v", "libx264", "-crf", "23", "-preset", "fast"]

            print(f"[FFMPEG] apply_mask: fill_type={fill_type}, fill_value={fill_value}, invert={invert}")
            self._run_ffmpeg(
                inputs + [
                    "-filter_complex", filter_complex,
                    "-map", "[out]",
                    "-map", "0:a?",
                    "-c:a", "copy",
                ] + codec_args + [
                    output_file.name,
                ]
            )

            # Upload result
            import uuid
            dest_path = f"{project_id}/element-edits/{uuid.uuid4()}{output_suffix}"
            url = await self._upload_file(output_file.name, EXPORTS_BUCKET, dest_path)
            print(f"[FFMPEG] apply_mask result uploaded: {url}")

            return {"url": url}
        finally:
            os.unlink(video_file)
            os.unlink(mask_file)
            if replace_file:
                os.unlink(replace_file)
            os.unlink(output_file.name)
    async def color_grade(self, **kwargs): pass
    async def crop(self, **kwargs): pass
    async def change_speed(self, **kwargs): pass
    async def preview_transition(self, **kwargs): pass
    async def concat_clips(self, **kwargs): pass
    async def mix_audio(self, **kwargs): pass
    async def render_preview(self, **kwargs): pass

    # ============================================================
    # TEXT OVERLAY METHODS
    # ============================================================

    async def add_text_overlay(
        self,
        project_id: str,
        video_url: str,
        text: str,
        x: str = "(w-text_w)/2",
        y: str = "h-th-40",
        font_size: int = 48,
        font_color: str = "white",
        font_file: str = "/app/fonts/Inter-Bold.ttf",
        start_time: float = 0.0,
        end_time: float = None,
        box: bool = True,
        box_color: str = "black@0.5",
        box_border: int = 10,
        shadow_x: int = 2,
        shadow_y: int = 2,
        shadow_color: str = "black@0.8",
    ) -> Dict[str, Any]:
        """
        Add text overlay to video using FFmpeg drawtext filter.
        Server-side rendering ensures consistent fonts across devices.
        """
        input_file = await self._download_file(video_url)
        output_file = tempfile.NamedTemporaryFile(
            suffix=".mp4", delete=False, dir=self.temp_dir
        )

        try:
            # Escape special characters in text
            escaped_text = text.replace("'", "'\\''").replace(":", "\\:")
            
            # Build timing filter
            if end_time:
                enable = f"between(t,{start_time},{end_time})"
            else:
                enable = f"gte(t,{start_time})"

            # Build drawtext filter
            drawtext_parts = [
                f"fontfile={font_file}",
                f"text='{escaped_text}'",
                f"fontsize={font_size}",
                f"fontcolor={font_color}",
                f"x={x}",
                f"y={y}",
                f"shadowx={shadow_x}",
                f"shadowy={shadow_y}",
                f"shadowcolor={shadow_color}",
                f"enable='{enable}'",
            ]
            
            if box:
                drawtext_parts.extend([
                    f"box=1",
                    f"boxcolor={box_color}",
                    f"boxborderw={box_border}",
                ])

            drawtext_filter = "drawtext=" + ":".join(drawtext_parts)

            self._run_ffmpeg([
                "-i", input_file,
                "-vf", drawtext_filter,
                "-c:v", "libx264",
                "-crf", "18",
                "-c:a", "copy",
                output_file.name,
            ])

            # Get duration and upload
            info = self._run_ffprobe(output_file.name)
            duration = float(info["format"].get("duration", 0))

            import uuid
            dest_path = f"{project_id}/text_overlay_{uuid.uuid4()}.mp4"
            url = await self._upload_file(output_file.name, EXPORTS_BUCKET, dest_path)

            return {"url": url, "duration": duration}
        finally:
            os.unlink(input_file)
            os.unlink(output_file.name)

    async def add_fade_text(
        self,
        project_id: str,
        video_url: str,
        text: str,
        x: str = "(w-text_w)/2",
        y: str = "h/2",
        font_size: int = 48,
        font_color: str = "white",
        font_file: str = "/app/fonts/Inter-Bold.ttf",
        start_time: float = 0.0,
        fade_in: float = 0.5,
        hold: float = 2.0,
        fade_out: float = 0.5,
        box: bool = True,
        box_color: str = "black@0.5",
        shadow_x: int = 2,
        shadow_y: int = 2,
        shadow_color: str = "black@0.8",
    ) -> Dict[str, Any]:
        """
        Add text that fades in, holds, then fades out.
        Uses FFmpeg alpha filter for smooth animation.
        """
        input_file = await self._download_file(video_url)
        output_file = tempfile.NamedTemporaryFile(
            suffix=".mp4", delete=False, dir=self.temp_dir
        )

        try:
            escaped_text = text.replace("'", "'\\''").replace(":", "\\:")
            
            # Calculate timing
            t1 = start_time + fade_in
            t2 = t1 + hold
            t3 = t2 + fade_out
            
            # Alpha expression: fade in -> hold at 1 -> fade out
            # if t < start: 0
            # if start <= t < t1: (t-start)/fade_in  (fade in)
            # if t1 <= t < t2: 1 (hold)
            # if t2 <= t < t3: (t3-t)/fade_out (fade out)
            # if t >= t3: 0
            alpha_expr = (
                f"if(lt(t,{start_time}),0,"
                f"if(lt(t,{t1}),(t-{start_time})/{fade_in},"
                f"if(lt(t,{t2}),1,"
                f"if(lt(t,{t3}),({t3}-t)/{fade_out},0))))"
            )

            drawtext_parts = [
                f"fontfile={font_file}",
                f"text='{escaped_text}'",
                f"fontsize={font_size}",
                f"fontcolor={font_color}",
                f"alpha='{alpha_expr}'",
                f"x={x}",
                f"y={y}",
                f"shadowx={shadow_x}",
                f"shadowy={shadow_y}",
                f"shadowcolor={shadow_color}",
            ]
            
            if box:
                drawtext_parts.extend([
                    f"box=1",
                    f"boxcolor={box_color}",
                ])

            drawtext_filter = "drawtext=" + ":".join(drawtext_parts)

            self._run_ffmpeg([
                "-i", input_file,
                "-vf", drawtext_filter,
                "-c:v", "libx264",
                "-crf", "18",
                "-c:a", "copy",
                output_file.name,
            ])

            info = self._run_ffprobe(output_file.name)
            duration = float(info["format"].get("duration", 0))

            import uuid
            dest_path = f"{project_id}/fade_text_{uuid.uuid4()}.mp4"
            url = await self._upload_file(output_file.name, EXPORTS_BUCKET, dest_path)

            return {"url": url, "duration": duration}
        finally:
            os.unlink(input_file)
            os.unlink(output_file.name)

    async def add_slide_text(
        self,
        project_id: str,
        video_url: str,
        text: str,
        x: str = "(w-text_w)/2",
        y_start: str = "h+text_h",
        y_end: str = "h*0.8",
        font_size: int = 48,
        font_color: str = "white",
        font_file: str = "/app/fonts/Inter-Bold.ttf",
        start_time: float = 0.0,
        end_time: float = 5.0,
        slide_in: float = 0.3,
        slide_out: float = 0.3,
        direction: str = "up",
    ) -> Dict[str, Any]:
        """
        Add text that slides in and out.
        Uses FFmpeg drawtext with animated y position.
        """
        input_file = await self._download_file(video_url)
        output_file = tempfile.NamedTemporaryFile(
            suffix=".mp4", delete=False, dir=self.temp_dir
        )

        try:
            escaped_text = text.replace("'", "'\\''").replace(":", "\\:")
            
            # Timing calculations
            t_in_end = start_time + slide_in
            t_out_start = end_time - slide_out
            
            # Slide in: interpolate from y_start to y_end
            # Hold: stay at y_end
            # Slide out: interpolate from y_end to y_start
            if direction == "up":
                y_expr = (
                    f"if(lt(t,{start_time}),{y_start},"
                    f"if(lt(t,{t_in_end}),{y_start}+({y_end}-({y_start}))*((t-{start_time})/{slide_in}),"
                    f"if(lt(t,{t_out_start}),{y_end},"
                    f"if(lt(t,{end_time}),{y_end}+({y_start}-({y_end}))*((t-{t_out_start})/{slide_out}),"
                    f"{y_start}))))"
                )
            else:
                y_expr = (
                    f"if(lt(t,{start_time}),{y_start},"
                    f"if(lt(t,{t_in_end}),{y_start}+({y_end}-({y_start}))*((t-{start_time})/{slide_in}),"
                    f"if(lt(t,{t_out_start}),{y_end},"
                    f"if(lt(t,{end_time}),{y_end}+({y_start}-({y_end}))*((t-{t_out_start})/{slide_out}),"
                    f"{y_start}))))"
                )
            
            # Enable expression - only show during the animation range
            enable_expr = f"between(t,{start_time},{end_time})"
            
            drawtext_parts = [
                f"fontfile={font_file}",
                f"text='{escaped_text}'",
                f"fontsize={font_size}",
                f"fontcolor={font_color}",
                f"x={x}",
                f"y='{y_expr}'",
                f"enable='{enable_expr}'",
                "shadowx=2",
                "shadowy=2",
                "shadowcolor=black@0.8",
            ]
            
            drawtext_filter = "drawtext=" + ":".join(drawtext_parts)

            self._run_ffmpeg([
                "-i", input_file,
                "-vf", drawtext_filter,
                "-c:v", "libx264",
                "-crf", "18",
                "-c:a", "copy",
                output_file.name,
            ])

            info = self._run_ffprobe(output_file.name)
            duration = float(info["format"].get("duration", 0))

            import uuid
            dest_path = f"{project_id}/slide_text_{uuid.uuid4()}.mp4"
            url = await self._upload_file(output_file.name, EXPORTS_BUCKET, dest_path)

            return {"url": url, "duration": duration}
        finally:
            os.unlink(input_file)
            os.unlink(output_file.name)

    async def add_scale_text(
        self,
        project_id: str,
        video_url: str,
        text: str,
        x: str = "(w-text_w)/2",
        y: str = "h*0.8",
        font_size: int = 48,
        font_color: str = "white",
        font_file: str = "/app/fonts/Inter-Bold.ttf",
        start_time: float = 0.0,
        end_time: float = 5.0,
        scale_in: float = 0.3,
        scale_out: float = 0.3,
    ) -> Dict[str, Any]:
        """
        Add text with scale animation.
        Scales from 0.5x to 1x on entry, 1x to 0.5x on exit.
        """
        input_file = await self._download_file(video_url)
        output_file = tempfile.NamedTemporaryFile(
            suffix=".mp4", delete=False, dir=self.temp_dir
        )

        try:
            escaped_text = text.replace("'", "'\\''").replace(":", "\\:")
            
            # Timing calculations
            t_in_end = start_time + scale_in
            t_out_start = end_time - scale_out
            
            # Scale factor: 0.5 -> 1.0 on entry, 1.0 -> 0.5 on exit
            scale_expr = (
                f"if(lt(t,{start_time}),0.5,"
                f"if(lt(t,{t_in_end}),0.5+0.5*((t-{start_time})/{scale_in}),"
                f"if(lt(t,{t_out_start}),1,"
                f"if(lt(t,{end_time}),1-0.5*((t-{t_out_start})/{scale_out}),"
                f"0.5))))"
            )
            
            # Calculate animated font size
            base_size = font_size
            fontsize_expr = f"({base_size})*({scale_expr})"
            
            # Enable expression
            enable_expr = f"between(t,{start_time},{end_time})"
            
            drawtext_parts = [
                f"fontfile={font_file}",
                f"text='{escaped_text}'",
                f"fontsize='{fontsize_expr}'",
                f"fontcolor={font_color}",
                f"x={x}",
                f"y={y}",
                f"enable='{enable_expr}'",
                "shadowx=2",
                "shadowy=2",
                "shadowcolor=black@0.8",
            ]
            
            drawtext_filter = "drawtext=" + ":".join(drawtext_parts)

            self._run_ffmpeg([
                "-i", input_file,
                "-vf", drawtext_filter,
                "-c:v", "libx264",
                "-crf", "18",
                "-c:a", "copy",
                output_file.name,
            ])

            info = self._run_ffprobe(output_file.name)
            duration = float(info["format"].get("duration", 0))

            import uuid
            dest_path = f"{project_id}/scale_text_{uuid.uuid4()}.mp4"
            url = await self._upload_file(output_file.name, EXPORTS_BUCKET, dest_path)

            return {"url": url, "duration": duration}
        finally:
            os.unlink(input_file)
            os.unlink(output_file.name)

    async def add_typewriter_captions(
        self,
        project_id: str,
        video_url: str,
        words: List[Dict[str, Any]],
        x: str = "(w-text_w)/2",
        y: str = "h*0.85",
        font_size: int = 52,
        font_color: str = "white",
        font_file: str = "/app/fonts/Inter-Bold.ttf",
        box: bool = True,
        box_color: str = "black@0.6",
        highlight_color: str = None,
    ) -> Dict[str, Any]:
        """
        Add typewriter-style captions with word-by-word timing.
        Perfect for syncing with ElevenLabs TTS timestamps.
        Each word appears exactly when it's spoken.
        """
        input_file = await self._download_file(video_url)
        output_file = tempfile.NamedTemporaryFile(
            suffix=".mp4", delete=False, dir=self.temp_dir
        )

        try:
            # Build filter for each word
            filters = []
            
            # Calculate accumulated text for typewriter effect
            accumulated_text = ""
            for i, word in enumerate(words):
                accumulated_text += word["text"] + " "
                escaped = accumulated_text.strip().replace("'", "'\\''").replace(":", "\\:")
                
                start = word["startTime"]
                # End when next word starts, or at video end
                end = words[i + 1]["startTime"] if i + 1 < len(words) else 9999
                
                enable = f"between(t,{start},{end})"
                
                filter_parts = [
                    f"fontfile={font_file}",
                    f"text='{escaped}'",
                    f"fontsize={font_size}",
                    f"fontcolor={font_color}",
                    f"x={x}",
                    f"y={y}",
                    f"enable='{enable}'",
                ]
                
                if box:
                    filter_parts.extend([
                        f"box=1",
                        f"boxcolor={box_color}",
                        f"boxborderw=8",
                    ])
                
                filters.append("drawtext=" + ":".join(filter_parts))

            # Chain all drawtext filters
            full_filter = ",".join(filters)

            self._run_ffmpeg([
                "-i", input_file,
                "-vf", full_filter,
                "-c:v", "libx264",
                "-crf", "18",
                "-c:a", "copy",
                output_file.name,
            ])

            info = self._run_ffprobe(output_file.name)
            duration = float(info["format"].get("duration", 0))

            import uuid
            dest_path = f"{project_id}/captions_{uuid.uuid4()}.mp4"
            url = await self._upload_file(output_file.name, EXPORTS_BUCKET, dest_path)

            return {"url": url, "duration": duration}
        finally:
            os.unlink(input_file)
            os.unlink(output_file.name)

    async def add_multiple_text(
        self,
        project_id: str,
        video_url: str,
        text_elements: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Add multiple text overlays in a single FFmpeg pass.
        More efficient than calling add_text_overlay multiple times.
        """
        input_file = await self._download_file(video_url)
        output_file = tempfile.NamedTemporaryFile(
            suffix=".mp4", delete=False, dir=self.temp_dir
        )

        try:
            filters = []
            
            for elem in text_elements:
                escaped_text = elem["text"].replace("'", "'\\''").replace(":", "\\:")
                
                start = elem.get("startTime", 0)
                end = elem.get("endTime")
                
                if end:
                    enable = f"between(t,{start},{end})"
                else:
                    enable = f"gte(t,{start})"
                
                filter_parts = [
                    f"fontfile={elem.get('fontFile', '/app/fonts/Inter-Bold.ttf')}",
                    f"text='{escaped_text}'",
                    f"fontsize={elem.get('fontSize', 48)}",
                    f"fontcolor={elem.get('fontColor', 'white')}",
                    f"x={elem.get('x', '(w-text_w)/2')}",
                    f"y={elem.get('y', 'h/2')}",
                    f"enable='{enable}'",
                ]
                
                filters.append("drawtext=" + ":".join(filter_parts))

            full_filter = ",".join(filters)

            self._run_ffmpeg([
                "-i", input_file,
                "-vf", full_filter,
                "-c:v", "libx264",
                "-crf", "18",
                "-c:a", "copy",
                output_file.name,
            ])

            info = self._run_ffprobe(output_file.name)
            duration = float(info["format"].get("duration", 0))

            import uuid
            dest_path = f"{project_id}/multi_text_{uuid.uuid4()}.mp4"
            url = await self._upload_file(output_file.name, EXPORTS_BUCKET, dest_path)

            return {"url": url, "duration": duration}
        finally:
            os.unlink(input_file)
            os.unlink(output_file.name)
