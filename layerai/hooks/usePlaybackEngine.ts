"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";

const UI_UPDATE_RATE = 100; // ms between React state updates (~10fps for UI)

export interface PlaybackEngine {
  /** Real-time current time (ref — never triggers re-render) */
  timeRef: React.MutableRefObject<number>;
  /** Throttled time for UI display (~10fps updates) */
  displayTime: number;
  /** Whether currently playing */
  isPlaying: boolean;
  /** Total duration */
  duration: number;

  /** Start playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Toggle play/pause */
  togglePlayback: () => void;
  /** Seek to a specific time (always updates immediately) */
  seek: (time: number) => void;
  /** Set the total duration */
  setDuration: (d: number) => void;
  /** Called by the timeline engine on each tick — writes to ref only */
  onTick: (time: number) => void;
  /** Skip to start */
  skipToStart: () => void;
  /** Skip to end */
  skipToEnd: () => void;

  /** Subscribe to real-time time changes (for canvas/imperative updates) */
  subscribe: (callback: (time: number) => void) => () => void;
}

/**
 * Decoupled playback engine.
 *
 * During playback the current time lives in a ref — no React re-renders.
 * Subscribers (VideoPreview, text overlays) read via requestAnimationFrame.
 * The React `displayTime` state updates at ~10fps for UI elements only
 * (time counter, playhead position indicator).
 */
export function usePlaybackEngine(): PlaybackEngine {
  const timeRef = useRef(0);
  const [displayTime, setDisplayTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDurationState] = useState(0);

  const isPlayingRef = useRef(false);
  const durationRef = useRef(0);
  const subscribersRef = useRef<Set<(time: number) => void>>(new Set());
  const uiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafIdRef = useRef<number>(0);

  // Keep refs in sync
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Notify subscribers on each animation frame during playback
  const notifyLoop = useCallback(() => {
    const subs = subscribersRef.current;
    subs.forEach((cb) => cb(timeRef.current));
    if (isPlayingRef.current) {
      rafIdRef.current = requestAnimationFrame(notifyLoop);
    }
  }, []);

  // Start the UI throttle timer
  const startUITimer = useCallback(() => {
    if (uiTimerRef.current) return;
    uiTimerRef.current = setInterval(() => {
      setDisplayTime(timeRef.current);
    }, UI_UPDATE_RATE);
  }, []);

  const stopUITimer = useCallback(() => {
    if (uiTimerRef.current) {
      clearInterval(uiTimerRef.current);
      uiTimerRef.current = null;
    }
    // Final sync
    setDisplayTime(timeRef.current);
  }, []);

  const play = useCallback(() => {
    // If at the end, restart from the beginning
    if (timeRef.current >= durationRef.current - 0.1 && durationRef.current > 0) {
      timeRef.current = 0;
      setDisplayTime(0);
      // Notify subscribers (VideoPreview etc.) to reset to start
      subscribersRef.current.forEach((cb) => cb(0));
    }
    setIsPlaying(true);
    startUITimer();
    rafIdRef.current = requestAnimationFrame(notifyLoop);
  }, [startUITimer, notifyLoop]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    cancelAnimationFrame(rafIdRef.current);
    stopUITimer();
  }, [stopUITimer]);

  const togglePlayback = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  const seek = useCallback((time: number) => {
    timeRef.current = time;
    setDisplayTime(time);
    // Notify subscribers immediately on seek
    subscribersRef.current.forEach((cb) => cb(time));
  }, []);

  const onTick = useCallback((time: number) => {
    // Write to ref only — no setState, no re-render
    timeRef.current = time;
  }, []);

  const setDuration = useCallback((d: number) => {
    durationRef.current = d;
    setDurationState(d);
  }, []);

  const skipToStart = useCallback(() => {
    seek(0);
  }, [seek]);

  const skipToEnd = useCallback(() => {
    seek(durationRef.current);
    pause();
  }, [seek, pause]);

  const subscribe = useCallback((callback: (time: number) => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafIdRef.current);
      if (uiTimerRef.current) clearInterval(uiTimerRef.current);
    };
  }, []);

  return useMemo<PlaybackEngine>(
    () => ({
      timeRef,
      displayTime,
      isPlaying,
      duration,
      play,
      pause,
      togglePlayback,
      seek,
      setDuration,
      onTick,
      skipToStart,
      skipToEnd,
      subscribe,
    }),
    [displayTime, isPlaying, duration, play, pause, togglePlayback, seek, setDuration, onTick, skipToStart, skipToEnd, subscribe]
  );
}
