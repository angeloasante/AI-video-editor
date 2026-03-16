"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, CheckCircle, XCircle, Play, Film, AlertCircle, Copy, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

type ExportFormat = "mp4" | "webm" | "mov";
type ExportQuality = "draft" | "preview" | "hd" | "4k";

interface TimelineClip {
  id: string;
  startTime: number;
  endTime: number;
  trackIndex: number;
  mediaFile?: {
    url: string;
    name: string;
    type?: string;
  };
}

interface Transition {
  id: string;
  type: string;
  duration: number;
  clipAId: string;
  clipBId: string;
  startTime: number;
}

interface TextOverlay {
  id: string;
  text: string;
  preset: string;
  startTime: number;
  endTime: number;
  position: { x: number; y: number };
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  color?: string;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duration: number;
  clips: TimelineClip[];
  transitions: Transition[];
  textOverlays: TextOverlay[];
  playerRef?: React.RefObject<{ play: () => void; pause: () => void; seek: (time: number) => void } | null>;
}

export function ExportDialog({
  open,
  onOpenChange,
  duration = 0,
  clips = [],
  transitions = [],
  textOverlays = [],
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("mp4");
  const [quality, setQuality] = useState<ExportQuality>("hd");
  const [includeAudio, setIncludeAudio] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [skippedClips, setSkippedClips] = useState(0);
  
  // Ref-based guard against rapid double-clicks (state updates can lag)
  const exportInProgressRef = useRef(false);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      setProgress(0);
      setExportStatus("idle");
      setErrorMessage("");
      setDownloadUrl(null);
      setJobId(null);
      setSkippedClips(0);
      exportInProgressRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Poll job status
  const pollJobStatus = useCallback(async (currentJobId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/export/status/${currentJobId}?t=${Date.now()}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to check status");
      }
      
      const { status, progress: jobProgress, result: jobResult } = result.data;
      
      // Parse progress - handle number, object with percentage, or default
      let newProgress = 0;
      if (typeof jobProgress === "number") {
        newProgress = jobProgress;
      } else if (jobProgress && typeof jobProgress === "object" && typeof jobProgress.percentage === "number") {
        newProgress = jobProgress.percentage;
      }
      
      // Only update if progress increases (never go backwards during same export)
      setProgress(prev => Math.max(prev, newProgress));
      
      if (status === "completed") {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setDownloadUrl(jobResult?.url || null);
        setSkippedClips(jobResult?.skippedClips || 0);
        setExportStatus("done");
        setIsExporting(false);
        setProgress(100);
        exportInProgressRef.current = false;
      } else if (status === "failed") {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        setErrorMessage(jobResult?.error || "Export failed");
        setExportStatus("error");
        setIsExporting(false);
        exportInProgressRef.current = false;
      }
    } catch (error) {
      console.error("Error polling status:", error);
    }
  }, []);

  // Convert timeline data to backend format
  const buildTimelineData = useCallback(() => {
    // Group clips by track
    const trackMap = new Map<number, TimelineClip[]>();
    clips.forEach(clip => {
      const trackClips = trackMap.get(clip.trackIndex) || [];
      trackClips.push(clip);
      trackMap.set(clip.trackIndex, trackClips);
    });
    
    const tracks = Array.from(trackMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([trackIndex, trackClips]) => {
        const isAudioTrack = trackClips.every(c => c.mediaFile?.type === "audio");
        return {
          id: `track-${trackIndex}`,
          name: isAudioTrack ? `Audio ${trackIndex + 1}` : `Track ${trackIndex + 1}`,
          type: isAudioTrack ? "audio" : "video",
          clips: trackClips
            .sort((a, b) => a.startTime - b.startTime)
            .map(clip => ({
              id: clip.id,
              start: clip.startTime,
              end: clip.endTime,
              source: clip.mediaFile?.url || "",
              sourceIn: 0,
              sourceOut: clip.endTime - clip.startTime,
              volume: 1.0,
              opacity: 1.0,
              effects: [],
            })),
          muted: false,
          locked: false,
        };
      });
    
    return {
      tracks,
      duration,
    };
  }, [clips, duration]);

  const handleExport = useCallback(async () => {
    // Prevent double-clicks (ref check is synchronous, state can lag)
    if (isExporting || exportInProgressRef.current) {
      return;
    }
    exportInProgressRef.current = true;
    
    if (clips.length === 0) {
      setErrorMessage("No clips to export");
      setExportStatus("error");
      exportInProgressRef.current = false;
      return;
    }
    
    setIsExporting(true);
    setExportStatus("processing");
    setProgress(0);
    setErrorMessage("");

    try {
      // Pre-validate clip URLs — warn about clips with missing sources
      const missingSourceClips = clips.filter(c => !c.mediaFile?.url);
      if (missingSourceClips.length > 0) {
        console.warn(`[Export] ${missingSourceClips.length} clip(s) have no source URL and will be skipped`);
      }

      // Log all clip URLs for debugging export failures
      clips.forEach((c, i) => {
        console.log(`[Export] Clip ${i}: id=${c.id}, url=${c.mediaFile?.url?.slice(0, 100)}`);
      });

      const timelineData = buildTimelineData();
      
      // Start export job
      const response = await fetch(`${API_BASE_URL}/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: `export-${Date.now()}`,
          timeline: timelineData,
          format,
          quality,
          includeAudio,
          frameRate: 30,
          // Include transitions
          transitions: transitions.map(t => ({
            type: t.type,
            duration: t.duration,
            startTime: t.startTime,
            clipAId: t.clipAId,
            clipBId: t.clipBId,
          })),
          // Include text overlays
          textOverlays: textOverlays.map(t => ({
            text: t.text,
            preset: t.preset,
            startTime: t.startTime,
            endTime: t.endTime,
            position: t.position || { x: 50, y: 10 },
            fontSize: t.fontSize || 24,
            fontColor: t.color || "#ffffff",
            fontFamily: t.fontFamily || "Inter",
            fontWeight: t.fontWeight || 400,
          })),
        }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to start export");
      }
      
      const { jobId: newJobId } = result.data;
      setJobId(newJobId);
      
      // Start polling for status
      pollIntervalRef.current = setInterval(() => {
        pollJobStatus(newJobId);
      }, 2000);
      
      // Initial poll
      pollJobStatus(newJobId);
      
    } catch (error) {
      console.error("Export error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Export failed");
      setExportStatus("error");
      setIsExporting(false);
      exportInProgressRef.current = false;
    }
  }, [clips, transitions, textOverlays, format, quality, includeAudio, isExporting, buildTimelineData, pollJobStatus]);

  const handleDownload = useCallback(async () => {
    if (!downloadUrl || isDownloading) return;
    
    setIsDownloading(true);
    
    try {
      // Fetch the video as a blob to enable native save dialog for cross-origin URLs
      const cacheBustUrl = `${downloadUrl}${downloadUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;
      const response = await fetch(cacheBustUrl, { mode: "cors", cache: "no-store" });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `layerai-export-${Date.now()}.${format}`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error) {
      console.error("Download failed:", error);
      // Fallback: open in new tab for direct download
      window.open(downloadUrl, "_blank");
    } finally {
      setIsDownloading(false);
    }
  }, [downloadUrl, format, isDownloading]);

  const handleCancel = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsExporting(false);
    setExportStatus("idle");
    exportInProgressRef.current = false;
  }, []);

  const qualityOptions: { value: ExportQuality; label: string; resolution: string }[] = [
    { value: "draft", label: "Draft", resolution: "360p" },
    { value: "preview", label: "Preview", resolution: "720p" },
    { value: "hd", label: "HD", resolution: "1080p" },
    { value: "4k", label: "4K", resolution: "2160p" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Film className="w-5 h-5 text-purple-400" />
            Export Video
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-400">Format</label>
            <div className="flex gap-2">
              {(["mp4", "webm", "mov"] as ExportFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  disabled={isExporting}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors",
                    format === f
                      ? "bg-purple-500/20 border-purple-500 text-purple-400"
                      : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                  )}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Selection */}
          <div className="space-y-2">
            <label className="text-sm text-neutral-400">Quality</label>
            <div className="grid grid-cols-4 gap-2">
              {qualityOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setQuality(opt.value)}
                  disabled={isExporting}
                  className={cn(
                    "py-2 px-2 rounded-lg border text-sm transition-colors",
                    quality === opt.value
                      ? "bg-purple-500/20 border-purple-500 text-purple-400"
                      : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                  )}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-[10px] opacity-60">{opt.resolution}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Audio Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-neutral-400">Include Audio</label>
            <button
              onClick={() => setIncludeAudio(!includeAudio)}
              disabled={isExporting}
              className={cn(
                "w-12 h-6 rounded-full transition-colors relative",
                includeAudio ? "bg-purple-500" : "bg-neutral-700"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform",
                  includeAudio ? "translate-x-6" : "translate-x-0.5"
                )}
              />
            </button>
          </div>

          {/* Timeline Summary */}
          <div className="bg-neutral-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Duration</span>
              <span className="text-white font-mono">
                {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, "0")}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Clips</span>
              <span className="text-white">{clips.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Transitions</span>
              <span className="text-white">{transitions.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Text Overlays</span>
              <span className="text-white">{textOverlays.length}</span>
            </div>
          </div>

          {/* Progress */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-400 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Rendering with FFmpeg...
                </span>
                <span className="text-white font-mono">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500">
                Processing video tracks, transitions, and effects...
              </p>
            </div>
          )}

          {/* Status Messages */}
          {exportStatus === "done" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-400 bg-green-500/10 p-3 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                <span>Export complete! Your video is ready.</span>
              </div>
              {skippedClips > 0 && (
                <div className="flex items-center gap-2 text-yellow-400 bg-yellow-500/10 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{skippedClips} clip{skippedClips > 1 ? "s were" : " was"} skipped due to broken source URLs.</span>
                </div>
              )}
            </div>
          )}

          {exportStatus === "error" && (
            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-lg">
              <XCircle className="w-5 h-5" />
              <span>{errorMessage || "Export failed"}</span>
            </div>
          )}

          {/* No clips warning */}
          {clips.length === 0 && exportStatus === "idle" && (
            <div className="flex items-center gap-2 text-yellow-400 bg-yellow-500/10 p-3 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>Add clips to the timeline before exporting</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {exportStatus === "done" ? (
              <>
                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {isDownloading ? "Downloading..." : "Download"}
                </Button>
                <Button
                  onClick={() => {
                    if (downloadUrl) {
                      navigator.clipboard.writeText(downloadUrl);
                      // Brief visual feedback
                      const btn = document.activeElement as HTMLButtonElement;
                      if (btn) btn.blur();
                    }
                  }}
                  variant="outline"
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                  title="Copy video link"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => window.open(downloadUrl || "", "_blank")}
                  variant="outline"
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => {
                    setExportStatus("idle");
                    setDownloadUrl(null);
                    setJobId(null);
                    setProgress(0);
                    setErrorMessage("");
                    setSkippedClips(0);
                    exportInProgressRef.current = false;
                    if (pollIntervalRef.current) {
                      clearInterval(pollIntervalRef.current);
                      pollIntervalRef.current = null;
                    }
                  }}
                  variant="outline"
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  Export Again
                </Button>
              </>
            ) : isExporting ? (
              <Button
                onClick={handleCancel}
                variant="outline"
                className="flex-1 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleExport}
                  disabled={clips.length === 0}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Export
                </Button>
                <Button
                  onClick={() => onOpenChange(false)}
                  variant="outline"
                  className="border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                >
                  Cancel
                </Button>
              </>
            )}
          </div>

          {/* Info Note */}
          {!isExporting && exportStatus !== "done" && clips.length > 0 && (
            <p className="text-xs text-neutral-500 text-center">
              Video will be processed server-side using FFmpeg for best quality.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
