"use client";

import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Img,
  Audio,
  Sequence,
  useCurrentFrame,
  Easing,
} from "remotion";
import type { TransitionType, VideoOverlay } from "@/types/editor";

// Per-clip error boundary — broken clips show a placeholder instead of crashing the whole composition
class ClipErrorBoundary extends React.Component<
  { children: React.ReactNode; clipId: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; clipId: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.warn(`[MultiClip] Clip ${this.props.clipId} failed to render: ${error.message}`);
  }
  render() {
    if (this.state.hasError) {
      return (
        <AbsoluteFill
          style={{
            backgroundColor: "#1a1a1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#666",
            fontSize: 14,
          }}
        >
          Clip unavailable
        </AbsoluteFill>
      );
    }
    return this.props.children;
  }
}

export interface ClipData {
  id: string;
  src: string;
  type: "video" | "audio" | "image";
  startTime: number;
  endTime: number;
  /** Offset into the source media (seconds) — used when a clip is split */
  mediaOffset?: number;
  volume?: number;
  speed?: number;
  mirrorH?: boolean;
  mirrorV?: boolean;
  rotation?: number;
  crop?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface TransitionData {
  id: string;
  type: TransitionType;
  duration: number;
  startTime: number;
  clipAId: string;
  clipBId: string;
}

export interface TransitionProxyInfo {
  url: string;
  status: "pending" | "rendering" | "ready" | "error";
}

/** Plain object form for Remotion serialization (Map doesn't survive JSON.stringify) */
export type TransitionProxyMap = Record<string, TransitionProxyInfo>;

export interface MultiClipCompositionProps {
  clips: ClipData[];
  transitions: TransitionData[];
  fps: number;
  overlays?: VideoOverlay[];
  /** Pre-rendered proxy videos keyed by transition ID */
  transitionProxies?: TransitionProxyMap;
}

/**
 * Clip wrapper that applies transition styles directly to its own container.
 * No extra video decoders — the clip's existing OffthreadVideo is reused
 * and just gets CSS transforms/opacity/clip-path applied during transitions.
 *
 * CSS transitions ALWAYS run as the baseline. If a pre-rendered proxy is
 * available, it renders ON TOP (zIndex 10) and naturally covers the CSS
 * transition. This means we never get black screens from unloaded proxies.
 */
const ClipWithTransition: React.FC<{
  clip: ClipData;
  transitions: TransitionData[];
  fps: number;
  sequenceStartTime: number; // effective start time of the Sequence (may differ from clip.startTime)
}> = React.memo(({ clip, transitions, fps, sequenceStartTime }) => {
  const localFrame = useCurrentFrame();
  // absoluteFrame = sequenceStart + localFrame (Sequence from= is sequenceStartTime*fps)
  const absoluteFrame = Math.round(sequenceStartTime * fps) + localFrame;

  // Check if this clip is in an active transition at the current frame
  let containerStyle: React.CSSProperties = {};
  let containerOpacity = 1;
  let audioVolumeMult = 1; // Audio crossfade multiplier (0-1)
  let isIncomingBeforeTransition = false;

  for (const t of transitions) {
    const tStartFrame = Math.round(t.startTime * fps);
    const tDurationFrames = Math.round(t.duration * fps);
    const tEndFrame = tStartFrame + tDurationFrames;

    if (absoluteFrame >= tStartFrame && absoluteFrame < tEndFrame) {
      const progress = Math.min(
        1,
        Math.max(0, (absoluteFrame - tStartFrame) / Math.max(1, tDurationFrames))
      );
      const { styleA, styleB, opacityA, opacityB } = getTransitionStyles(
        t.type,
        progress
      );

      if (t.clipAId === clip.id) {
        // Outgoing clip — fade audio out
        containerStyle = styleA;
        containerOpacity = opacityA;
        audioVolumeMult = 1 - progress;
      } else if (t.clipBId === clip.id) {
        // Incoming clip — fade audio in
        containerStyle = styleB;
        containerOpacity = opacityB;
        audioVolumeMult = progress;
      }
      break;
    }

    // If this is the incoming clip and we're BEFORE the transition starts,
    // hide it completely so it doesn't flash at full opacity
    if (t.clipBId === clip.id && absoluteFrame < tStartFrame) {
      isIncomingBeforeTransition = true;
    }
  }

  // Hide incoming clip that's rendering early (extended Sequence) but transition hasn't started
  if (isIncomingBeforeTransition) {
    containerOpacity = 0;
    audioVolumeMult = 0;
  }

  // When clip starts rendering earlier than its actual startTime (for incoming transition),
  // we still start the video from frame 0 — the transition handles hiding it until it's visible.
  // mediaOffset accounts for split clips that start partway through the source video.
  const mediaOffsetFrames = Math.round((clip.mediaOffset || 0) * fps);
  const videoStartOffset = Math.max(0, Math.round((sequenceStartTime - clip.startTime) * fps)) + mediaOffsetFrames;

  // Build CSS transform for rotation + mirror
  const editTransforms: string[] = [];
  if (clip.rotation) editTransforms.push(`rotate(${clip.rotation}deg)`);
  if (clip.mirrorH) editTransforms.push("scaleX(-1)");
  if (clip.mirrorV) editTransforms.push("scaleY(-1)");
  const editTransform = editTransforms.length > 0 ? editTransforms.join(" ") : undefined;

  // Build crop clip-path (percentage-based inset)
  const hasCrop = clip.crop && (clip.crop.top > 0 || clip.crop.right > 0 || clip.crop.bottom > 0 || clip.crop.left > 0);
  const cropClipPath = hasCrop
    ? `inset(${clip.crop!.top}% ${clip.crop!.right}% ${clip.crop!.bottom}% ${clip.crop!.left}%)`
    : undefined;

  const clipVolume = clip.volume ?? 1;
  const clipSpeed = clip.speed ?? 1;
  const effectiveVolume = clipVolume * audioVolumeMult;

  const content = (() => {
    if (clip.type === "video") {
      return (
        <OffthreadVideo
          src={clip.src}
          startFrom={Math.abs(videoStartOffset)}
          playbackRate={clipSpeed}
          volume={effectiveVolume}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: editTransform,
          }}
          pauseWhenBuffering
        />
      );
    }
    if (clip.type === "image") {
      return (
        <Img
          src={clip.src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: editTransform,
          }}
          pauseWhenLoading
        />
      );
    }
    if (clip.type === "audio") {
      return (
        <Audio
          src={clip.src}
          startFrom={mediaOffsetFrames}
          playbackRate={clipSpeed}
          volume={effectiveVolume}
          pauseWhenBuffering
        />
      );
    }
    return null;
  })();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: clip.type === "audio" ? "transparent" : "#000",
        overflow: "hidden",
        contain: "layout style paint",
        ...containerStyle,
        opacity: containerOpacity,
      }}
    >
      <ClipErrorBoundary clipId={clip.id}>
        {cropClipPath ? (
          <div style={{ width: "100%", height: "100%", clipPath: cropClipPath }}>
            {content}
          </div>
        ) : (
          content
        )}
      </ClipErrorBoundary>
    </AbsoluteFill>
  );
});
ClipWithTransition.displayName = "ClipWithTransition";

