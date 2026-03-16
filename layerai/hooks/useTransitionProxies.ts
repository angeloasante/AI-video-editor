"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { transitionApi } from "@/lib/api";
import type { Transition } from "@/types/editor";
import type { MediaFile } from "@/lib/supabase";
import type { TransitionProxyMap } from "@/components/editor/MultiClipComposition";

interface TimelineClip {
  id: string;
  startTime: number;
  endTime: number;
  mediaFile?: MediaFile;
}

/**
 * Build a fingerprint for a transition so we can detect when it needs re-rendering.
 */
function buildFingerprint(t: Transition, clips: TimelineClip[]): string {
  const clipA = clips.find((c) => c.id === t.clipAId);
  const clipB = clips.find((c) => c.id === t.clipBId);
  return [
    t.type,
    t.duration.toFixed(3),
    clipA?.mediaFile?.proxyUrl || clipA?.mediaFile?.url || "",
    clipB?.mediaFile?.proxyUrl || clipB?.mediaFile?.url || "",
    clipA?.endTime.toFixed(3) || "",
    clipB?.startTime.toFixed(3) || "",
  ].join("|");
}

const MAX_RETRIES = 1; // Only retry once — don't spam a broken backend

/**
 * Manages pre-rendered transition proxy videos.
 *
 * STABILITY RULES (critical for smooth playback):
 * - The returned map ONLY changes when a proxy becomes "ready" (new URL available)
 * - Intermediate states (rendering, error) are tracked internally via refs
 * - This prevents Remotion Player from re-rendering on every status change
 * - If the backend is unavailable (404/500), we disable after first failure
 *
 * CSS transitions are the fallback and keep working while proxies render.
 */
export function useTransitionProxies(
  transitions: Transition[],
  clips: TimelineClip[]
): TransitionProxyMap {
  // Only "ready" proxies are exposed — this is what Remotion sees.
  // We NEVER update this for intermediate states to avoid re-renders.
  const [readyProxies, setReadyProxies] = useState<TransitionProxyMap>({});

  // Internal tracking — refs don't cause re-renders
  const inflightRef = useRef<Set<string>>(new Set());
  const fingerprintRef = useRef<Record<string, string>>({});
  const retryCountRef = useRef<Record<string, number>>({});
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const backendAvailableRef = useRef(true); // disable hook if backend is down

  const renderProxy = useCallback(
    async (transition: Transition, fingerprint: string) => {
      if (!backendAvailableRef.current) return;

      const clipA = clips.find((c) => c.id === transition.clipAId);
      const clipB = clips.find((c) => c.id === transition.clipBId);
      if (!clipA?.mediaFile?.url || !clipB?.mediaFile?.url) return;

      const key = transition.id;
      if (inflightRef.current.has(key)) return;

      // Check retry limit
      const retries = retryCountRef.current[key] || 0;
      if (retries >= MAX_RETRIES) return;

      inflightRef.current.add(key);
      fingerprintRef.current[key] = fingerprint;

      try {
        const result = await transitionApi.renderProxy({
          clipAUrl: clipA.mediaFile.proxyUrl || clipA.mediaFile.url,
          clipBUrl: clipB.mediaFile.proxyUrl || clipB.mediaFile.url,
          transitionType: transition.type,
          duration: transition.duration,
          clipAEndTime: clipA.endTime,
          clipBStartTime: clipB.startTime,
        });

        // SUCCESS — only NOW do we update the exposed state
        retryCountRef.current[key] = 0;
        setReadyProxies((prev) => ({
          ...prev,
          [key]: { url: result.url, status: "ready" },
        }));
      } catch (err) {
        console.warn(`[TransitionProxy] Failed for ${key}:`, err);
        retryCountRef.current[key] = retries + 1;

        // If this looks like a backend-down error (404, network), disable entirely
        const errMsg = String(err);
        if (errMsg.includes("404") || errMsg.includes("Failed to fetch") || errMsg.includes("NetworkError")) {
          console.warn("[TransitionProxy] Backend unavailable — disabling proxy renders");
          backendAvailableRef.current = false;
        }
        // Do NOT call setReadyProxies — errors stay internal, no re-render
      } finally {
        inflightRef.current.delete(key);
      }
    },
    [clips]
  );

  useEffect(() => {
    if (!backendAvailableRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      // Clean up proxies for deleted transitions
      setReadyProxies((prev) => {
        const ids = new Set(transitions.map((t) => t.id));
        let changed = false;
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (!ids.has(key)) {
            delete next[key];
            delete fingerprintRef.current[key];
            delete retryCountRef.current[key];
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      // Trigger renders for new or changed transitions
      for (const t of transitions) {
        const fp = buildFingerprint(t, clips);
        const existingFp = fingerprintRef.current[t.id];

        // Skip if fingerprint matches (already rendered or in-flight with same params)
        if (existingFp === fp) continue;

        // Reset retry count for changed transitions
        if (existingFp !== fp) {
          retryCountRef.current[t.id] = 0;
        }

        renderProxy(t, fp);
      }
    }, 1500); // Longer debounce — user needs to settle before we hit the backend

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [transitions, clips, renderProxy]);

  return readyProxies;
}
