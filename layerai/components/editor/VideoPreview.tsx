"use client";

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { Upload, AlertTriangle } from "lucide-react";
import { Player, PlayerRef } from "@remotion/player";
import { prefetch } from "remotion";
import { Rnd } from "react-rnd";
import Moveable from "react-moveable";
import { VideoComposition } from "./VideoComposition";
import {
  MultiClipComposition,
  ClipData,
  TransitionData,
} from "./MultiClipComposition";
import { MediaFile } from "@/lib/supabase";
import type { PlaybackEngine } from "@/hooks/usePlaybackEngine";
import type { TextOverlay, Transition, VideoOverlay } from "@/types/editor";

export type { MediaFile };


// Error boundary to catch Remotion video decode failures
class PlayerErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry?: () => void },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode; onRetry?: () => void }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error) {
    console.error("[VideoPreview] Remotion error:", error.message);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-neutral-900 rounded-lg p-6">
          <AlertTriangle className="w-8 h-8 text-yellow-500 mb-3" />
          <p className="text-sm text-neutral-300 mb-1">Video preview error</p>
          <p className="text-xs text-neutral-500 mb-3 text-center max-w-xs">
            A clip may have a broken source. Try removing it from the timeline.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: "" })}
            className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md border border-neutral-700"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface VideoPreviewHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  togglePiP: () => void;
  isPiP: boolean;
}

export type AspectRatio = "16:9" | "9:16" | "4:5" | "1:1" | "4:3" | "21:9";

// Timeline clip with media info for composition
export interface TimelineClipWithMedia {
  id: string;
  startTime: number;
  endTime: number;
  mediaFile?: MediaFile;
  /** Offset into source media in seconds (set when clip is split) */
  mediaOffset?: number;
}

interface VideoPreviewProps {
  engine: PlaybackEngine;
  mediaFile?: MediaFile | null;
  clipStartTime?: number;
  textOverlays?: TextOverlay[];
  transitions?: Transition[];
  timelineClips?: TimelineClipWithMedia[];
  clipEditsMap?: Record<string, import("@/types/editor").ClipEdits>;
  videoOverlays?: VideoOverlay[];
  onOverlayPositionChange?: (id: string, x: number, y: number) => void;
  onOverlaySizeChange?: (id: string, width: number, height: number) => void;
  onTextPositionChange?: (id: string, x: number, y: number) => void;
  onTextTransformChange?: (id: string, transform: { scale?: number; rotation?: number; fontSize?: number }) => void;
  isMobile?: boolean;
}

const FPS = 30;

// Preset styles for text overlays
const PRESET_STYLES: Record<string, React.CSSProperties> = {
  title: { fontSize: "48px", fontWeight: 700 },
  subtitle: { fontSize: "32px", fontWeight: 500 },
  body: { fontSize: "24px", fontWeight: 400 },
  caption: { fontSize: "18px", fontWeight: 300 },
  quote: { fontSize: "28px", fontWeight: 400, fontStyle: "italic" },
};

