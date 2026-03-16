"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import {
  Timeline as TimelineEditor,
  TimelineState,
} from "@xzdarcy/react-timeline-editor";
import {
  TimelineEffect,
  TimelineRow,
  TimelineAction,
} from "@xzdarcy/timeline-engine";
import {
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Minus,
  Plus,
  Scissors,
  AudioLines,
  ChevronUp,
  ChevronDown,
  Film,
  Music,
  Image as ImageIcon,
  Trash2,
  Type,
  ArrowRightLeft,
  FolderX,
  PictureInPicture2,
  Crop,
  Copy,
  Layers,
  Undo2,
  Redo2,
  MoreHorizontal,
  Captions,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { MediaFile } from "@/lib/supabase";
import type { TranscriptionRecord } from "@/lib/supabase";
import { audioApi } from "@/lib/api";
import type { PlaybackEngine } from "@/hooks/usePlaybackEngine";
import type { TextOverlay, Transition, VideoOverlay } from "@/types/editor";

import "@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css";

export type { MediaFile };

// Stable empty arrays to prevent re-render loops from destructured defaults
const EMPTY_TEXT_OVERLAYS: TextOverlay[] = [];
const EMPTY_TRANSITIONS: Transition[] = [];
const EMPTY_VIDEO_OVERLAYS: VideoOverlay[] = [];
const EMPTY_TRANSCRIPTIONS: TranscriptionRecord[] = [];

// Extended action with media file info
export interface MediaAction extends TimelineAction {
  mediaFile?: MediaFile;
  name?: string;
  /** Offset into source media in seconds (set when clip is split) */
  mediaOffset?: number;
}

// Clip represents a segment of media in the timeline
export interface TimelineClip {
  id: string;
  startTime: number;
  endTime: number;
  trackIndex: number;
  mediaFile?: MediaFile;
  /** Offset into source media in seconds (set when clip is split) */
  mediaOffset?: number;
}

// Handle for imperative Timeline control
export interface TimelineHandle {
  addMedia: (file: MediaFile, duration: number, trackIndex?: number) => void;
  getClipAtTime: (time: number) => TimelineClip | null;
  splitAtPlayhead: () => void;
}

interface TimelineProps {
  engine: PlaybackEngine;
  zoom: number;
  timelineHeight: number;
  textOverlays?: TextOverlay[];
  transitions?: Transition[];
  videoOverlays?: VideoOverlay[];
  onZoomChange: (zoom: number) => void;
  onHeightChange: (height: number) => void;
  onClipsChange?: (clips: TimelineClip[]) => void;
  onCurrentClipChange?: (clip: TimelineClip | null) => void;
  onTransitionsChange?: (transitions: Transition[]) => void;
  onTextOverlaysChange?: (textOverlays: TextOverlay[]) => void;
  onVideoOverlaysChange?: (overlays: VideoOverlay[]) => void;
  onPiPToggle?: () => void;
  isPiP?: boolean;
  onCropClick?: () => void;
  onOverlayClick?: () => void;
  hasSelectedClip?: boolean;
  onSelectedOverlayChange?: (overlayId: string | null) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isMobile?: boolean;
  /** Clips loaded from DB — initializes the timeline per-project */
  initialClips?: TimelineClip[];
  /** Transcriptions loaded from DB — renders caption track beneath clips */
  transcriptions?: TranscriptionRecord[];
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return `${secs}.${ms}s`;
}

const effects: Record<string, TimelineEffect> = {
  video: { id: "video", name: "Video" },
  audio: { id: "audio", name: "Audio" },
  image: { id: "image", name: "Image" },
  text: { id: "text", name: "Text" },
  transition: { id: "transition", name: "Transition" },
  overlay: { id: "overlay", name: "Overlay" },
  caption: { id: "caption", name: "Caption" },
};

// Custom Action Renderer
const CustomActionRenderer: React.FC<{
  action: MediaAction;
  row: TimelineRow;
}> = ({ action }) => {
  const effectId = action.effectId || "video";
  const mediaFile = action.mediaFile;

  const colorSchemes: Record<
    string,
    { bg: string; border: string; icon: React.ElementType }
  > = {
    video: { bg: "rgba(30, 64, 175, 0.85)", border: "#3b82f6", icon: Film },
    audio: { bg: "rgba(126, 34, 206, 0.85)", border: "#a855f7", icon: Music },
    image: {
      bg: "rgba(21, 128, 61, 0.85)",
      border: "#22c55e",
      icon: ImageIcon,
    },
    text: { bg: "rgba(6, 182, 212, 0.85)", border: "#06b6d4", icon: Type },
    transition: {
      bg: "rgba(234, 88, 12, 0.85)",
      border: "#f97316",
      icon: ArrowRightLeft,
    },
    overlay: {
      bg: "rgba(236, 72, 153, 0.85)",
      border: "#ec4899",
      icon: Layers,
    },
    caption: {
      bg: "rgba(250, 204, 21, 0.7)",
      border: "#eab308",
      icon: Captions,
    },
  };

  const scheme = colorSchemes[effectId] || colorSchemes.video;
  const Icon = scheme.icon;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: `linear-gradient(135deg, ${scheme.bg} 0%, rgba(0,0,0,0.4) 100%)`,
        borderRadius: "6px",
        border: `2px solid ${scheme.border}`,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "0 10px",
        overflow: "hidden",
        boxSizing: "border-box",
        cursor: "grab",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "4px",
          backgroundColor: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon
          style={{ width: 16, height: 16, color: "#fff", opacity: 0.8 }}
        />
      </div>
      <span
        style={{
          fontSize: "11px",
          color: "#fff",
          fontWeight: 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          opacity: 0.9,
        }}
      >
        {mediaFile?.name ||
          action.name ||
          `${effectId.charAt(0).toUpperCase() + effectId.slice(1)} Clip`}
      </span>
    </div>
  );
};

const IconButton: React.FC<{
  icon: React.ElementType;
  onClick?: () => void;
  disabled?: boolean;
  tooltip?: string;
  size?: "sm" | "md";
}> = ({ icon: Icon, onClick, disabled, tooltip, size = "md" }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={tooltip}
    className={cn(
      "flex items-center justify-center rounded-lg transition-all",
      size === "sm" ? "w-8 h-8" : "w-9 h-9",
      disabled
        ? "text-neutral-600 cursor-not-allowed"
        : "text-neutral-400 hover:text-white hover:bg-neutral-800"
    )}
  >
    <Icon
      className={size === "sm" ? "w-4.5 h-4.5" : "w-5 h-5"}
      strokeWidth={1.8}
    />
  </button>
);

