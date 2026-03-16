"use client";

import { useRef, useCallback } from "react";
import { MediaFile } from "@/lib/supabase";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

// Max width for proxy files (640px = fast decoding)
const PROXY_MAX_WIDTH = 640;

interface ProxyResult {
  url: string;
  width: number;
  height: number;
  duration: number;
}

/**
 * Hook that generates low-resolution proxy files for preview playback.
 *
 * When a video is added to the timeline, call `generateProxy(file)` to
 * request a low-res WebM from the Python backend. The proxy URL is set
 * on `file.proxyUrl` so VideoPreview/MultiClipComposition can use it
 * instead of the original full-res file.
 *
 * Images and audio don't need proxies (images are already fast to decode,
 * audio doesn't benefit from lower resolution).
 */
export function useProxyGeneration() {
  // Track which URLs already have proxies (or are being generated)
  const pendingRef = useRef<Set<string>>(new Set());
  const cacheRef = useRef<Map<string, string>>(new Map());

  const generateProxy = useCallback(
    async (
      file: MediaFile,
      projectId: string = "default"
    ): Promise<MediaFile> => {
      // Only generate proxies for video files
      if (file.type !== "video") return file;

      // Already has a proxy
      if (file.proxyUrl) return file;

      // Check cache
      const cached = cacheRef.current.get(file.url);
      if (cached) return { ...file, proxyUrl: cached };

      // Already generating
      if (pendingRef.current.has(file.url)) return file;

      pendingRef.current.add(file.url);

      try {
        const response = await fetch(`${API_BASE_URL}/preview/proxy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            clipId: file.path || file.name,
            videoUrl: file.url,
            format: "webm",
            quality: "low",
            maxWidth: PROXY_MAX_WIDTH,
          }),
        });

        if (!response.ok) {
          console.warn(`Proxy generation failed for ${file.name}: ${response.status}`);
          return file;
        }

        const result: { success: boolean; data?: ProxyResult } =
          await response.json();

        if (result.success && result.data?.url) {
          cacheRef.current.set(file.url, result.data.url);
          return { ...file, proxyUrl: result.data.url };
        }
      } catch (err) {
        console.warn(`Proxy generation error for ${file.name}:`, err);
      } finally {
        pendingRef.current.delete(file.url);
      }

      return file;
    },
    []
  );

  /**
   * Generate proxies for all video clips in a list.
   * Returns the same list with proxyUrl populated where available.
   */
  const generateProxiesForClips = useCallback(
    async (
      files: MediaFile[],
      projectId: string = "default"
    ): Promise<MediaFile[]> => {
      const results = await Promise.all(
        files.map((f) => generateProxy(f, projectId))
      );
      return results;
    },
    [generateProxy]
  );

  return { generateProxy, generateProxiesForClips };
}
