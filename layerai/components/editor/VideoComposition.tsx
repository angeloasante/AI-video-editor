"use client";

import { AbsoluteFill, OffthreadVideo, Audio, Img, useCurrentFrame, useVideoConfig } from "remotion";

// Props for the video composition
export interface VideoCompositionProps {
  src: string;
  type: "video" | "audio" | "image";
}

// Main composition that renders video/audio/image
export const VideoComposition: React.FC<VideoCompositionProps> = ({ src, type }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Guard against empty/missing src — Remotion crashes if src is empty
  if (!src) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#666",
        }}
      >
        No media source
      </AbsoluteFill>
    );
  }

  if (type === "video") {
    return (
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        <OffthreadVideo
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
          volume={1}
          pauseWhenBuffering
        />
      </AbsoluteFill>
    );
  }

  if (type === "audio") {
    // For audio, show a waveform visualization or placeholder
    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Audio src={src} volume={1} pauseWhenBuffering />
        {/* Audio visualization */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            height: 100,
          }}
        >
          {Array.from({ length: 40 }).map((_, i) => {
            const height = Math.abs(Math.sin((frame / fps) * 4 + i * 0.3)) * 80 + 20;
            return (
              <div
                key={i}
                style={{
                  width: 4,
                  height,
                  backgroundColor: "#a855f7",
                  borderRadius: 2,
                  transition: "height 0.1s ease",
                }}
              />
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }

  if (type === "image") {
    // For images, add a subtle zoom effect
    const scale = 1 + (frame / durationInFrames) * 0.05;
    return (
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: `scale(${scale})`,
          }}
          pauseWhenLoading
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#666",
      }}
    >
      No media
    </AbsoluteFill>
  );
};