export const Timeline = forwardRef<TimelineHandle, TimelineProps>(
  function Timeline(
    {
      engine,
      zoom,
      timelineHeight,
      textOverlays = EMPTY_TEXT_OVERLAYS,
      transitions = EMPTY_TRANSITIONS,
      videoOverlays = EMPTY_VIDEO_OVERLAYS,
      onZoomChange,
      onHeightChange,
      onClipsChange,
      onCurrentClipChange,
      onTransitionsChange,
      onTextOverlaysChange,
      onVideoOverlaysChange,
      onPiPToggle,
      isPiP,
      onCropClick,
      onOverlayClick,
      hasSelectedClip,
      onSelectedOverlayChange,
      onUndo,
      onRedo,
      canUndo,
      canRedo,
      isMobile,
      initialClips,
      transcriptions = EMPTY_TRANSCRIPTIONS,
    },
    ref
  ) {
    const [showMobileTools, setShowMobileTools] = useState(false);
    // Initialize from DB-loaded clips (per-project, no localStorage)
    const [editorData, setEditorData] = useState<TimelineRow[]>(() => {
      if (!initialClips?.length) return createEmptyTracks();
      return clipsToTracks(initialClips);
    });

    const [isMounted, setIsMounted] = useState(false);
    const [isDraggingResize, setIsDraggingResize] = useState(false);
    const [selectedActionId, setSelectedActionId] = useState<string | null>(
      null
    );
    const timelineRef = useRef<TimelineState>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setIsMounted(true);
    }, []);

    // Re-initialize when initialClips content changes (project switch or DB load)
    // Use JSON fingerprint to avoid infinite loop: editorData change → onClipsChange → clips state → initialClips prop → repeat
    const prevClipsFingerprintRef = useRef<string>(
      JSON.stringify((initialClips || []).map((c) => `${c.id}:${c.startTime}:${c.endTime}:${c.trackIndex}`))
    );
    useEffect(() => {
      const fingerprint = JSON.stringify(
        (initialClips || []).map((c) => `${c.id}:${c.startTime}:${c.endTime}:${c.trackIndex}`)
      );
      if (fingerprint === prevClipsFingerprintRef.current) return;
      prevClipsFingerprintRef.current = fingerprint;

      if (initialClips?.length) {
        setEditorData(clipsToTracks(initialClips));
      } else {
        setEditorData(createEmptyTracks());
      }
    }, [initialClips]);

    // Calculate total duration from all clips
    const calculateTotalDuration = useCallback((data: TimelineRow[]) => {
      let maxEnd = 0;
      data.forEach((row) => {
        row.actions.forEach((action) => {
          if (action.end > maxEnd) maxEnd = action.end;
        });
      });
      return maxEnd;
    }, []);

    // Keep engine duration in sync whenever clips change
    useEffect(() => {
      if (!isMounted) return;
      const dur = calculateTotalDuration(editorData);
      if (dur > 0) engine.setDuration(dur);
    }, [isMounted, editorData]); // eslint-disable-line react-hooks/exhaustive-deps

    // Clear timeline
    const handleClearTimeline = useCallback(() => {
      if (!confirm("Clear all timeline data and start fresh?")) return;

      setEditorData(createEmptyTracks());
      engine.setDuration(0);
      onTransitionsChange?.([]);
      onTextOverlaysChange?.([]);
    }, [engine, onTransitionsChange, onTextOverlaysChange]);

    // Stable refs for managed track data — prevents re-render loops during drag
    const managedTracksRef = useRef<{
      text: TimelineRow | null;
      transitions: TimelineRow | null;
      overlays: TimelineRow | null;
      captions: TimelineRow | null;
    }>({ text: null, transitions: null, overlays: null, captions: null });

    // Update managed track refs from props (source of truth when not dragging)
    useEffect(() => {
      if (textOverlays.length > 0) {
        managedTracksRef.current.text = {
          id: "track-text",
          actions: textOverlays.map((overlay) => ({
            id: overlay.id,
            start: overlay.startTime,
            end: overlay.endTime,
            effectId: "text",
            name: overlay.text,
            movable: true,
            flexible: true,
          })),
        };
      } else {
        managedTracksRef.current.text = null;
      }
    }, [textOverlays]);

    useEffect(() => {
      if (transitions.length > 0) {
        managedTracksRef.current.transitions = {
          id: "track-transitions",
          actions: transitions.map((t) => ({
            id: t.id,
            start: t.startTime,
            end: t.startTime + t.duration,
            effectId: "transition",
            name: t.type.charAt(0).toUpperCase() + t.type.slice(1),
            movable: true,
            flexible: true,
          })),
        };
      } else {
        managedTracksRef.current.transitions = null;
      }
    }, [transitions]);

    useEffect(() => {
      if (videoOverlays.length > 0) {
        managedTracksRef.current.overlays = {
          id: "track-overlays",
          actions: videoOverlays.map((vo) => ({
            id: vo.id,
            start: vo.startTime,
            end: vo.endTime,
            effectId: "overlay",
            name: vo.name,
            movable: true,
            flexible: true,
          })),
        };
      } else {
        managedTracksRef.current.overlays = null;
      }
    }, [videoOverlays]);

    // Build captions track from transcriptions — offset by clip's timeline position
    useEffect(() => {
      if (transcriptions.length > 0) {
        // Build a map of clip_id → clip start time on the timeline
        const clipStartMap = new Map<string, number>();
        for (const row of editorData) {
          for (const action of row.actions) {
            clipStartMap.set(action.id, action.start);
          }
        }

        const allCaptions: TimelineAction[] = [];
        for (const t of transcriptions) {
          if (!t.captions?.length) continue;
          // Offset = where the clip sits on the timeline (0 if clip not found)
          const clipStart = clipStartMap.get(t.clip_id) ?? 0;
          for (const cap of t.captions) {
            allCaptions.push({
              id: `cap-${t.clip_id}-${cap.startTime}`,
              start: clipStart + cap.startTime,
              end: clipStart + cap.endTime,
              effectId: "caption",
              name: cap.text,
              movable: false,
              flexible: false,
            } as TimelineAction & { name: string });
          }
        }
        if (allCaptions.length > 0) {
          managedTracksRef.current.captions = {
            id: "track-captions",
            actions: allCaptions,
          };
        } else {
          managedTracksRef.current.captions = null;
        }
      } else {
        managedTracksRef.current.captions = null;
      }
    }, [transcriptions, editorData]);

    // Force re-merge counter — bumped when managed tracks change
    const [mergeKey, setMergeKey] = useState(0);
    useEffect(() => setMergeKey((k) => k + 1), [textOverlays, transitions, videoOverlays, transcriptions, editorData]);

    // Merge managed tracks with editor data
    // Order: transitions | text | media clips | captions | overlays
    const mergedEditorData = useMemo(() => {
      let result = [...editorData];
      const { text, transitions: trans, overlays: ovl, captions: caps } = managedTracksRef.current;
      if (text) result = [text, ...result];
      if (trans) result = [trans, ...result];
      if (caps) result = [...result, caps];  // Captions right after media clips
      if (ovl) result = [...result, ovl];
      return result;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorData, mergeKey]);

    // Get clip at time
    const getClipAtTime = useCallback(
      (time: number): TimelineClip | null => {
        for (let trackIndex = 0; trackIndex < editorData.length; trackIndex++) {
          for (const action of editorData[trackIndex].actions) {
            if (time >= action.start && time < action.end) {
              return {
                id: action.id,
                startTime: action.start,
                endTime: action.end,
                trackIndex,
                mediaFile: (action as MediaAction).mediaFile,
                mediaOffset: (action as MediaAction).mediaOffset,
              };
            }
          }
        }
        return null;
      },
      [editorData]
    );

    // Add media to timeline — places at playhead position (or appends at end if no room)
    // Track routing: video/image → track 0, audio → track 1
    const addMedia = useCallback(
      (file: MediaFile, mediaDuration: number, explicitTrackIndex?: number) => {
        // Auto-route by file type if no explicit trackIndex
        const trackIndex = explicitTrackIndex ?? (file.type === "audio" ? 1 : 0);
        const playheadTime = engine.timeRef.current;

        setEditorData((prev) => {
          const newData = [...prev];

          while (newData.length <= trackIndex) {
            newData.push({ id: `track-${newData.length}`, actions: [] });
          }

          const track = newData[trackIndex];

          // Try placing at playhead position first
          let startTime = playheadTime;

          // Check if playhead position overlaps with an existing action on this track
          const overlaps = (s: number, e: number) =>
            track.actions.some((a) => s < a.end && e > a.start);

          if (overlaps(startTime, startTime + mediaDuration)) {
            // Fall back: append after last action on this track
            startTime =
              track.actions.length > 0
                ? Math.max(...track.actions.map((a) => a.end))
                : 0;
          }

          const newAction: MediaAction = {
            id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            start: startTime,
            end: startTime + mediaDuration,
            effectId: file.type || "video",
            mediaFile: file,
            name: file.name,
          };

          newData[trackIndex] = {
            ...track,
            actions: [...track.actions, newAction],
          };

          const newTotalDuration = calculateTotalDuration(newData);
          setTimeout(() => engine.setDuration(newTotalDuration), 0);

          return newData;
        });
      },
      [calculateTotalDuration, engine.setDuration, engine.timeRef]
    );

    // NOTE: useImperativeHandle moved after handleSplit definition (line ~960)

    // Update current clip when time changes — use engine subscription (not per-render)
    useEffect(() => {
      if (!onCurrentClipChange) return;
      return engine.subscribe((time) => {
        const clip = getClipAtTime(time);
        onCurrentClipChange(clip);
      });
    }, [engine.subscribe, getClipAtTime, onCurrentClipChange]);

    // Sync engine time to timeline cursor (throttled via displayTime)
    useEffect(() => {
      if (timelineRef.current) {
        timelineRef.current.setTime(engine.displayTime);
      }
    }, [engine.displayTime]);

    // Play/pause sync — connect timeline tick to engine.onTick (ref only, no re-render)
    useEffect(() => {
      if (!timelineRef.current) return;

      const listener = timelineRef.current.listener;

      // This fires every frame — writes to ref only, NOT setState
      const handleTimeTick = ({ time }: { time: number }) => {
        engine.onTick(time);
      };

      // Detect when the timeline auto-ends (autoEnd: true triggers "paused")
      const handleAutoEnd = () => {
        if (engine.isPlaying) {
          engine.pause();
        }
      };

      if (listener) {
        listener.on("setTimeByTick", handleTimeTick);
        listener.on("paused", handleAutoEnd);
      }

      if (engine.isPlaying) {
        timelineRef.current.play({ autoEnd: true });
      } else {
        timelineRef.current.pause();
      }

      return () => {
        if (listener) {
          listener.off("setTimeByTick", handleTimeTick);
          listener.off("paused", handleAutoEnd);
        }
      };
    }, [engine.isPlaying, engine.onTick, engine.pause]);

    // Notify parent of clip changes (with fingerprint guard to prevent infinite loop)
    const prevOutboundFingerprintRef = useRef<string>("");
    useEffect(() => {
      if (!onClipsChange) return;
      const clips: TimelineClip[] = [];
      editorData.forEach((row, trackIndex) => {
        row.actions.forEach((action) => {
          clips.push({
            id: action.id,
            startTime: action.start,
            endTime: action.end,
            trackIndex,
            mediaFile: (action as MediaAction).mediaFile,
            mediaOffset: (action as MediaAction).mediaOffset,
          });
        });
      });

      // Only notify parent if clips actually changed (prevents loop with initialClips)
      const outFingerprint = JSON.stringify(
        clips.map((c) => `${c.id}:${c.startTime}:${c.endTime}:${c.trackIndex}`)
      );
      if (outFingerprint !== prevOutboundFingerprintRef.current) {
        prevOutboundFingerprintRef.current = outFingerprint;
        onClipsChange(clips);
      }

      const newDuration = calculateTotalDuration(editorData);
      if (newDuration > 0) engine.setDuration(newDuration);
    }, [editorData, onClipsChange, calculateTotalDuration, engine.setDuration]);

    // Resize drag (mouse + touch)
    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      setIsDraggingResize(true);
    }, []);

    const handleResizeTouchStart = useCallback((e: React.TouchEvent) => {
      e.stopPropagation();
      setIsDraggingResize(true);
    }, []);

    useEffect(() => {
      if (!isDraggingResize) return;
      const minH = isMobile ? 120 : 150;
      const maxH = isMobile ? Math.round(window.innerHeight * 0.55) : 500;

      const handleMouseMove = (e: MouseEvent) => {
        const newHeight = window.innerHeight - e.clientY;
        onHeightChange(Math.max(minH, Math.min(maxH, newHeight)));
      };
      const handleTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        const newHeight = window.innerHeight - touch.clientY;
        onHeightChange(Math.max(minH, Math.min(maxH, newHeight)));
      };
      const handleEnd = () => setIsDraggingResize(false);

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleEnd);
      document.addEventListener("touchmove", handleTouchMove, { passive: true });
      document.addEventListener("touchend", handleEnd);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleEnd);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleEnd);
      };
    }, [isDraggingResize, onHeightChange, isMobile]);

    // Delete selected clip or transition
    const handleDelete = useCallback(() => {
      if (!selectedActionId) return;

      // Cancel any pending debounced sync so stale closure data doesn't re-add the deleted item
      if (managedSyncTimerRef.current) {
        clearTimeout(managedSyncTimerRef.current);
        managedSyncTimerRef.current = null;
      }

      if (selectedActionId.startsWith("transition-")) {
        if (managedTracksRef.current.transitions) {
          const remaining = managedTracksRef.current.transitions.actions.filter(a => a.id !== selectedActionId);
          managedTracksRef.current.transitions = remaining.length > 0
            ? { ...managedTracksRef.current.transitions, actions: remaining }
            : null;
        }
        onTransitionsChange?.(
          transitions.filter((t) => t.id !== selectedActionId)
        );
        setMergeKey(k => k + 1);
        setSelectedActionId(null);
        return;
      }

      if (selectedActionId.startsWith("text-")) {
        if (managedTracksRef.current.text) {
          const remaining = managedTracksRef.current.text.actions.filter(a => a.id !== selectedActionId);
          managedTracksRef.current.text = remaining.length > 0
            ? { ...managedTracksRef.current.text, actions: remaining }
            : null;
        }
        onTextOverlaysChange?.(
          textOverlays.filter((t) => t.id !== selectedActionId)
        );
        setMergeKey(k => k + 1);
        setSelectedActionId(null);
        return;
      }

      if (selectedActionId.startsWith("overlay-")) {
        if (managedTracksRef.current.overlays) {
          const remaining = managedTracksRef.current.overlays.actions.filter(a => a.id !== selectedActionId);
          managedTracksRef.current.overlays = remaining.length > 0
            ? { ...managedTracksRef.current.overlays, actions: remaining }
            : null;
        }
        onVideoOverlaysChange?.(
          videoOverlays.filter((o) => o.id !== selectedActionId)
        );
        setMergeKey(k => k + 1);
        setSelectedActionId(null);
        return;
      }

      setEditorData((prev) => {
        const newData = prev.map((row) => {
          const idx = row.actions.findIndex((a) => a.id === selectedActionId);
          if (idx === -1) return row;
          const newActions = [...row.actions];
          const deleted = newActions[idx];
          const gap = deleted.end - deleted.start;
          newActions.splice(idx, 1);
          // Shift all subsequent clips on this track left to fill the gap
          for (const action of newActions) {
            if (action.start >= deleted.start) {
              action.start -= gap;
              action.end -= gap;
            }
          }
          return { ...row, actions: newActions };
        });
        const newTotalDuration = calculateTotalDuration(newData);
        setTimeout(() => engine.setDuration(newTotalDuration > 0 ? newTotalDuration : 0), 0);
        return newData;
      });
      setSelectedActionId(null);
    }, [
      selectedActionId,
      calculateTotalDuration,
      engine,
      transitions,
      onTransitionsChange,
      textOverlays,
      onTextOverlaysChange,
      videoOverlays,
      onVideoOverlaysChange,
    ]);

    // Duplicate selected clip/text/transition
    const handleDuplicate = useCallback(() => {
      if (!selectedActionId) return;

      // Duplicate text overlay
      if (selectedActionId.startsWith("text-")) {
        const overlay = textOverlays.find((t) => t.id === selectedActionId);
        if (overlay && onTextOverlaysChange) {
          const duration = overlay.endTime - overlay.startTime;
          const newOverlay = {
            ...overlay,
            id: `text-${Date.now()}`,
            startTime: overlay.endTime + 0.1,
            endTime: overlay.endTime + 0.1 + duration,
          };
          onTextOverlaysChange([...textOverlays, newOverlay]);
        }
        return;
      }

      // Duplicate transition
      if (selectedActionId.startsWith("transition-")) {
        const transition = transitions.find((t) => t.id === selectedActionId);
        if (transition && onTransitionsChange) {
          const newTransition = {
            ...transition,
            id: `transition-${Date.now()}`,
            startTime: transition.startTime + transition.duration + 0.1,
          };
          onTransitionsChange([...transitions, newTransition]);
        }
        return;
      }

      // Duplicate media clip — place right after the original on the same track
      setEditorData((prev) => {
        const newData = [...prev];
        for (let i = 0; i < newData.length; i++) {
          const actionIdx = newData[i].actions.findIndex((a) => a.id === selectedActionId);
          if (actionIdx === -1) continue;

          const original = newData[i].actions[actionIdx] as MediaAction;
          const duration = original.end - original.start;
          const newStart = original.end + 0.1;
          const newId = `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

          const newAction: MediaAction = {
            ...original,
            id: newId,
            start: newStart,
            end: newStart + duration,
          };

          newData[i] = {
            ...newData[i],
            actions: [...newData[i].actions, newAction],
          };

          const newTotalDuration = calculateTotalDuration(newData);
          setTimeout(() => engine.setDuration(newTotalDuration), 0);
          setSelectedActionId(newId);
          break;
        }
        return newData;
      });
    }, [selectedActionId, textOverlays, onTextOverlaysChange, transitions, onTransitionsChange, calculateTotalDuration, engine]);

    // Extract audio from selected video clip
    const [isExtractingAudio, setIsExtractingAudio] = useState(false);
    const handleExtractAudio = useCallback(async () => {
      if (!selectedActionId || isExtractingAudio) return;

      // Find the selected action's media file
      let mediaFile: MediaFile | undefined;
      for (const row of editorData) {
        const action = row.actions.find((a) => a.id === selectedActionId) as MediaAction | undefined;
        if (action?.mediaFile) {
          mediaFile = action.mediaFile;
          break;
        }
      }

      if (!mediaFile || mediaFile.type !== "video") return;

      setIsExtractingAudio(true);
      try {
        const result = await audioApi.extractAudio(mediaFile.url);

        // Create an audio MediaFile and add it to the timeline
        const audioFile: MediaFile = {
          name: mediaFile.name.replace(/\.[^.]+$/, "_audio.mp3"),
          url: result.url,
          path: result.url,
          type: "audio",
          duration: result.duration,
        };

        // Add to track 1 (audio track) via the addMedia imperative handle
        addMedia(audioFile, result.duration, 1);
      } catch (err) {
        console.error("[Timeline] Extract audio failed:", err);
      } finally {
        setIsExtractingAudio(false);
      }
    }, [selectedActionId, editorData, isExtractingAudio, addMedia]);

    // Delete / Backspace to remove selected clip, Ctrl+Shift+Backspace to clear all
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Backspace") {
          e.preventDefault();
          handleClearTimeline();
          return;
        }
        if ((e.key === "Delete" || e.key === "Backspace") && selectedActionId) {
          e.preventDefault();
          handleDelete();
        }
        if (e.key === "d" && selectedActionId && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handleDuplicate();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleClearTimeline, handleDelete, handleDuplicate, selectedActionId]);

    // Move clip between tracks (works for media clips on editorData tracks)
    const moveClipToTrack = useCallback(
      (direction: "up" | "down") => {
        if (!selectedActionId) return;

        // Text overlays, transitions, overlays are on managed tracks — skip
        if (
          selectedActionId.startsWith("text-") ||
          selectedActionId.startsWith("transition-") ||
          selectedActionId.startsWith("overlay-")
        ) return;

        setEditorData((prev) => {
          let sourceIdx = -1;
          let actionToMove: MediaAction | null = null;

          for (let i = 0; i < prev.length; i++) {
            const action = prev[i].actions.find(
              (a) => a.id === selectedActionId
            );
            if (action) {
              sourceIdx = i;
              actionToMove = action as MediaAction;
              break;
            }
          }

          if (sourceIdx === -1 || !actionToMove) return prev;
          const targetIdx = direction === "up" ? sourceIdx - 1 : sourceIdx + 1;
          if (targetIdx < 0 || targetIdx >= prev.length) return prev;

          const newData = [...prev];
          newData[sourceIdx] = {
            ...newData[sourceIdx],
            actions: newData[sourceIdx].actions.filter(
              (a) => a.id !== selectedActionId
            ),
          };
          newData[targetIdx] = {
            ...newData[targetIdx],
            actions: [...newData[targetIdx].actions, actionToMove],
          };
          return newData;
        });
      },
      [selectedActionId]
    );

    // Track index helpers — search editorData for media clips
    const getSelectedClipTrackIndex = useCallback(() => {
      for (let i = 0; i < editorData.length; i++) {
        if (editorData[i].actions.some((a) => a.id === selectedActionId)) return i;
      }
      return -1;
    }, [editorData, selectedActionId]);

    // Determine if the selected item is a media clip (movable between tracks)
    const isMediaClip = selectedActionId !== null &&
      !selectedActionId.startsWith("text-") &&
      !selectedActionId.startsWith("transition-") &&
      !selectedActionId.startsWith("overlay-");

    const selectedTrackIndex = isMediaClip
      ? getSelectedClipTrackIndex()
      : -1;
    const canMoveUp = isMediaClip && selectedTrackIndex > 0;
    const canMoveDown =
      isMediaClip &&
      selectedTrackIndex >= 0 &&
      selectedTrackIndex < editorData.length - 1;

    // Split clip at current time (works for video, audio, image, text overlays, video overlays)
    const handleSplit = useCallback(() => {
      if (!selectedActionId) return;
      const time = engine.timeRef.current;

      // Split text overlay
      if (selectedActionId.startsWith("text-") && onTextOverlaysChange) {
        const overlay = textOverlays.find((t) => t.id === selectedActionId);
        if (overlay && time > overlay.startTime && time < overlay.endTime) {
          const newId = `text-${Date.now()}`;
          const updated = textOverlays.flatMap((t) =>
            t.id === selectedActionId
              ? [
                  { ...t, endTime: time },
                  { ...t, id: newId, startTime: time },
                ]
              : [t]
          );
          onTextOverlaysChange(updated);
          setSelectedActionId(newId);
        }
        return;
      }

      // Split video overlay
      if (selectedActionId.startsWith("overlay-") && onVideoOverlaysChange) {
        const overlay = videoOverlays.find((o) => o.id === selectedActionId);
        if (overlay && time > overlay.startTime && time < overlay.endTime) {
          const newId = `overlay-${Date.now()}`;
          const updated = videoOverlays.flatMap((o) =>
            o.id === selectedActionId
              ? [
                  { ...o, endTime: time },
                  { ...o, id: newId, startTime: time },
                ]
              : [o]
          );
          onVideoOverlaysChange(updated);
          setSelectedActionId(newId);
        }
        return;
      }

      // Split media clip (video, audio, image)
      setEditorData((prev) => {
        return prev.map((row) => {
          const idx = row.actions.findIndex((a) => a.id === selectedActionId);
          if (idx === -1) return row;

          const action = row.actions[idx] as MediaAction;
          if (time <= action.start || time >= action.end) return row;

          const newId = `action-${Date.now()}`;
          // Calculate media offset for the second half:
          // existing offset + how far into this clip the split point is
          const existingOffset = action.mediaOffset || 0;
          const splitOffset = existingOffset + (time - action.start);

          const newActions = [...row.actions];
          newActions.splice(
            idx,
            1,
            { ...action, end: time } as MediaAction,
            { ...action, id: newId, start: time, mediaOffset: splitOffset } as MediaAction
          );
          setSelectedActionId(newId);
          return { ...row, actions: newActions };
        });
      });
    }, [selectedActionId, engine.timeRef, textOverlays, onTextOverlaysChange, videoOverlays, onVideoOverlaysChange]);

    const canSplit =
      selectedActionId &&
      (editorData.some((row) =>
        row.actions.some(
          (a) =>
            a.id === selectedActionId &&
            engine.displayTime > a.start &&
            engine.displayTime < a.end
        )
      ) ||
      (selectedActionId.startsWith("text-") &&
        textOverlays.some((t) =>
          t.id === selectedActionId &&
          engine.displayTime > t.startTime &&
          engine.displayTime < t.endTime
        )) ||
      (selectedActionId.startsWith("overlay-") &&
        videoOverlays.some((o) =>
          o.id === selectedActionId &&
          engine.displayTime > o.startTime &&
          engine.displayTime < o.endTime
        )));

    // Split keyboard shortcut (S)
    useEffect(() => {
      const handleSplitKey = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if (e.key === "s" && selectedActionId && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handleSplit();
        }
      };
      window.addEventListener("keydown", handleSplitKey);
      return () => window.removeEventListener("keydown", handleSplitKey);
    }, [handleSplit, selectedActionId]);

    useImperativeHandle(ref, () => ({ addMedia, getClipAtTime, splitAtPlayhead: handleSplit }), [
      addMedia,
      getClipAtTime,
      handleSplit,
    ]);

    // Handle timeline cursor drag
    const handleTimeChange = useCallback(
      (time: number) => engine.seek(time),
      [engine.seek]
    );

    // Preserve custom properties across timeline lib updates
    const actionsMapRef = useRef<Map<string, MediaAction>>(new Map());

    useEffect(() => {
      const map = new Map<string, MediaAction>();
      editorData.forEach((row) => {
        row.actions.forEach((action) => {
          map.set(action.id, action as MediaAction);
        });
      });
      actionsMapRef.current = map;
    }, [editorData]);

    // Debounce timer for syncing managed tracks to parent
    const managedSyncTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleDataChange = useCallback(
      (data: TimelineRow[]) => {
        // Update managed track refs directly (no re-render, keeps drag smooth)
        const transitionsTrack = data.find((row) => row.id === "track-transitions");
        if (transitionsTrack) managedTracksRef.current.transitions = transitionsTrack;

        const textTrack = data.find((row) => row.id === "track-text");
        if (textTrack) managedTracksRef.current.text = textTrack;

        const overlayTrack = data.find((row) => row.id === "track-overlays");
        if (overlayTrack) managedTracksRef.current.overlays = overlayTrack;

        // Debounced sync to parent — avoids re-render storms during drag
        if (managedSyncTimerRef.current) clearTimeout(managedSyncTimerRef.current);
        managedSyncTimerRef.current = setTimeout(() => {
          // Sync transitions
          if (transitionsTrack && onTransitionsChange && transitions) {
            const updated = transitionsTrack.actions
              .map((action) => {
                const original = transitions.find((t) => t.id === action.id);
                if (!original) return null;
                return {
                  ...original,
                  startTime: action.start,
                  duration: action.end - action.start,
                };
              })
              .filter((t): t is Transition => t !== null);

            const hasChanged = updated.some((t, i) => {
              const orig = transitions[i];
              return !orig || t.startTime !== orig.startTime || t.duration !== orig.duration;
            });
            if (hasChanged) onTransitionsChange(updated);
          }

          // Sync text overlays
          if (textTrack && onTextOverlaysChange && textOverlays) {
            const updated = textTrack.actions
              .map((action) => {
                const original = textOverlays.find((t) => t.id === action.id);
                if (!original) return null;
                return {
                  ...original,
                  startTime: action.start,
                  endTime: action.end,
                };
              })
              .filter((t): t is TextOverlay => t !== null);

            const hasChanged = updated.some((t, i) => {
              const orig = textOverlays[i];
              return !orig || t.startTime !== orig.startTime || t.endTime !== orig.endTime;
            });
            if (hasChanged) onTextOverlaysChange(updated);
          }

          // Sync video overlays
          if (overlayTrack && onVideoOverlaysChange && videoOverlays) {
            const updated = overlayTrack.actions
              .map((action) => {
                const original = videoOverlays.find((o) => o.id === action.id);
                if (!original) return null;
                return {
                  ...original,
                  startTime: action.start,
                  endTime: action.end,
                };
              })
              .filter((o): o is VideoOverlay => o !== null);

            const hasChanged = updated.some((o, i) => {
              const orig = videoOverlays[i];
              return !orig || o.startTime !== orig.startTime || o.endTime !== orig.endTime;
            });
            if (hasChanged) onVideoOverlaysChange(updated);
          }
        }, 100);

        // Filter out managed tracks, merge back custom properties for media tracks
        const filteredData = data.filter(
          (row) => row.id !== "track-text" && row.id !== "track-transitions" && row.id !== "track-overlays" && row.id !== "track-captions"
        );
        const mergedData = filteredData.map((row) => ({
          ...row,
          actions: row.actions.map((action) => {
            const original = actionsMapRef.current.get(action.id);
            return original
              ? { ...action, mediaFile: original.mediaFile, name: original.name, mediaOffset: original.mediaOffset }
              : action;
          }),
        }));

        // Only update state if data actually changed (prevents infinite loop:
        // setEditorData → mergedEditorData → TimelineEditor prop → onChange → setEditorData)
        setEditorData((prev) => {
          const prevFp = JSON.stringify(prev.map((r) => ({ id: r.id, actions: r.actions.map((a) => `${a.id}:${a.start}:${a.end}`) })));
          const nextFp = JSON.stringify(mergedData.map((r) => ({ id: r.id, actions: r.actions.map((a) => `${a.id}:${a.start}:${a.end}`) })));
          if (prevFp === nextFp) return prev;
          return mergedData;
        });
      },
      [transitions, onTransitionsChange, textOverlays, onTextOverlaysChange, videoOverlays, onVideoOverlaysChange]
    );

    const handleClickAction = useCallback(
      (
        _e: React.MouseEvent,
        { action, row }: { action: TimelineAction; row: TimelineRow }
      ) => {
        setSelectedActionId(action.id);

        // Notify parent if an overlay is selected
        if (action.id.startsWith("overlay-")) {
          onSelectedOverlayChange?.(action.id);
        } else {
          onSelectedOverlayChange?.(null);
        }

        // Notify parent of selected clip so EditorSidebar tools work
        if (onCurrentClipChange) {
          const mediaAction = action as MediaAction;
          if (mediaAction.mediaFile) {
            const trackIndex = editorData.findIndex((r) => r.id === row.id);
            onCurrentClipChange({
              id: action.id,
              startTime: action.start,
              endTime: action.end,
              trackIndex: trackIndex >= 0 ? trackIndex : 0,
              mediaFile: mediaAction.mediaFile,
              mediaOffset: mediaAction.mediaOffset,
            });
          }
        }
      },
      [editorData, onCurrentClipChange, onSelectedOverlayChange]
    );

    if (!isMounted) {
      return (
        <div
          style={{
            height: timelineHeight,
            backgroundColor: "#0d0d0f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#666",
          }}
        >
          Loading timeline...
        </div>
      );
    }

    const actionCount = editorData.reduce(
      (sum, row) => sum + row.actions.length,
      0
    );
    // Stable key — only remount when track count changes, NOT on split/edit
    const editorKey = `timeline-${editorData.length}`;

    return (
      <footer
        ref={containerRef}
        className={cn(
          "flex-none bg-[#0d0d0f] flex flex-col z-20 transition-all border-t border-neutral-800/50",
          isDraggingResize ? "select-none" : ""
        )}
        style={{ height: `${timelineHeight}px` }}
      >
        {/* Resize Handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          onTouchStart={handleResizeTouchStart}
          className={cn(
            "w-full cursor-ns-resize flex items-center justify-center group transition-colors",
            isMobile ? "h-4 touch-none" : "h-2",
            isDraggingResize ? "border-t border-blue-500" : "border-t border-neutral-800 hover:border-neutral-600"
          )}
        >
          <div
            className={cn(
              "rounded-full transition-colors",
              isMobile ? "w-10 h-1" : "w-12 h-1",
              isDraggingResize
                ? "bg-blue-500"
                : "bg-neutral-700 group-hover:bg-neutral-500"
            )}
          />
        </div>

        {/* Transport Controls */}
        {isMobile ? (
          /* ── Mobile transport: time | skip/play/skip (centered) | dropdown ── */
          <div className="h-11 flex items-center px-3 border-b border-neutral-800/50 bg-[#0a0a0b]">
            {/* Left — time display */}
            <div className="w-16 text-[11px] font-mono text-neutral-400 tracking-wide">
              {formatTime(engine.displayTime)}
              <span className="text-neutral-600 mx-0.5">/</span>
              {formatTime(engine.duration)}
            </div>

            {/* Center — play controls */}
            <div className="flex-1 flex items-center justify-center gap-2">
              <IconButton icon={SkipBack} onClick={engine.skipToStart} tooltip="Start" size="sm" />
              <button
                onClick={engine.togglePlayback}
                className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black"
              >
                {engine.isPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-black" strokeWidth={1.5} />
                ) : (
                  <Play className="w-3.5 h-3.5 ml-0.5 fill-black" strokeWidth={1.5} />
                )}
              </button>
              <IconButton
                icon={SkipForward}
                onClick={engine.skipToEnd}
                disabled={engine.displayTime >= engine.duration}
                tooltip="End"
                size="sm"
              />
            </div>

            {/* Right — more tools dropdown */}
            <div className="relative w-8">
              <button
                onClick={() => setShowMobileTools((v) => !v)}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-md transition-colors",
                  showMobileTools ? "bg-neutral-800 text-white" : "text-neutral-500"
                )}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {showMobileTools && (
                <div className="absolute right-0 bottom-full mb-1 w-48 bg-[#141416] border border-neutral-800 rounded-lg shadow-xl z-50 py-1">
                  <button onClick={() => { handleSplit(); setShowMobileTools(false); }} disabled={!canSplit} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30">
                    <Scissors className="w-3.5 h-3.5" /> Split
                  </button>
                  <button onClick={() => { handleDelete(); setShowMobileTools(false); }} disabled={!selectedActionId} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                  <button onClick={() => { handleDuplicate(); setShowMobileTools(false); }} disabled={!selectedActionId} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30">
                    <Copy className="w-3.5 h-3.5" /> Duplicate
                  </button>
                  <div className="h-px bg-neutral-800 my-1" />
                  <button onClick={() => { handleExtractAudio(); setShowMobileTools(false); }} disabled={!hasSelectedClip || isExtractingAudio} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30">
                    <AudioLines className="w-3.5 h-3.5" /> Extract Audio
                  </button>
                  <button onClick={() => { onCropClick?.(); setShowMobileTools(false); }} disabled={!hasSelectedClip} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30">
                    <Crop className="w-3.5 h-3.5" /> Crop
                  </button>
                  <button onClick={() => { onOverlayClick?.(); setShowMobileTools(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-neutral-400 hover:bg-neutral-800 hover:text-white">
                    <Layers className="w-3.5 h-3.5" /> Overlays
                  </button>
                  <div className="h-px bg-neutral-800 my-1" />
                  <button onClick={() => { onUndo?.(); setShowMobileTools(false); }} disabled={!canUndo} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30">
                    <Undo2 className="w-3.5 h-3.5" /> Undo
                  </button>
                  <button onClick={() => { onRedo?.(); setShowMobileTools(false); }} disabled={!canRedo} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-30">
                    <Redo2 className="w-3.5 h-3.5" /> Redo
                  </button>
                  <div className="h-px bg-neutral-800 my-1" />
                  <button onClick={() => { handleClearTimeline(); setShowMobileTools(false); }} disabled={actionCount === 0} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-red-400 hover:bg-neutral-800 disabled:opacity-30">
                    <FolderX className="w-3.5 h-3.5" /> Clear All
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Desktop transport: full toolbar ── */
          <div className="h-14 flex items-center justify-between px-4 border-b border-neutral-800/50 bg-[#0a0a0b]">
            {/* Left — editing tools */}
            <div className="flex items-center gap-1">
              <IconButton
                icon={Scissors}
                onClick={handleSplit}
                disabled={!canSplit}
                tooltip="Split (S)"
              />
              <IconButton
                icon={Trash2}
                onClick={handleDelete}
                disabled={!selectedActionId}
                tooltip="Delete Clip (Del)"
              />
              <IconButton
                icon={Copy}
                onClick={handleDuplicate}
                disabled={!selectedActionId}
                tooltip="Duplicate Clip (D)"
              />
              <IconButton
                icon={ChevronUp}
                onClick={() => moveClipToTrack("up")}
                disabled={!canMoveUp}
                tooltip="Move to Track Above"
              />
              <IconButton
                icon={ChevronDown}
                onClick={() => moveClipToTrack("down")}
                disabled={!canMoveDown}
                tooltip="Move to Track Below"
              />
              <div className="w-px h-5 bg-neutral-800 mx-1.5" />
              <IconButton
                icon={AudioLines}
                onClick={handleExtractAudio}
                disabled={!hasSelectedClip || isExtractingAudio}
                tooltip={isExtractingAudio ? "Extracting..." : "Extract Audio"}
              />
              <IconButton
                icon={Crop}
                onClick={onCropClick}
                disabled={!hasSelectedClip && !(selectedActionId?.startsWith("overlay-"))}
                tooltip="Crop"
              />
              <IconButton
                icon={Layers}
                onClick={onOverlayClick}
                tooltip="Overlay Layers"
              />
              <span className="text-xs text-neutral-500 ml-2">
                {actionCount} clip{actionCount !== 1 ? "s" : ""}
              </span>
              <div className="w-px h-5 bg-neutral-800 mx-1" />
              <button
                onClick={() => {
                  setEditorData((prev) => [
                    ...prev,
                    { id: `track-${prev.length}`, actions: [] },
                  ]);
                }}
                title="Add Track"
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all"
              >
                <Plus className="w-4 h-4" strokeWidth={2} />
                <span className="text-xs">Track</span>
              </button>
              <div className="w-px h-5 bg-neutral-800 mx-1.5" />
              <IconButton
                icon={FolderX}
                onClick={handleClearTimeline}
                disabled={actionCount === 0}
                tooltip="Clear Timeline"
                size="sm"
              />
            </div>

            {/* Center — playback */}
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium text-neutral-300 w-8 text-center">
                1x
              </div>
              <div className="flex items-center gap-4">
                <IconButton
                  icon={SkipBack}
                  onClick={engine.skipToStart}
                  tooltip="Skip to Start"
                />
                <button
                  onClick={engine.togglePlayback}
                  className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-md"
                >
                  {engine.isPlaying ? (
                    <Pause
                      className="w-4 h-4 fill-black"
                      strokeWidth={1.5}
                    />
                  ) : (
                    <Play
                      className="w-4 h-4 ml-0.5 fill-black"
                      strokeWidth={1.5}
                    />
                  )}
                </button>
                <IconButton
                  icon={SkipForward}
                  onClick={engine.skipToEnd}
                  disabled={engine.displayTime >= engine.duration}
                  tooltip="Skip to End"
                />
              </div>
              <div className="text-xs font-mono text-neutral-400 w-28 text-center tracking-wide">
                {formatTime(engine.displayTime)}
                <span className="text-neutral-600 mx-1">/</span>
                {formatTime(engine.duration)}
              </div>
            </div>

            {/* Right — undo/redo + zoom + PiP */}
            <div className="w-[320px] flex items-center justify-end gap-3">
              <IconButton
                icon={Undo2}
                onClick={onUndo}
                disabled={!canUndo}
                tooltip="Undo (Ctrl+Z)"
                size="sm"
              />
              <IconButton
                icon={Redo2}
                onClick={onRedo}
                disabled={!canRedo}
                tooltip="Redo (Ctrl+Shift+Z)"
                size="sm"
              />
              <div className="w-px h-5 bg-neutral-800" />
              <Minus className="w-3 h-3 text-neutral-500" strokeWidth={2} />
              <Slider
                value={[zoom]}
                min={50}
                max={300}
                step={10}
                onValueChange={(values) => onZoomChange(values[0])}
                className="w-24"
              />
              <Plus className="w-3 h-3 text-neutral-400" strokeWidth={2} />
              <span className="text-[10px] text-neutral-500 w-10">
                {zoom}%
              </span>
              {onPiPToggle && (
                <button
                  onClick={onPiPToggle}
                  title={isPiP ? "Exit Picture-in-Picture" : "Picture-in-Picture"}
                  className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-md transition-all",
                    isPiP
                      ? "bg-cyan-500 text-black hover:bg-cyan-400"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800"
                  )}
                >
                  <PictureInPicture2 className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Timeline Editor */}
        <div className={cn("flex-1 min-h-0", isMobile ? "overflow-auto timeline-mobile-scroll" : "overflow-hidden")}>
          <TimelineEditor
            key={editorKey}
            ref={timelineRef}
            editorData={mergedEditorData}
            effects={effects}
            onChange={handleDataChange}
            onCursorDragEnd={handleTimeChange}
            onClickAction={handleClickAction}
            scale={100 / zoom}
            scaleWidth={160}
            scaleSplitCount={10}
            maxScaleCount={Math.ceil(calculateTotalDuration(mergedEditorData) / (100 / zoom)) + 1}
            rowHeight={50}
            startLeft={20}
            autoScroll={true}
            hideCursor={false}
            dragLine={true}
            getActionRender={(action, row) => (
              <CustomActionRenderer
                action={action as MediaAction}
                row={row}
              />
            )}
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#0a0a0a",
            }}
          />
        </div>
      </footer>
    );
  }
);

function createEmptyTracks(): TimelineRow[] {
  return [
    { id: "track-0", actions: [] }, // Video / Image track
    { id: "track-1", actions: [] }, // Audio track
  ];
}

/** Convert DB-loaded TimelineClip[] into the internal TimelineRow[] format */
function clipsToTracks(clips: TimelineClip[]): TimelineRow[] {
  const tracks = createEmptyTracks();
  for (const clip of clips) {
    if (!clip.mediaFile?.url) continue;
    const trackIdx = Math.min(clip.trackIndex, tracks.length - 1);
    const action: MediaAction = {
      id: clip.id,
      start: clip.startTime,
      end: clip.endTime,
      effectId:
        clip.mediaFile?.type === "audio"
          ? "audio"
          : clip.mediaFile?.type === "image"
          ? "image"
          : "video",
      mediaFile: clip.mediaFile,
      mediaOffset: clip.mediaOffset,
      name: clip.mediaFile?.name,
    };
    tracks[trackIdx].actions.push(action);
  }
  return tracks;
}