/**
 * Helper to set mask-image with vendor prefix for Safari.
 * mask-image is GPU-composited — unlike clipPath which triggers
 * CPU layout/paint every frame and causes stutter on complex shapes.
 */
function maskStyle(mask: string): React.CSSProperties {
  return {
    WebkitMaskImage: mask,
    maskImage: mask,
  } as React.CSSProperties;
}

/**
 * Get CSS styles for a transition at a given progress (0-1).
 *
 * Performance strategy:
 *  - opacity + transform are GPU-composited → always smooth
 *  - clipPath triggers CPU paint every frame → replaced with mask-image gradients
 *  - mask-image with linear/radial-gradient is GPU-composited in modern browsers
 *  - All containers get will-change + translateZ(0) for GPU compositing layer promotion
 */
function getTransitionStyles(
  type: TransitionType,
  progress: number
): {
  styleA: React.CSSProperties;
  styleB: React.CSSProperties;
  opacityA: number;
  opacityB: number;
} {
  // Smooth easing — gentle cubic for motion, standard for opacity
  const eased = Easing.bezier(0.25, 0.1, 0.25, 1.0)(progress);

  // GPU compositing base — applied to all transition styles
  const gpuA: React.CSSProperties = { willChange: "transform, opacity", transform: "translateZ(0)" };
  const gpuB: React.CSSProperties = { willChange: "transform, opacity", transform: "translateZ(0)" };

  switch (type) {
    case "fade":
    case "dissolve":
      return { styleA: gpuA, styleB: gpuB, opacityA: 1 - eased, opacityB: eased };

    case "fadeblack": {
      const bp = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      return {
        styleA: gpuA,
        styleB: gpuB,
        opacityA: progress < 0.5 ? 1 - bp : 0,
        opacityB: progress >= 0.5 ? 1 - bp : 0,
      };
    }

    case "fadewhite":
      return { styleA: gpuA, styleB: gpuB, opacityA: 1 - eased, opacityB: eased };

    // ── Wipes: soft-feathered mask-image gradients (5% spread for smooth edge) ──
    case "wipeleft":
    case "coverleft":
    case "smoothleft": {
      const p = eased * 100;
      const f = 5; // feather spread %
      return {
        styleA: { ...gpuA, ...maskStyle(`linear-gradient(to left, transparent ${Math.max(0, p - f)}%, black ${Math.min(100, p + f)}%)`) },
        styleB: { ...gpuB, ...maskStyle(`linear-gradient(to right, black ${Math.max(0, p - f)}%, transparent ${Math.min(100, p + f)}%)`) },
        opacityA: 1,
        opacityB: 1,
      };
    }

    case "wiperight":
    case "coverright":
    case "smoothright": {
      const p = eased * 100;
      const f = 5;
      return {
        styleA: { ...gpuA, ...maskStyle(`linear-gradient(to right, transparent ${Math.max(0, p - f)}%, black ${Math.min(100, p + f)}%)`) },
        styleB: { ...gpuB, ...maskStyle(`linear-gradient(to left, black ${Math.max(0, p - f)}%, transparent ${Math.min(100, p + f)}%)`) },
        opacityA: 1,
        opacityB: 1,
      };
    }

    case "wipeup": {
      const p = eased * 100;
      const f = 5;
      return {
        styleA: { ...gpuA, ...maskStyle(`linear-gradient(to top, transparent ${Math.max(0, p - f)}%, black ${Math.min(100, p + f)}%)`) },
        styleB: { ...gpuB, ...maskStyle(`linear-gradient(to bottom, black ${Math.max(0, p - f)}%, transparent ${Math.min(100, p + f)}%)`) },
        opacityA: 1,
        opacityB: 1,
      };
    }

    case "wipedown": {
      const p = eased * 100;
      const f = 5;
      return {
        styleA: { ...gpuA, ...maskStyle(`linear-gradient(to bottom, transparent ${Math.max(0, p - f)}%, black ${Math.min(100, p + f)}%)`) },
        styleB: { ...gpuB, ...maskStyle(`linear-gradient(to top, black ${Math.max(0, p - f)}%, transparent ${Math.min(100, p + f)}%)`) },
        opacityA: 1,
        opacityB: 1,
      };
    }

    // ── Slides: transform + slight opacity blend for smoother feel ──
    case "slideleft":
    case "revealleft":
      return {
        styleA: { willChange: "transform, opacity", transform: `translateX(${-eased * 100}%) translateZ(0)` },
        styleB: { willChange: "transform, opacity", transform: `translateX(${(1 - eased) * 100}%) translateZ(0)` },
        opacityA: 1 - eased * 0.15,
        opacityB: 0.85 + eased * 0.15,
      };

    case "slideright":
    case "revealright":
      return {
        styleA: { willChange: "transform, opacity", transform: `translateX(${eased * 100}%) translateZ(0)` },
        styleB: { willChange: "transform, opacity", transform: `translateX(${-(1 - eased) * 100}%) translateZ(0)` },
        opacityA: 1 - eased * 0.15,
        opacityB: 0.85 + eased * 0.15,
      };

    case "slideup":
      return {
        styleA: { willChange: "transform, opacity", transform: `translateY(${-eased * 100}%) translateZ(0)` },
        styleB: { willChange: "transform, opacity", transform: `translateY(${(1 - eased) * 100}%) translateZ(0)` },
        opacityA: 1 - eased * 0.15,
        opacityB: 0.85 + eased * 0.15,
      };

    case "slidedown":
      return {
        styleA: { willChange: "transform, opacity", transform: `translateY(${eased * 100}%) translateZ(0)` },
        styleB: { willChange: "transform, opacity", transform: `translateY(${-(1 - eased) * 100}%) translateZ(0)` },
        opacityA: 1 - eased * 0.15,
        opacityB: 0.85 + eased * 0.15,
      };

    case "zoomin":
      return {
        styleA: { willChange: "transform, opacity", transform: `scale(${1 + eased * 0.5}) translateZ(0)` },
        styleB: { willChange: "transform, opacity", transform: `scale(${0.5 + eased * 0.5}) translateZ(0)` },
        opacityA: 1 - eased,
        opacityB: eased,
      };

    // ── Circle transitions: radial-gradient mask instead of clipPath ──
    case "circleopen": {
      const r = eased * 75;
      return {
        styleA: gpuA,
        styleB: { ...gpuB, ...maskStyle(`radial-gradient(circle at 50% 50%, black ${r}%, transparent ${r}%)`) },
        opacityA: 1,
        opacityB: 1,
      };
    }

    case "circleclose": {
      const r = (1 - eased) * 75;
      return {
        styleA: { ...gpuA, ...maskStyle(`radial-gradient(circle at 50% 50%, black ${r}%, transparent ${r}%)`) },
        styleB: gpuB,
        opacityA: 1,
        opacityB: 1,
      };
    }

    case "radial": {
      const r = eased * 75;
      return {
        styleA: gpuA,
        styleB: { ...gpuB, ...maskStyle(`radial-gradient(circle at 50% 50%, black ${r}%, transparent ${r}%)`) },
        opacityA: 1 - (eased > 0.8 ? (eased - 0.8) * 5 : 0),
        opacityB: 1,
      };
    }

    case "pixelize":
      return { styleA: gpuA, styleB: gpuB, opacityA: 1 - eased, opacityB: eased };

    // ── Diagonal transitions: angled gradient mask instead of clipPath polygon ──
    case "diagtl": {
      // Wipe from top-left corner using a 135deg gradient
      const p = eased * 140; // overshoot slightly so it fully covers
      return {
        styleA: { ...gpuA, ...maskStyle(`linear-gradient(135deg, transparent ${p - 10}%, black ${p}%)`) },
        styleB: { ...gpuB, ...maskStyle(`linear-gradient(135deg, black ${p - 10}%, transparent ${p}%)`) },
        opacityA: 1,
        opacityB: 1,
      };
    }

    case "diagtr": {
      const p = eased * 140;
      return {
        styleA: { ...gpuA, ...maskStyle(`linear-gradient(225deg, transparent ${p - 10}%, black ${p}%)`) },
        styleB: { ...gpuB, ...maskStyle(`linear-gradient(225deg, black ${p - 10}%, transparent ${p}%)`) },
        opacityA: 1,
        opacityB: 1,
      };
    }

    // ── Squeeze: transform-based, already GPU-accelerated ──
    case "squeezev":
      return {
        styleA: { willChange: "transform", transform: `scaleY(${1 - eased}) translateZ(0)` },
        styleB: { willChange: "transform", transform: `scaleY(${eased}) translateZ(0)` },
        opacityA: 1,
        opacityB: 1,
      };

    case "squeezeh":
      return {
        styleA: { willChange: "transform", transform: `scaleX(${1 - eased}) translateZ(0)` },
        styleB: { willChange: "transform", transform: `scaleX(${eased}) translateZ(0)` },
        opacityA: 1,
        opacityB: 1,
      };

    default:
      return { styleA: gpuA, styleB: gpuB, opacityA: 1 - eased, opacityB: eased };
  }
}