export const VideoPreview = forwardRef<VideoPreviewHandle, VideoPreviewProps>(
  function VideoPreview(
    {
      engine,
      mediaFile,
      clipStartTime = 0,
      textOverlays = [],
      transitions = [],
      timelineClips = [],
      clipEditsMap = {},
      videoOverlays = [],
      onOverlayPositionChange,
      onOverlaySizeChange,
      onTextPositionChange,
      onTextTransformChange,
      isMobile,
    },
    ref
  ) {
    const playerRef = useRef<PlayerRef>(null);
    const [durationInFrames, setDurationInFrames] = useState(FPS * 60);
    const [isMounted, setIsMounted] = useState(false);
    const [videoDimensions, setVideoDimensions] = useState({
      width: 1920,
      height: 1080,
    });

    // Text overlay visibility — updated via engine subscription, not per-render
    const [activeOverlayIds, setActiveOverlayIds] = useState<Set<string>>(
      new Set()
    );
    const activeOverlayIdsRef = useRef<Set<string>>(new Set());

    // Video overlay visibility — updated via engine subscription
    const [activeVideoOverlayIds, setActiveVideoOverlayIds] = useState<Set<string>>(new Set());
    const activeVideoOverlayIdsRef = useRef<Set<string>>(new Set());

    // Text overlay selection state
    const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Picture-in-Picture
    const [isPiP, setIsPiP] = useState(false);
    const togglePiP = useCallback(async () => {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          setIsPiP(false);
          return;
        }
        // Find the video element inside the Remotion Player
        const container = containerRef.current;
        if (!container) return;
        const video = container.querySelector("video");
        if (video && video.requestPictureInPicture) {
          await video.requestPictureInPicture();
          setIsPiP(true);
          video.addEventListener("leavepictureinpicture", () => setIsPiP(false), { once: true });
        }
      } catch (err) {
        console.warn("PiP not supported or failed:", err);
      }
    }, []);

    // Prefetch tracking
    const prefetchedUrlsRef = useRef<Set<string>>(new Set());
    const prefetchHandlesRef = useRef<Map<string, { free: () => void }>>(
      new Map()
    );
    const lastMediaUrlRef = useRef<string | null>(null);

    // In multi-clip mode, lock composition dimensions to the first clip's
    // aspect ratio so the Player never resizes mid-playback or during transitions.
    const lockedDimensionsRef = useRef<{ width: number; height: number } | null>(null);

    useEffect(() => {
      setIsMounted(true);
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      play: () => playerRef.current?.play(),
      pause: () => playerRef.current?.pause(),
      seek: (time: number) => playerRef.current?.seekTo(Math.round(time * FPS)),
      getCurrentTime: () => (playerRef.current?.getCurrentFrame() || 0) / FPS,
      getDuration: () => durationInFrames / FPS,
      togglePiP,
      isPiP,
    }), [durationInFrames, togglePiP, isPiP]);

    // Load video duration and dimensions when media changes (single-clip mode only).
    // In multi-clip mode, dimensions are locked to the first clip — see below.
    useEffect(() => {
      // In multi-clip mode, don't update dimensions from currentMediaFile
      // (they're locked from the first clip to prevent resize during transitions)
      if (timelineClips.length > 0) return;

      if (!mediaFile) {
        setDurationInFrames(FPS * 5);
        setVideoDimensions(isMobile ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 });
        return;
      }

      if (mediaFile.type === "image") {
        const img = new Image();
        img.onload = () => {
          setVideoDimensions({
            width: img.naturalWidth || 1920,
            height: img.naturalHeight || 1080,
          });
        };
        img.src = mediaFile.url;
        setDurationInFrames(FPS * 5);
        return;
      }

      let element: HTMLVideoElement | HTMLAudioElement | null = null;
      let cancelled = false;

      const timeout = setTimeout(() => {
        if (!cancelled) setDurationInFrames(FPS * 10);
      }, 3000);

      if (mediaFile.type === "video") {
        element = document.createElement("video");
        element.crossOrigin = "anonymous";
        element.preload = "metadata";
        element.onloadedmetadata = () => {
          if (cancelled) return;
          clearTimeout(timeout);
          const v = element as HTMLVideoElement;
          setDurationInFrames(Math.max(Math.ceil(v.duration * FPS), FPS));
          setVideoDimensions({
            width: v.videoWidth || 1920,
            height: v.videoHeight || 1080,
          });
        };
        element.onerror = () => {
          if (!cancelled) {
            clearTimeout(timeout);
            setDurationInFrames(FPS * 10);
          }
        };
        element.src = mediaFile.url;
      } else if (mediaFile.type === "audio") {
        element = document.createElement("audio");
        element.crossOrigin = "anonymous";
        element.preload = "metadata";
        element.onloadedmetadata = () => {
          if (!cancelled) {
            clearTimeout(timeout);
            setDurationInFrames(
              Math.max(Math.ceil(element!.duration * FPS), FPS)
            );
          }
        };
        element.onerror = () => {
          if (!cancelled) {
            clearTimeout(timeout);
            setDurationInFrames(FPS * 10);
          }
        };
        element.src = mediaFile.url;
      }

      return () => {
        cancelled = true;
        clearTimeout(timeout);
        if (element) {
          element.onloadedmetadata = null;
          element.onerror = null;
          element.src = "";
        }
      };
    }, [mediaFile, timelineClips.length]);

    // In multi-clip mode: probe the first video clip's dimensions once and lock them.
    // This prevents the composition from resizing when the playhead crosses clips.
    useEffect(() => {
      if (timelineClips.length === 0) {
        lockedDimensionsRef.current = null;
        return;
      }

      // Already locked — don't re-probe
      if (lockedDimensionsRef.current) return;

      // Find the first video clip with a URL
      const firstVideoClip = timelineClips.find(
        (c) => c.mediaFile?.type === "video" && c.mediaFile?.url
      );
      const firstImageClip = timelineClips.find(
        (c) => c.mediaFile?.type === "image" && c.mediaFile?.url
      );
      const probeClip = firstVideoClip || firstImageClip;

      if (!probeClip?.mediaFile) return;

      let cancelled = false;

      if (probeClip.mediaFile.type === "video") {
        const v = document.createElement("video");
        v.crossOrigin = "anonymous";
        v.preload = "metadata";
        v.onloadedmetadata = () => {
          if (cancelled) return;
          const dims = {
            width: v.videoWidth || 1920,
            height: v.videoHeight || 1080,
          };
          lockedDimensionsRef.current = dims;
          setVideoDimensions(dims);
          v.remove();
        };
        v.onerror = () => v.remove();
        v.src = probeClip.mediaFile.url;
      } else if (probeClip.mediaFile.type === "image") {
        const img = new Image();
        img.onload = () => {
          if (cancelled) return;
          const dims = {
            width: img.naturalWidth || 1920,
            height: img.naturalHeight || 1080,
          };
          lockedDimensionsRef.current = dims;
          setVideoDimensions(dims);
        };
        img.src = probeClip.mediaFile.url;
      }

      return () => { cancelled = true; };
    }, [timelineClips]);

    // Track engine.isPlaying in a ref so subscribe closures always have current value
    const isPlayingRef = useRef(false);
    useEffect(() => {
      isPlayingRef.current = engine.isPlaying;
    }, [engine.isPlaying]);

    // Multi-clip mode
    const useMultiClipMode = timelineClips.length >= 1;


    const multiClips: ClipData[] = useMemo(() => {
      if (!useMultiClipMode) return [];
      return timelineClips
        .filter((clip) => {
          const url = clip.mediaFile?.proxyUrl || clip.mediaFile?.url;
          return url && url.length > 0;
        })
        .map((clip) => {
          const edits = clipEditsMap[clip.id];
          const src = clip.mediaFile!.proxyUrl || clip.mediaFile!.url;
          if (!src) return null; // safety guard
          return {
            id: clip.id,
            src,
            type: (clip.mediaFile!.type || "video") as "video" | "audio" | "image",
            startTime: clip.startTime,
            endTime: clip.endTime,
            mediaOffset: clip.mediaOffset,
            volume: edits?.volume,
            speed: edits?.speed,
            mirrorH: edits?.mirrorH,
            mirrorV: edits?.mirrorV,
            rotation: edits?.rotation,
            crop: edits?.crop,
          };
        })
        .filter((c) => c !== null) as ClipData[];
    }, [timelineClips, useMultiClipMode, clipEditsMap]);

    const multiTransitions: TransitionData[] = useMemo(() => {
      if (!useMultiClipMode) return [];
      const validClipIds = new Set(multiClips.map((c) => c.id));
      return transitions
        .filter((t) => validClipIds.has(t.clipAId) && validClipIds.has(t.clipBId))
        .map((t) => ({
          id: t.id,
          type: t.type,
          duration: t.duration,
          startTime: t.startTime,
          clipAId: t.clipAId,
          clipBId: t.clipBId,
        }));
    }, [transitions, useMultiClipMode, multiClips]);

    const multiClipDurationInFrames = useMemo(() => {
      if (!useMultiClipMode || multiClips.length === 0) return durationInFrames;
      let maxEndTime = Math.max(...multiClips.map((c) => c.endTime));
      // Account for transitions extending beyond clip boundaries
      for (const t of multiTransitions) {
        maxEndTime = Math.max(maxEndTime, t.startTime + t.duration);
      }
      return Math.max(Math.round(maxEndTime * FPS) + FPS, FPS * 2);
    }, [multiClips, multiTransitions, useMultiClipMode, durationInFrames]);

    // Prefetch all timeline clips for smooth playback
    useEffect(() => {
      const urlsToFetch = new Set<string>();

      timelineClips.forEach((clip) => {
        const url = clip.mediaFile?.proxyUrl || clip.mediaFile?.url;
        if (url && !prefetchedUrlsRef.current.has(url)) {
          urlsToFetch.add(url);
        }
      });
      if (mediaFile?.url && !prefetchedUrlsRef.current.has(mediaFile.url)) {
        urlsToFetch.add(mediaFile.url);
      }

      if (urlsToFetch.size === 0) return;

      urlsToFetch.forEach((url) => {
        try {
          const handle = prefetch(url, { method: "blob-url" });
          prefetchHandlesRef.current.set(url, handle);
          handle
            .waitUntilDone()
            .then(() => {
              prefetchedUrlsRef.current.add(url);
            })
            .catch(() => {});
        } catch {}
      });
    }, [timelineClips, mediaFile?.url]);

    // Cleanup prefetch handles on unmount
    useEffect(() => {
      return () => {
        prefetchHandlesRef.current.forEach((handle) => {
          try {
            handle.free();
          } catch {}
        });
        prefetchHandlesRef.current.clear();
      };
    }, []);

    // Convert timeline time → Remotion frame number
    const getTargetFrame = useCallback(
      (time: number) => {
        let targetFrame: number;
        let maxFrame: number;

        if (useMultiClipMode && multiClips.length > 0) {
          targetFrame = Math.round(time * FPS);
          maxFrame = multiClipDurationInFrames - 1;
        } else {
          const clipRelative = Math.max(0, time - clipStartTime);
          targetFrame = Math.round(clipRelative * FPS);
          maxFrame = durationInFrames - 1;
        }

        return Math.max(0, Math.min(targetFrame, maxFrame));
      },
      [useMultiClipMode, multiClips.length, multiClipDurationInFrames, clipStartTime, durationInFrames]
    );

    // ── Hybrid clock: Remotion plays for audio, timeline corrects drift ──
    //
    // During PLAYBACK:
    //   - Remotion Player.play() runs so audio decodes normally
    //   - Timeline is the source of truth for position
    //   - On each rAF tick we compare Remotion's current frame to the timeline's
    //     expected frame; if drift > DRIFT_THRESHOLD we seekTo to re-sync
    //   - seekTo during play causes a brief buffer pause — acceptable only for
    //     large jumps, not every frame
    //
    // During SCRUB (paused):
    //   - Remotion stays paused, we seekTo every frame change for exact positioning

    const DRIFT_THRESHOLD = 8; // frames — allow ±8 frames before correcting (avoids seek-induced black flashes)

    // Grace period after play starts — don't drift-correct until Remotion has stabilized
    const playStartTimeRef = useRef<number>(0);
    const PLAY_GRACE_MS = 600; // ms to wait before drift correction after play starts

    // ── Decoder warm-up system ──
    // Browsers suspend video decoders when a tab is idle. When the user returns,
    // the first play() shows black until the decoder re-initializes. We solve this
    // by (a) re-seeking on tab focus to force a decode, (b) verifying a frame is
    // actually rendered before calling play(), and (c) periodic keep-alive seeks.
    const isDecoderWarmRef = useRef(true);
    const warmUpResolveRef = useRef<(() => void) | null>(null);

    // When the tab regains visibility, immediately re-seek to force a frame decode
    useEffect(() => {
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          isDecoderWarmRef.current = false;
          const player = playerRef.current;
          if (player && !isPlayingRef.current) {
            // Force decode by seeking to current frame
            const frame = getTargetFrame(engine.timeRef.current);
            player.seekTo(frame);
            // Also nudge the underlying <video> elements directly
            const container = containerRef.current;
            if (container) {
              const videos = container.querySelectorAll("video");
              videos.forEach((v) => {
                if (v.readyState < 2) {
                  // HAVE_CURRENT_DATA — video hasn't decoded yet
                  v.load(); // re-trigger decode
                }
              });
            }
            // Mark warm after a generous decode window
            setTimeout(() => { isDecoderWarmRef.current = true; }, 500);
          }
        } else {
          isDecoderWarmRef.current = false;
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, [getTargetFrame, engine.timeRef]);

    // Keep-alive: periodically re-seek while paused to keep the decoder warm.
    // Browsers can evict decoded frames after ~30-60s of inactivity.
    useEffect(() => {
      const interval = setInterval(() => {
        if (isPlayingRef.current) return; // only needed while paused
        const player = playerRef.current;
        if (!player) return;
        if (document.visibilityState !== "visible") return;
        const frame = getTargetFrame(engine.timeRef.current);
        player.seekTo(frame);
        isDecoderWarmRef.current = true;
      }, 15000); // every 15 seconds

      return () => clearInterval(interval);
    }, [getTargetFrame, engine.timeRef]);

    /**
     * Wait for the underlying <video> element to have a decoded frame ready.
     * Returns a promise that resolves once readyState >= HAVE_CURRENT_DATA (2),
     * or after a maximum timeout so we never hang forever.
     */
    const waitForVideoReady = useCallback((maxWait = 1500): Promise<void> => {
      return new Promise((resolve) => {
        const container = containerRef.current;
        if (!container) { resolve(); return; }

        const videos = container.querySelectorAll("video");
        if (videos.length === 0) { resolve(); return; }

        // If the primary video already has data, we're good
        const primaryVideo = videos[0];
        if (primaryVideo.readyState >= 2) {
          isDecoderWarmRef.current = true;
          resolve();
          return;
        }

        let resolved = false;
        const done = () => {
          if (resolved) return;
          resolved = true;
          isDecoderWarmRef.current = true;
          warmUpResolveRef.current = null;
          resolve();
        };

        warmUpResolveRef.current = done;

        // Listen for the video to have enough data
        const onCanPlay = () => { primaryVideo.removeEventListener("canplay", onCanPlay); done(); };
        const onLoadedData = () => { primaryVideo.removeEventListener("loadeddata", onLoadedData); done(); };
        primaryVideo.addEventListener("canplay", onCanPlay);
        primaryVideo.addEventListener("loadeddata", onLoadedData);

        // Timeout fallback — don't block forever
        setTimeout(() => {
          primaryVideo.removeEventListener("canplay", onCanPlay);
          primaryVideo.removeEventListener("loadeddata", onLoadedData);
          done();
        }, maxWait);
      });
    }, []);

    // Play/pause sync — start/stop Remotion when engine state changes
    useEffect(() => {
      const player = playerRef.current;
      if (!player) return;

      if (engine.isPlaying) {
        const frame = getTargetFrame(engine.timeRef.current);
        player.seekTo(frame);

        if (isMobile) {
          // On mobile, call play() synchronously to stay within the user gesture
          // chain. Async delays (waitForVideoReady, setTimeout) cause the browser
          // to block autoplay because the gesture is no longer "recent".
          playStartTimeRef.current = performance.now();
          player.play();
        } else {
          let cancelled = false;

          const startPlayback = async () => {
            // If the decoder was suspended (tab was idle), wait for a frame to decode
            if (!isDecoderWarmRef.current) {
              await waitForVideoReady(1500);
            } else {
              // Even if warm, give a brief moment for the seek to render
              await new Promise((r) => setTimeout(r, 80));
            }

            if (cancelled) return;

            playStartTimeRef.current = performance.now();
            playerRef.current?.play();
          };

          startPlayback();

          return () => {
            cancelled = true;
            warmUpResolveRef.current?.();
          };
        }
      } else {
        player.pause();
        const frame = getTargetFrame(engine.timeRef.current);
        player.seekTo(frame);
      }
    }, [engine.isPlaying, engine.timeRef, getTargetFrame, waitForVideoReady, isMobile]);

    // Frame-by-frame sync via engine subscription
    useEffect(() => {
      let lastFrame = -1;

      return engine.subscribe((time) => {
        const player = playerRef.current;
        if (!player) return;

        const targetFrame = getTargetFrame(time);

        if (isPlayingRef.current) {
          // Skip drift correction during the grace period after play starts
          // to let the Remotion Player buffer and stabilize
          if (performance.now() - playStartTimeRef.current < PLAY_GRACE_MS) return;

          // During playback: only correct significant drift to keep audio smooth
          const currentFrame = player.getCurrentFrame();
          if (Math.abs(targetFrame - currentFrame) > DRIFT_THRESHOLD) {
            player.seekTo(targetFrame);
          }
        } else {
          // During scrub: seek every frame change for exact positioning
          if (targetFrame !== lastFrame) {
            player.seekTo(targetFrame);
            lastFrame = targetFrame;
          }
        }
      });
    }, [engine.subscribe, getTargetFrame]);

    // Stop engine when Remotion reaches the end of composition
    useEffect(() => {
      const player = playerRef.current;
      if (!player) return;

      const handleEnded = () => {
        engine.pause();
      };

      player.addEventListener("ended", handleEnded);
      return () => {
        try {
          player.removeEventListener("ended", handleEnded);
        } catch {}
      };
    }, [engine.pause]);

    // Track media URL changes for prefetch logic
    useEffect(() => {
      if (mediaFile?.url) {
        lastMediaUrlRef.current = mediaFile.url;
      }
    }, [mediaFile?.url]);

    // Subscribe to engine for text overlay visibility updates (throttled)
    useEffect(() => {
      if (textOverlays.length === 0) {
        if (activeOverlayIdsRef.current.size > 0) {
          activeOverlayIdsRef.current = new Set();
          setActiveOverlayIds(new Set());
        }
        return;
      }

      let lastUpdate = 0;

      return engine.subscribe((time) => {
        // Throttle to ~15fps for overlay visibility checks
        const now = performance.now();
        if (now - lastUpdate < 66) return;
        lastUpdate = now;

        const newIds = new Set<string>();
        for (const overlay of textOverlays) {
          if (time >= overlay.startTime && time < overlay.endTime) {
            newIds.add(overlay.id);
          }
        }

        // Only update React state if visibility actually changed
        const prev = activeOverlayIdsRef.current;
        if (newIds.size !== prev.size || [...newIds].some((id) => !prev.has(id))) {
          activeOverlayIdsRef.current = newIds;
          setActiveOverlayIds(newIds);
        }
      });
    }, [engine, textOverlays]);

    // Subscribe to engine for video overlay visibility updates
    useEffect(() => {
      if (videoOverlays.length === 0) {
        if (activeVideoOverlayIdsRef.current.size > 0) {
          activeVideoOverlayIdsRef.current = new Set();
          setActiveVideoOverlayIds(new Set());
        }
        return;
      }

      // Helper to compute visible overlays at a given time
      const computeVisible = (time: number) => {
        const newIds = new Set<string>();
        for (const overlay of videoOverlays) {
          if (time >= overlay.startTime && time < overlay.endTime) {
            newIds.add(overlay.id);
          }
        }
        const prev = activeVideoOverlayIdsRef.current;
        if (newIds.size !== prev.size || [...newIds].some((id) => !prev.has(id))) {
          activeVideoOverlayIdsRef.current = newIds;
          setActiveVideoOverlayIds(newIds);
        }
      };

      // Compute visibility immediately for current time (handles initial render + pause)
      computeVisible(engine.timeRef.current);

      let lastUpdate = 0;
      return engine.subscribe((time) => {
        const now = performance.now();
        if (now - lastUpdate < 66) return;
        lastUpdate = now;
        computeVisible(time);
      });
    }, [engine, videoOverlays]);

    // Active text overlays based on throttled visibility
    const activeTextOverlays = useMemo(() => {
      return textOverlays.filter((o) => activeOverlayIds.has(o.id));
    }, [textOverlays, activeOverlayIds]);

    // Load Google Fonts for text overlays that use custom fonts
    useEffect(() => {
      textOverlays.forEach((overlay) => {
        if (overlay.fontFamily) {
          const family = overlay.fontFamily.replace(/ /g, "+");
          const linkId = `gfont-${family}`;
          if (!document.getElementById(linkId)) {
            const link = document.createElement("link");
            link.id = linkId;
            link.rel = "stylesheet";
            link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
            document.head.appendChild(link);
          }
        }
      });
    }, [textOverlays]);

    // Active video overlays based on throttled visibility
    const activeVideoOverlays = useMemo(() => {
      return videoOverlays.filter((o) => activeVideoOverlayIds.has(o.id));
    }, [videoOverlays, activeVideoOverlayIds]);

    // Unified Player props — single Player instance to avoid audio tag remount
    const isMultiMode = useMultiClipMode && multiClips.length > 0;

    const playerComponent = isMultiMode ? MultiClipComposition : VideoComposition;

    const playerInputProps = useMemo(() => {
      if (isMultiMode) {
        return { clips: multiClips, transitions: multiTransitions, fps: FPS, overlays: [] };
      }
      return {
        src: mediaFile?.proxyUrl || mediaFile?.url || "",
        type: (mediaFile?.type || "video") as "video" | "audio" | "image",
      };
    }, [isMultiMode, multiClips, multiTransitions, mediaFile?.url, mediaFile?.proxyUrl, mediaFile?.type]);

    const playerDuration = isMultiMode ? multiClipDurationInFrames : durationInFrames;

    // Track container size for percentage-based positioning
    const [containerSize, setContainerSize] = useState({ width: 800, height: 450 });
    useEffect(() => {
      if (!containerRef.current) return;
      const obs = new ResizeObserver(([entry]) => {
        setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      });
      obs.observe(containerRef.current);
      return () => obs.disconnect();
    }, []);

    return (
      <section
        data-preview-container
        className="flex-1 flex items-center justify-center overflow-hidden min-w-[300px] bg-[#0a0a0a] rounded-xl"
      >
        <div
          ref={containerRef}
          className="relative w-full h-full flex items-center justify-center"
          onClick={(e) => {
            // Deselect text when clicking on the container background
            if (e.target === e.currentTarget || (e.target as HTMLElement).closest("[data-player-container]")) {
              setSelectedTextId(null);
            }
          }}
        >
          {(mediaFile || useMultiClipMode) && isMounted ? (
            <div
              className="relative"
              style={{
                width: "100%",
                maxWidth: 800,
                aspectRatio: `${videoDimensions.width} / ${videoDimensions.height}`,
              }}
            >
              <PlayerErrorBoundary>
                <Player
                  ref={playerRef}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  component={playerComponent as any}
                  inputProps={playerInputProps as any}
                  durationInFrames={playerDuration}
                  compositionWidth={videoDimensions.width}
                  compositionHeight={videoDimensions.height}
                  fps={FPS}
                  style={{ width: "100%", height: "100%" }}
                  controls={false}
                  clickToPlay={false}
                  showVolumeControls={false}
                  loop={false}
                  bufferStateDelayInMilliseconds={500}
                  moveToBeginningWhenEnded={false}
                  numberOfSharedAudioTags={8}
                  acknowledgeRemotionLicense
                  initiallyMuted={false}
                />
              </PlayerErrorBoundary>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-4">
                <Upload className="w-6 h-6 text-neutral-500" />
              </div>
              <p className="text-sm text-neutral-400 mb-1">No media selected</p>
              <p className="text-xs text-neutral-600">
                Click a media item to add it to the timeline
              </p>
            </div>
          )}

          {/* Text Overlays — Moveable-based drag/resize */}
          {activeTextOverlays.map((overlay) => {
            const anim = overlay.animation || {
              type: "none" as const,
              fadeIn: 0,
              fadeOut: 0,
            };
            const overlayRotation = overlay.transform?.rotation ?? 0;
            const overlayFontSize = overlay.fontSize ?? (PRESET_STYLES[overlay.preset]?.fontSize ? parseInt(PRESET_STYLES[overlay.preset].fontSize as string) : 24);
            const isSelected = selectedTextId === overlay.id;

            // Convert percentage position to pixels
            const pxX = (overlay.position?.x ?? 50) / 100 * containerSize.width;
            const pxY = (overlay.position?.y ?? 50) / 100 * containerSize.height;

            return (
              <div
                key={overlay.id}
                data-text-overlay-id={overlay.id}
                className="text-overlay-target"
                style={{
                  position: "absolute",
                  left: pxX,
                  top: pxY,
                  zIndex: isSelected ? 50 : 35,
                  cursor: "move",
                  // CSS-based fade animation
                  animation: anim.type === "fade" || anim.type === "none"
                    ? `textFadeIn ${anim.fadeIn || 0.3}s ease-out forwards`
                    : anim.type === "scale"
                    ? `textScaleIn ${anim.fadeIn || 0.3}s ease-out forwards`
                    : anim.type === "slide-up"
                    ? `textSlideUp ${anim.fadeIn || 0.3}s ease-out forwards`
                    : anim.type === "slide-down"
                    ? `textSlideDown ${anim.fadeIn || 0.3}s ease-out forwards`
                    : anim.type === "bounce"
                    ? `textBounceIn ${anim.fadeIn || 0.5}s ease-out forwards`
                    : undefined,
                }}
                onMouseDown={() => setSelectedTextId(overlay.id)}
              >
                <div
                  className="text-center px-4 py-2 whitespace-pre-wrap select-none"
                  style={{
                    fontSize: `${overlayFontSize}px`,
                    fontFamily: overlay.fontFamily ? `"${overlay.fontFamily}", sans-serif` : undefined,
                    fontWeight: overlay.fontWeight ?? PRESET_STYLES[overlay.preset]?.fontWeight ?? 400,
                    fontStyle: PRESET_STYLES[overlay.preset]?.fontStyle,
                    color: overlay.color || "#ffffff",
                    textShadow:
                      "0 2px 4px rgba(0,0,0,0.8), 0 4px 8px rgba(0,0,0,0.6)",
                    transform: overlayRotation ? `rotate(${overlayRotation}deg)` : undefined,
                  }}
                >
                  {overlay.text}
                </div>
              </div>
            );
          })}

          {/* Moveable controller for selected text overlay */}
          {selectedTextId && (() => {
            const targetEl = containerRef.current?.querySelector(
              `[data-text-overlay-id="${selectedTextId}"]`
            ) as HTMLElement | null;
            if (!targetEl) return null;
            return (
              <Moveable
                target={targetEl}
                container={containerRef.current}
                draggable
                resizable
                bounds={{ left: 0, top: 0, right: containerSize.width, bottom: containerSize.height }}
                renderDirections={["nw", "ne", "sw", "se"]}
                edge={false}
                keepRatio={false}
                onDrag={({ left, top }) => {
                  targetEl.style.left = `${left}px`;
                  targetEl.style.top = `${top}px`;
                }}
                onDragEnd={({ lastEvent }) => {
                  if (!lastEvent || !onTextPositionChange || !containerSize.width) return;
                  const xPct = Math.max(0, Math.min(100, (lastEvent.left / containerSize.width) * 100));
                  const yPct = Math.max(0, Math.min(100, (lastEvent.top / containerSize.height) * 100));
                  onTextPositionChange(selectedTextId, xPct, yPct);
                }}
                onResize={({ width, height, drag }) => {
                  targetEl.style.width = `${width}px`;
                  targetEl.style.height = `${height}px`;
                  targetEl.style.left = `${drag.left}px`;
                  targetEl.style.top = `${drag.top}px`;
                }}
                onResizeEnd={({ lastEvent }) => {
                  if (!lastEvent || !onTextTransformChange) return;
                  const newFontSize = Math.max(12, Math.min(200, Math.round(lastEvent.height * 0.6)));
                  onTextTransformChange(selectedTextId, { fontSize: newFontSize });
                  if (onTextPositionChange && containerSize.width) {
                    const xPct = Math.max(0, Math.min(100, (lastEvent.drag.left / containerSize.width) * 100));
                    const yPct = Math.max(0, Math.min(100, (lastEvent.drag.top / containerSize.height) * 100));
                    onTextPositionChange(selectedTextId, xPct, yPct);
                  }
                }}
              />
            );
          })()}

          {/* Video Overlays — Rnd-based drag/resize */}
          {activeVideoOverlays.map((vo) => {
            const pxX = (vo.x / 100) * containerSize.width;
            const pxY = (vo.y / 100) * containerSize.height;
            const pxW = (vo.width / 100) * containerSize.width;
            const pxH = (vo.height / 100) * containerSize.height;

            return (
              <Rnd
                key={vo.id}
                position={{ x: pxX, y: pxY }}
                size={{ width: pxW, height: pxH }}
                enableResizing={{
                  topLeft: true, topRight: true,
                  bottomLeft: true, bottomRight: true,
                  top: true, right: true, bottom: true, left: true,
                }}
                lockAspectRatio
                bounds="parent"
                style={{ zIndex: vo.zIndex ?? 30 }}
                resizeHandleStyles={{
                  topLeft: { width: 10, height: 10, background: "#a855f7", borderRadius: "50%", top: -5, left: -5 },
                  topRight: { width: 10, height: 10, background: "#a855f7", borderRadius: "50%", top: -5, right: -5 },
                  bottomLeft: { width: 10, height: 10, background: "#a855f7", borderRadius: "50%", bottom: -5, left: -5 },
                  bottomRight: { width: 10, height: 10, background: "#a855f7", borderRadius: "50%", bottom: -5, right: -5 },
                }}
                onDragStop={(_e, d) => {
                  if (!onOverlayPositionChange || !containerSize.width) return;
                  const xPct = Math.max(0, Math.min(100, (d.x / containerSize.width) * 100));
                  const yPct = Math.max(0, Math.min(100, (d.y / containerSize.height) * 100));
                  onOverlayPositionChange(vo.id, xPct, yPct);
                }}
                onResizeStop={(_e, _dir, ref, _delta, pos) => {
                  if (!onOverlaySizeChange || !containerSize.width) return;
                  const wPct = Math.max(1, Math.min(100, (ref.offsetWidth / containerSize.width) * 100));
                  const hPct = Math.max(1, Math.min(100, (ref.offsetHeight / containerSize.height) * 100));
                  onOverlaySizeChange(vo.id, wPct, hPct);
                  if (onOverlayPositionChange) {
                    const xPct = Math.max(0, Math.min(100, (pos.x / containerSize.width) * 100));
                    const yPct = Math.max(0, Math.min(100, (pos.y / containerSize.height) * 100));
                    onOverlayPositionChange(vo.id, xPct, yPct);
                  }
                }}
              >
                <div
                  className="w-full h-full cursor-move select-none overflow-hidden rounded"
                  style={{
                    opacity: vo.opacity,
                    transform: vo.rotation ? `rotate(${vo.rotation}deg)` : undefined,
                    outline: "1px solid rgba(168,85,247,0.4)",
                    clipPath: vo.crop && (vo.crop.top > 0 || vo.crop.right > 0 || vo.crop.bottom > 0 || vo.crop.left > 0)
                      ? `inset(${vo.crop.top}% ${vo.crop.right}% ${vo.crop.bottom}% ${vo.crop.left}%)`
                      : undefined,
                  }}
                >
                  {vo.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={vo.src}
                      alt={vo.name}
                      className="w-full h-full object-contain pointer-events-none"
                      draggable={false}
                    />
                  ) : (
                    <video
                      src={vo.src}
                      className="w-full h-full object-contain pointer-events-none"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  )}
                </div>
              </Rnd>
            );
          })}
        </div>

        {/* CSS keyframe animations for text overlays */}
        <style jsx global>{`
          @keyframes textFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes textScaleIn {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          }
          @keyframes textSlideUp {
            from { opacity: 0; transform: translate(-50%, calc(-50% + 50px)); }
            to { opacity: 1; transform: translate(-50%, -50%); }
          }
          @keyframes textSlideDown {
            from { opacity: 0; transform: translate(-50%, calc(-50% - 50px)); }
            to { opacity: 1; transform: translate(-50%, -50%); }
          }
          @keyframes textBounceIn {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
            50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
            70% { transform: translate(-50%, -50%) scale(0.9); }
            100% { transform: translate(-50%, -50%) scale(1); }
          }
        `}</style>
      </section>
    );
  }
);