/**
 * Multi-clip composition — each clip renders as a full Sequence with its own
 * single OffthreadVideo. Transition styles (transforms, opacity, clip-path)
 * are applied directly to the clip's container, so NO extra video decoders
 * are created during transitions. Maximum 2 decoders active at any time.
 *
 * CSS transitions handle the live preview. FFmpeg xfade is used for exports
 * where frame-perfect quality matters and there's no real-time constraint.
 */
export const MultiClipComposition: React.FC<MultiClipCompositionProps> = ({
  clips,
  transitions,
  fps,
  overlays = [],
}) => {
  const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);

  if (sortedClips.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
        <div
          style={{
            color: "#444",
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            fontSize: 18,
          }}
        >
          No clips
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {sortedClips.map((clip) => {
        // Extend clip rendering window to cover any transitions it participates in
        let effectiveStart = clip.startTime;
        let effectiveEnd = clip.endTime;

        for (const t of transitions) {
          const tEnd = t.startTime + t.duration;
          if (t.clipAId === clip.id) {
            // Outgoing clip — extend end to cover transition
            effectiveEnd = Math.max(effectiveEnd, tEnd);
          }
          if (t.clipBId === clip.id) {
            // Incoming clip — start earlier to cover transition
            effectiveStart = Math.min(effectiveStart, t.startTime);
          }
        }

        const startFrame = Math.round(effectiveStart * fps);
        const durationFrames = Math.round((effectiveEnd - effectiveStart) * fps);
        if (durationFrames <= 0) return null;
        return (
          <Sequence
            key={clip.id}
            from={startFrame}
            durationInFrames={durationFrames}
            layout="none"
          >
            <ClipWithTransition
              clip={clip}
              transitions={transitions}
              fps={fps}
              sequenceStartTime={effectiveStart}
            />
          </Sequence>
        );
      })}

      {/* Video/Image Overlays — rendered on top of clips */}
      {overlays.map((vo) => {
        const startFrame = Math.round(vo.startTime * fps);
        const durationFrames = Math.round((vo.endTime - vo.startTime) * fps);
        if (durationFrames <= 0) return null;

        return (
          <Sequence
            key={vo.id}
            from={startFrame}
            durationInFrames={durationFrames}
            layout="none"
          >
            <AbsoluteFill
              style={{
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${vo.x}%`,
                  top: `${vo.y}%`,
                  width: `${vo.width}%`,
                  height: `${vo.height}%`,
                  opacity: vo.opacity,
                  transform: vo.rotation ? `rotate(${vo.rotation}deg)` : undefined,
                  overflow: "hidden",
                  clipPath: vo.crop && (vo.crop.top > 0 || vo.crop.right > 0 || vo.crop.bottom > 0 || vo.crop.left > 0)
                    ? `inset(${vo.crop.top}% ${vo.crop.right}% ${vo.crop.bottom}% ${vo.crop.left}%)`
                    : undefined,
                }}
              >
                {vo.type === "image" ? (
                  <Img
                    src={vo.src}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <OffthreadVideo
                    src={vo.src}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    volume={0}
                    pauseWhenBuffering
                  />
                )}
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
