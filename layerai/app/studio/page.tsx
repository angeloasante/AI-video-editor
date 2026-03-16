"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { EditorHeader } from "@/components/layout/EditorHeader";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AssetLibrary } from "@/components/editor/AssetLibrary";
import { VideoPreview, VideoPreviewHandle } from "@/components/editor/VideoPreview";
import { Timeline, TimelineClip, TimelineHandle } from "@/components/editor/Timeline";
import { AIPanel, AspectRatio } from "@/components/editor/AIPanel";
import { EditorSidebar } from "@/components/editor/EditorSidebar";
import { FilesSheet } from "@/components/editor/FilesSheet";
import { TextOverlayDialog } from "@/components/editor/TextOverlayDialog";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { CropDialog } from "@/components/editor/CropDialog";
import { OverlayDialog } from "@/components/editor/OverlayDialog";
import { MobileToolbar } from "@/components/editor/MobileToolbar";
import { usePlaybackEngine } from "@/hooks/usePlaybackEngine";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useProxyGeneration } from "@/hooks/useProxyGeneration";
import { useAuth } from "@/hooks/useAuth";
import { MediaFile, saveStudioState, loadStudioState, createProject, listProjects, saveUserMedia, getProjectSceneDNA, saveTranscription, loadTranscriptions, deleteTranscription } from "@/lib/supabase";
import type { TranscriptionRecord } from "@/lib/supabase";
import type { SoundFile } from "@/components/editor/EditorSidebar";
import type { TextOverlay, Transition, TextAnimationType, TransitionType, ClipEdits, VideoOverlay } from "@/types/editor";
import { DEFAULT_CLIP_EDITS } from "@/types/editor";

// Default clip duration for different media types
const DEFAULT_DURATIONS: Record<string, number> = {
  video: 10,
  audio: 10,
  image: 5,
};

export default function StudioPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0a0a0b] relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-blue-500/10 to-transparent blur-[100px] pointer-events-none" />
        <img src="/logo.png" alt="Klusta" className="w-10 h-10 mb-4 animate-pulse" />
        <div className="text-neutral-400 text-sm font-medium">Loading studio...</div>
      </div>
    }>
      <StudioContent />
    </Suspense>
  );
}

function StudioContent() {
  const { user, loading: authLoading, signOut } = useAuth();
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("projectId");
  const [projectId, setProjectId] = useState<string | null>(urlProjectId);
  const [projectName, setProjectName] = useState("Untitled Project");
  const videoRef = useRef<VideoPreviewHandle>(null);
  const timelineRef = useRef<TimelineHandle>(null);
  const stateLoadedRef = useRef(false); // Prevents saving empty state before load completes

  // Playback engine — ref-based clock, throttled UI updates
  const engine = usePlaybackEngine();

  // Proxy generation — low-res previews for smooth playback
  const { generateProxy } = useProxyGeneration();

  // Aspect ratio
  const [aspectRatio] = useState<AspectRatio>("16:9");

  // AI panel width (resizable — same pattern as timeline height)
  const [aiPanelWidth, setAiPanelWidth] = useState(320);
  const [isDraggingAiPanel, setIsDraggingAiPanel] = useState(false);

  // Files state
  const [filesSheetOpen, setFilesSheetOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [editorPanelOpen, setEditorPanelOpen] = useState(false);
  const [mobileAIPanelOpen, setMobileAIPanelOpen] = useState(false);
  const [savedCharacters, setSavedCharacters] = useState<{ name: string; description: string; imageUrl: string }[]>([]);

  // Current media file based on timeline position
  const [currentMediaFile, setCurrentMediaFile] = useState<MediaFile | null>(null);
  const [currentClipStartTime, setCurrentClipStartTime] = useState(0);

  // Timeline data
  const [clips, setClips] = useState<TimelineClip[]>([]);

  // Timeline height and zoom
  const [timelineHeight, setTimelineHeight] = useState(200);
  const [mobileTimelineHeight, setMobileTimelineHeight] = useState(180);
  const [zoom, setZoom] = useState(100);

  // Per-clip edits (transform, volume, speed, crop)
  const [clipEditsMap, setClipEditsMap] = useState<Record<string, ClipEdits>>({});

  // Selected clip ID for the editor tools panel
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Scene DNA for the header viewer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sceneDNA, setSceneDNA] = useState<Record<string, any> | null>(null);
  const [sceneDNALoading, setSceneDNALoading] = useState(false);
  const [sceneDNASheetOpen, setSceneDNASheetOpen] = useState(false);

  const fetchSceneDNA = useCallback(async () => {
    if (!projectId) return;
    setSceneDNALoading(true);
    try {
      const dna = await getProjectSceneDNA(projectId);
      setSceneDNA(dna);
    } catch (err) {
      console.error("Failed to fetch SceneDNA:", err);
    } finally {
      setSceneDNALoading(false);
    }
  }, [projectId]);

  // AI-generated files to inject into AssetLibrary
  const [aiGeneratedFiles, setAiGeneratedFiles] = useState<MediaFile[]>([]);

  // AI-generated sound files for the Sound panel
  const [soundFiles, setSoundFiles] = useState<SoundFile[]>([]);

  // Transcriptions (per clip, loaded from DB)
  const [transcriptions, setTranscriptions] = useState<TranscriptionRecord[]>([]);

  // Text overlay state
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [selectedTextPreset, setSelectedTextPreset] = useState<{
    id: string;
    name: string;
    style: string;
  } | null>(null);

  // Transition state
  const [transitions, setTransitions] = useState<Transition[]>([]);


  // Overlay state
  const [videoOverlays, setVideoOverlays] = useState<VideoOverlay[]>([]);
  const [overlayDialogOpen, setOverlayDialogOpen] = useState(false);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  // ── Undo / Redo ──
  interface EditorSnapshot {
    clips: TimelineClip[];
    textOverlays: TextOverlay[];
    transitions: Transition[];
    videoOverlays: VideoOverlay[];
    clipEditsMap: Record<string, ClipEdits>;
  }
  const undoStackRef = useRef<EditorSnapshot[]>([]);
  const redoStackRef = useRef<EditorSnapshot[]>([]);
  const [undoCount, setUndoCount] = useState(0); // force re-render for canUndo/canRedo
  const [redoCount, setRedoCount] = useState(0);
  const isRestoringRef = useRef(false);
  const prevStateRef = useRef<EditorSnapshot | null>(null);
  const snapshotTimerRef = useRef<NodeJS.Timeout | null>(null);

  // When state changes, push the PREVIOUS state to the undo stack (debounced)
  useEffect(() => {
    if (isRestoringRef.current) return;

    const currentState: EditorSnapshot = {
      clips: [...clips],
      textOverlays: [...textOverlays],
      transitions: [...transitions],
      videoOverlays: [...videoOverlays],
      clipEditsMap: { ...clipEditsMap },
    };

    // On first render, just record initial state — no undo entry
    if (prevStateRef.current === null) {
      prevStateRef.current = currentState;
      return;
    }

    // Debounce: wait for rapid changes to settle before pushing
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    const prevSnapshot = prevStateRef.current;
    // Update ref immediately so the next change sees this state as "previous"
    prevStateRef.current = currentState;
    snapshotTimerRef.current = setTimeout(() => {
      undoStackRef.current.push(prevSnapshot);
      if (undoStackRef.current.length > 50) undoStackRef.current.shift();
      redoStackRef.current = [];
      setUndoCount(undoStackRef.current.length);
      setRedoCount(0);
    }, 300);
  }, [clips, textOverlays, transitions, videoOverlays, clipEditsMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    // Cancel any pending debounced snapshot push
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    // Save current state to redo
    const currentSnapshot: EditorSnapshot = {
      clips: [...clips],
      textOverlays: [...textOverlays],
      transitions: [...transitions],
      videoOverlays: [...videoOverlays],
      clipEditsMap: { ...clipEditsMap },
    };
    redoStackRef.current.push(currentSnapshot);

    const snapshot = undoStackRef.current.pop()!;
    isRestoringRef.current = true;
    setClips(snapshot.clips);
    setTextOverlays(snapshot.textOverlays);
    setTransitions(snapshot.transitions);
    setVideoOverlays(snapshot.videoOverlays);
    setClipEditsMap(snapshot.clipEditsMap);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    prevStateRef.current = snapshot;
    // Allow useEffect to fire but skip it until after React commits
    setTimeout(() => { isRestoringRef.current = false; }, 0);
  }, [clips, textOverlays, transitions, videoOverlays, clipEditsMap]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    // Cancel any pending debounced snapshot push
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    // Save current state to undo
    const currentSnapshot: EditorSnapshot = {
      clips: [...clips],
      textOverlays: [...textOverlays],
      transitions: [...transitions],
      videoOverlays: [...videoOverlays],
      clipEditsMap: { ...clipEditsMap },
    };
    undoStackRef.current.push(currentSnapshot);

    const snapshot = redoStackRef.current.pop()!;
    isRestoringRef.current = true;
    setClips(snapshot.clips);
    setTextOverlays(snapshot.textOverlays);
    setTransitions(snapshot.transitions);
    setVideoOverlays(snapshot.videoOverlays);
    setClipEditsMap(snapshot.clipEditsMap);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
    prevStateRef.current = snapshot;
    setTimeout(() => { isRestoringRef.current = false; }, 0);
  }, [clips, textOverlays, transitions, videoOverlays, clipEditsMap]);

  // Toast notification
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  // State is persisted to DB via debounced saveStudioState — no localStorage needed

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Initialize project + load studio state from DB
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        let pid = urlProjectId;

        if (!pid) {
          // No projectId in URL — fallback to first project or create one
          const projects = await listProjects(user.id);
          if (projects.length === 0) {
            const newProject = await createProject(user.id);
            pid = newProject.id;
          } else {
            pid = projects[0].id;
          }
        }

        // pid is guaranteed non-null after the fallback block above
        const resolvedPid = pid!;
        setProjectId(resolvedPid);

        // Fetch project name
        const { createSupabaseBrowser } = await import("@/lib/supabase/client");
        const supabase = createSupabaseBrowser();
        const { data: proj } = await supabase
          .from("projects")
          .select("name")
          .eq("id", resolvedPid)
          .single();
        if (proj?.name) setProjectName(proj.name);

        // Clear all state first — ensures a fresh project starts empty
        setClips([]);
        setTextOverlays([]);
        setTransitions([]);
        setClipEditsMap({});
        setVideoOverlays([]);
        setAiGeneratedFiles([]);
        setSoundFiles([]);

        // Load saved state from DB (if any exists for this project)
        const state = await loadStudioState(resolvedPid);
        if (state) {
          // Load clips — filter out any with missing mediaFile (keep audio with empty path)
          let validClips = ((state.clips || []) as TimelineClip[]).filter(
            (c) => c.mediaFile && c.mediaFile.url
          );
          setClips(validClips);
          if (state.text_overlays?.length) setTextOverlays(state.text_overlays as TextOverlay[]);
          if (state.transitions?.length) {
            // Filter transitions referencing missing clips
            const clipIds = new Set(validClips.map((c) => c.id));
            const validTransitions = (state.transitions as Transition[]).filter(
              (t) => clipIds.has(t.clipAId) && clipIds.has(t.clipBId)
            );
            setTransitions(validTransitions);
          }
          if (state.video_overlays?.length) setVideoOverlays(state.video_overlays as VideoOverlay[]);
          if (state.clip_edits_map && typeof state.clip_edits_map === "object") {
            setClipEditsMap(state.clip_edits_map as Record<string, ClipEdits>);
          }
        }

        // Load transcriptions from DB
        const transcriptionsData = await loadTranscriptions(resolvedPid);
        setTranscriptions(transcriptionsData);

        // Mark load complete — safe to start saving state changes
        stateLoadedRef.current = true;
      } catch (err) {
        console.error("Failed to load project:", err);
        stateLoadedRef.current = true; // Allow saving even if load fails
      }
    })();
  }, [user?.id, urlProjectId]);

  // Debounced save studio state to DB
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!user?.id || !projectId || !stateLoadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveStudioState(user.id, projectId, {
        clips,
        textOverlays,
        transitions,
        selectedRatio: aspectRatio,
        videoOverlays,
        clipEditsMap,
      });
    }, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [clips, textOverlays, transitions, aspectRatio, videoOverlays, clipEditsMap, user?.id, projectId]);

  // Handle file selection — add to timeline, generate proxy for videos
  const handleFileSelect = useCallback(
    (file: MediaFile) => {
      const defaultDuration = DEFAULT_DURATIONS[file.type || "video"] || 5;

      const addToTimeline = (f: MediaFile, duration: number) => {
        timelineRef.current?.addMedia(f, duration);

        // Generate low-res proxy in background for smooth preview
        // Skip for AI-generated clips (already short/optimized from Kling)
        const isAiGenerated = f.path?.startsWith("ai-generations") || f.name?.startsWith("ai-generated");
        if (f.type === "video" && !f.proxyUrl && !isAiGenerated) {
          generateProxy(f).then((proxied) => {
            if (proxied.proxyUrl) {
              // Update the clip's media file with proxy URL
              timelineRef.current?.addMedia(proxied, 0); // duration 0 = update only
            }
          });
        }
      };

      if (file.type === "video" || file.type === "audio") {
        const element =
          file.type === "video"
            ? document.createElement("video")
            : document.createElement("audio");
        element.src = file.url;
        element.onloadedmetadata = () => {
          addToTimeline(file, element.duration || defaultDuration);
          element.remove();
        };
        element.onerror = () => {
          addToTimeline(file, defaultDuration);
          element.remove();
        };
      } else {
        addToTimeline(file, defaultDuration);
      }
    },
    [generateProxy]
  );

  // Handle adding items from AssetLibrary
  const handleAddToTimeline = useCallback(
    (item: { type: string; data: Record<string, unknown> }) => {
      if (item.type === "text") {
        setSelectedTextPreset(item.data as { id: string; name: string; style: string });
        setTextDialogOpen(true);
      } else if (item.type === "transition") {
        if (clips.length < 2) {
          setToast({
            message: "Add at least 2 clips to timeline before adding transitions",
            type: "error",
          });
          return;
        }

        const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
        const time = engine.timeRef.current;

        // Find the clip boundary (between two adjacent clips) closest to the playhead
        let clipA: TimelineClip | null = null;
        let clipB: TimelineClip | null = null;
        let bestDistance = Infinity;

        for (let i = 0; i < sortedClips.length - 1; i++) {
          const boundary = sortedClips[i].endTime;
          const dist = Math.abs(time - boundary);
          if (dist < bestDistance) {
            bestDistance = dist;
            clipA = sortedClips[i];
            clipB = sortedClips[i + 1];
          }
        }

        if (!clipA || !clipB) {
          clipA = sortedClips[0];
          clipB = sortedClips[1];
        }

        const transitionDuration = parseFloat(String(item.data.duration)) || 0.5;
        // Place transition straddling the boundary between clip A and clip B
        const boundary = clipA.endTime;
        const transitionStartTime = Math.max(
          clipA.startTime,
          boundary - transitionDuration / 2
        );

        setTransitions((prev) => [
          ...prev,
          {
            id: `transition-${Date.now()}`,
            type: (item.data.id as TransitionType) || "fade",
            duration: transitionDuration,
            clipAId: clipA!.id,
            clipBId: clipB!.id,
            startTime: transitionStartTime,
          },
        ]);
      }
    },
    [clips, engine.timeRef]
  );

  // Handle text overlay submission
  const handleTextSubmit = useCallback(
    (
      text: string,
      preset: string,
      startTime: number,
      dur: number,
      animationType: TextAnimationType = "fade",
      fadeIn: number = 0.3,
      fadeOut: number = 0.3,
      transform?: { scale: number; rotation: number },
      fontSize?: number,
      position?: { x: number; y: number },
      fontFamily?: string,
      fontWeight?: number,
      color?: string,
    ) => {
      setTextOverlays((prev) => [
        ...prev,
        {
          id: `text-${Date.now()}`,
          text,
          preset,
          startTime,
          endTime: startTime + dur,
          position: position || { x: 50, y: 50 },
          transform: transform || { scale: 1, rotation: 0 },
          fontSize: fontSize || 24,
          fontFamily: fontFamily || "Inter",
          fontWeight: fontWeight || 400,
          color: color || "#ffffff",
          animation: { type: animationType, fadeIn, fadeOut },
        },
      ]);
    },
    []
  );

  // Handle AI-initiated text overlay creation (no dialog needed)
  const handleAIAddText = useCallback(
    (text: string, startTime: number, endTime: number) => {
      setTextOverlays((prev) => [
        ...prev,
        {
          id: `text-${Date.now()}`,
          text,
          preset: "body",
          startTime,
          endTime,
          position: { x: 50, y: 50 },
          transform: { scale: 1, rotation: 0 },
          fontSize: 24,
          animation: { type: "fade" as TextAnimationType, fadeIn: 0.3, fadeOut: 0.3 },
        },
      ]);
    },
    []
  );

  // Handle text position change from dragging
  const handleTextPositionChange = useCallback((id: string, x: number, y: number) => {
    setTextOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, position: { x, y } } : o))
    );
  }, []);

  // Handle text transform change from resize/rotate handles
  const handleTextTransformChange = useCallback((id: string, changes: { scale?: number; rotation?: number; fontSize?: number }) => {
    setTextOverlays((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const current = o.transform || { scale: 1, rotation: 0 };
        return {
          ...o,
          transform: {
            scale: changes.scale ?? current.scale,
            rotation: changes.rotation ?? current.rotation,
          },
          ...(changes.fontSize != null ? { fontSize: changes.fontSize } : {}),
        };
      })
    );
  }, []);

  // Delete a text overlay by id
  const handleDeleteTextOverlay = useCallback((id: string) => {
    setTextOverlays((prev) => prev.filter((o) => o.id !== id));
  }, []);

  // Update a text overlay (inline edit from AssetLibrary)
  const handleUpdateTextOverlay = useCallback((id: string, changes: Partial<TextOverlay>) => {
    setTextOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...changes } : o))
    );
  }, []);

  // Delete a media file from Supabase storage + user_media table
  const handleDeleteMediaFile = useCallback(async (file: MediaFile) => {
    try {
      const { deleteFile } = await import("@/lib/supabase");
      await deleteFile(file.path);
      // Remove from local state so UI updates immediately
      setAiGeneratedFiles((prev) => prev.filter((f) => f.url !== file.url));
    } catch (err) {
      console.error("Delete error:", err);
    }
  }, []);

  // Handle current clip change from timeline
  const handleCurrentClipChange = useCallback((clip: TimelineClip | null) => {
    if (clip?.mediaFile) {
      setCurrentMediaFile(clip.mediaFile);
      setCurrentClipStartTime(clip.startTime);
      setSelectedClipId(clip.id);
    } else {
      setCurrentMediaFile(null);
      setCurrentClipStartTime(0);
      setSelectedClipId(null);
    }
  }, []);

  // Handle clip edits change from EditorToolsPanel
  const handleClipEditsChange = useCallback((edits: Partial<ClipEdits>) => {
    if (!selectedClipId) return;
    setClipEditsMap((prev) => ({
      ...prev,
      [selectedClipId]: { ...DEFAULT_CLIP_EDITS, ...prev[selectedClipId], ...edits },
    }));
  }, [selectedClipId]);

  // Handle crop apply — works for both clips and overlays
  const handleCropApply = useCallback((crop: { top: number; right: number; bottom: number; left: number }) => {
    if (selectedOverlayId) {
      // Apply crop to selected overlay
      setVideoOverlays((prev) =>
        prev.map((o) => (o.id === selectedOverlayId ? { ...o, crop } : o))
      );
    } else if (selectedClipId) {
      setClipEditsMap((prev) => ({
        ...prev,
        [selectedClipId]: { ...DEFAULT_CLIP_EDITS, ...prev[selectedClipId], crop },
      }));
    }
  }, [selectedClipId, selectedOverlayId]);

  // Overlay handlers
  const handleAddOverlay = useCallback((overlay: Omit<VideoOverlay, "id">) => {
    setVideoOverlays((prev) => [
      ...prev,
      { ...overlay, id: `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
    ]);
  }, []);

  const handleUpdateOverlay = useCallback((id: string, changes: Partial<VideoOverlay>) => {
    setVideoOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...changes } : o))
    );
  }, []);

  const handleDeleteOverlay = useCallback((id: string) => {
    setVideoOverlays((prev) => prev.filter((o) => o.id !== id));
  }, []);

  // Handle transcription results — save to DB, add to transcriptions state + text overlays
  const handleTranscriptionComplete = useCallback(async (
    captions: Array<{ text: string; startTime: number; endTime: number }>,
    clipId?: string,
    sourceUrl?: string,
    fullText?: string,
    languageCode?: string,
  ) => {
    // Save to transcriptions table in DB
    if (user?.id && projectId && clipId && sourceUrl) {
      const saved = await saveTranscription(
        user.id,
        projectId,
        clipId,
        sourceUrl,
        fullText || captions.map((c) => c.text).join(" "),
        captions,
        languageCode,
      );
      if (saved) {
        // Update local transcriptions state (replace if exists, else add)
        setTranscriptions((prev) => {
          const filtered = prev.filter((t) => t.clip_id !== clipId);
          return [...filtered, saved];
        });
      }
    }

    // Also add as text overlays for video rendering
    const newOverlays: TextOverlay[] = captions.map((caption) => ({
      id: `caption-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: caption.text,
      preset: "caption",
      startTime: caption.startTime,
      endTime: caption.endTime,
      position: { x: 50, y: 85 },
      fontSize: 24,
      fontWeight: 600,
      color: "#ffffff",
      animation: {
        type: "fade" as TextAnimationType,
        fadeIn: 0.2,
        fadeOut: 0.2,
      },
    }));
    setTextOverlays((prev) => [...prev, ...newOverlays]);
    setToast({ message: `Added ${captions.length} caption${captions.length > 1 ? "s" : ""} to timeline`, type: "success" });
  }, [user?.id, projectId]);

  // Handle AI-generated media — add to timeline and show in assets
  const handleMediaGenerated = useCallback((result: { type: "video" | "image"; url: string; name: string; path: string }) => {
    const mediaFile: MediaFile = {
      name: result.name,
      url: result.url,
      path: result.path,
      type: result.type as MediaFile["type"],
    };
    handleFileSelect(mediaFile);
    setAiGeneratedFiles((prev) => [mediaFile, ...prev]);

    // Persist to user_media so it survives page reloads
    if (user?.id) {
      saveUserMedia(user.id, { name: result.name, url: result.url, path: result.path, type: result.type, source: "ai-generated" }, projectId || undefined);
    }

    setToast({ message: `AI ${result.type} generated and added to timeline`, type: "success" });
  }, [handleFileSelect, user?.id, projectId]);

  // Handle character creation — save to state + persist
  const handleCharacterCreated = useCallback((character: { name: string; description: string; imageUrl: string }) => {
    setSavedCharacters((prev) => [...prev, character]);

    // Add to asset library (NOT timeline)
    const mediaFile: MediaFile = {
      name: character.name,
      url: character.imageUrl,
      path: "",
      type: "image",
    };
    setAiGeneratedFiles((prev) => [mediaFile, ...prev]);

    // Persist character to user_media with character source tag
    if (user?.id) {
      saveUserMedia(user.id, {
        name: character.name,
        url: character.imageUrl,
        type: "image",
        source: "character",
      }, projectId || undefined);
    }

    setToast({ message: `Character "${character.name}" created and saved`, type: "success" });
  }, [user?.id, projectId]);

  // Handle AI-generated audio — add to sound panel + timeline
  const handleAudioGenerated = useCallback((result: { url: string; name: string; audioType: "sfx" | "tts" }) => {
    const soundFile: SoundFile = {
      id: `sound-${Date.now()}`,
      name: result.name,
      url: result.url,
      type: result.audioType,
    };
    setSoundFiles((prev) => [soundFile, ...prev]);

    // Also add to timeline as an audio clip
    const mediaFile: MediaFile = {
      name: result.name,
      url: result.url,
      path: "",
      type: "audio",
    };
    handleFileSelect(mediaFile);

    // Persist to user_media so it survives page reloads
    if (user?.id) {
      saveUserMedia(user.id, { name: result.name, url: result.url, type: "audio", source: "ai-generated" }, projectId || undefined);
    }

    setToast({ message: `AI ${result.audioType === "tts" ? "voice" : "sound effect"} generated and added to timeline`, type: "success" });
  }, [handleFileSelect, user?.id, projectId]);

  // Add a sound from the Sound panel to the timeline
  const handleSoundAddToTimeline = useCallback((sound: SoundFile) => {
    const mediaFile: MediaFile = {
      name: sound.name,
      url: sound.url,
      path: "",
      type: "audio",
    };
    handleFileSelect(mediaFile);
  }, [handleFileSelect]);

  // Restore sounds from persisted chat messages on load
  const handleSoundsLoaded = useCallback((sounds: { url: string; name: string; audioType: "sfx" | "tts" }[]) => {
    setSoundFiles(sounds.map((s, i) => ({
      id: `sound-restored-${i}-${Date.now()}`,
      name: s.name,
      url: s.url,
      type: s.audioType,
    })));
  }, []);

  // Restore AI-generated videos/images from chat history on load
  const handleMediaLoaded = useCallback((media: { type: "video" | "image"; url: string; name: string }[]) => {
    const files: MediaFile[] = media.map((m) => ({
      name: m.name,
      url: m.url,
      path: `ai-generations/${m.name}`,
      type: m.type,
    }));
    setAiGeneratedFiles((prev) => {
      // Avoid duplicates by URL
      const existingUrls = new Set(prev.map((f) => f.url));
      const newFiles = files.filter((f) => !existingUrls.has(f.url));
      return [...prev, ...newFiles];
    });
  }, []);

  // Delete a sound from the Sound panel
  const handleSoundDelete = useCallback((id: string) => {
    setSoundFiles((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Spacebar play/pause + undo/redo shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      if (e.code === "Space") {
        e.preventDefault();
        engine.togglePlayback();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [engine, handleUndo, handleRedo]);


  // AI panel resize — same pattern as timeline
  useEffect(() => {
    if (!isDraggingAiPanel) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setAiPanelWidth(Math.max(260, Math.min(600, newWidth)));
    };
    const handleMouseUp = () => setIsDraggingAiPanel(false);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingAiPanel]);

  // Wait for auth to load before rendering — prevents uploads/queries with undefined userId
  if (authLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0a0a0b] relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-blue-500/10 to-transparent blur-[100px] pointer-events-none" />
        <img src="/logo.png" alt="Klusta" className="w-10 h-10 mb-4 animate-pulse" />
        <div className="text-neutral-400 text-sm font-medium">Loading studio...</div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-[#0a0a0b] selection:bg-blue-500/20">
      <EditorHeader
          projectName={projectName}
          userEmail={user?.email}
          hasSceneDNA={!!sceneDNA}
          onOpenSceneDNA={() => {
            setSceneDNASheetOpen(true);
            fetchSceneDNA();
          }}
          onShare={() => {}}
          onExport={() => setExportDialogOpen(true)}
          onSignOut={signOut}
        />

      {/* ── Desktop layout ── */}
      {!isMobile && (
        <div className="flex-1 flex gap-2 overflow-hidden p-2">
          <EditorSidebar
            clipEdits={selectedClipId ? clipEditsMap[selectedClipId] || null : null}
            hasSelectedClip={!!selectedClipId}
            onEditsChange={handleClipEditsChange}
            onPanelOpenChange={setEditorPanelOpen}
            soundFiles={soundFiles}
            onSoundAddToTimeline={handleSoundAddToTimeline}
            onSoundDelete={handleSoundDelete}
            selectedClipId={selectedClipId || undefined}
            selectedClipUrl={selectedClipId ? clips.find((c) => c.id === selectedClipId)?.mediaFile?.url : undefined}
            selectedClipType={selectedClipId ? clips.find((c) => c.id === selectedClipId)?.mediaFile?.type : undefined}
            onTranscriptionComplete={handleTranscriptionComplete}
            transcriptions={transcriptions}
          />

          {!editorPanelOpen && (
            <AssetLibrary
              userId={user?.id}
              projectId={projectId || undefined}
              onFileSelect={handleFileSelect}
              onAddToTimeline={handleAddToTimeline}
              textOverlays={textOverlays}
              onDeleteTextOverlay={handleDeleteTextOverlay}
              onUpdateTextOverlay={handleUpdateTextOverlay}
              onDeleteMediaFile={handleDeleteMediaFile}
              injectedFiles={aiGeneratedFiles}
            />
          )}

          <VideoPreview
            ref={videoRef}
            engine={engine}
            mediaFile={currentMediaFile}
            clipStartTime={currentClipStartTime}
            textOverlays={textOverlays}
            transitions={transitions}
            timelineClips={clips}
            clipEditsMap={clipEditsMap}
            videoOverlays={videoOverlays}
            onOverlayPositionChange={(id: string, x: number, y: number) => handleUpdateOverlay(id, { x, y })}
            onOverlaySizeChange={(id: string, w: number, h: number) => handleUpdateOverlay(id, { width: w, height: h })}
            onTextPositionChange={handleTextPositionChange}
            onTextTransformChange={handleTextTransformChange}
          />

          {/* Drag handle to resize AI panel */}
          <div
            onMouseDown={(e) => { e.preventDefault(); setIsDraggingAiPanel(true); }}
            className={cn(
              "w-2 flex-none cursor-col-resize flex items-center justify-center group border-l border-neutral-800 hover:border-neutral-600 transition-colors",
              isDraggingAiPanel && "border-cyan-500"
            )}
          >
            <div className={cn(
              "w-0.5 h-8 rounded-full transition-colors",
              isDraggingAiPanel ? "bg-cyan-500" : "bg-neutral-800 group-hover:bg-neutral-600"
            )} />
          </div>

          <AIPanel
            userId={user?.id}
            projectId={projectId || undefined}
            selectedRatio={aspectRatio}
            onMediaGenerated={handleMediaGenerated}
            onAudioGenerated={handleAudioGenerated}
            onSoundsLoaded={handleSoundsLoaded}
            onMediaLoaded={handleMediaLoaded}
            onCharacterCreated={handleCharacterCreated}
            savedCharacters={savedCharacters}
            savedMedia={aiGeneratedFiles.map(f => ({ name: f.name, url: f.url, type: f.type }))}
            width={aiPanelWidth}
            textOverlays={textOverlays}
            onUpdateTextOverlay={handleUpdateTextOverlay}
            onDeleteTextOverlay={handleDeleteTextOverlay}
            onAddTextOverlay={handleAIAddText}
            timelineClips={clips.filter(c => c.mediaFile?.type === "video" || c.mediaFile?.type === "image").map((c, i) => ({
              index: i + 1,
              url: c.mediaFile!.url,
              name: c.mediaFile?.name || `Clip ${i + 1}`,
              type: c.mediaFile?.type || "video",
              startTime: c.startTime,
              endTime: c.endTime,
            }))}
          />
        </div>
      )}

      {/* ── Mobile layout ── */}
      {isMobile && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Video preview — pushed well below status bar */}
          <div className="flex-1 min-h-0 relative pt-10">
            <VideoPreview
              ref={videoRef}
              engine={engine}
              mediaFile={currentMediaFile}
              clipStartTime={currentClipStartTime}
              textOverlays={textOverlays}
              transitions={transitions}
              timelineClips={clips}
              clipEditsMap={clipEditsMap}
              videoOverlays={videoOverlays}
              onOverlayPositionChange={(id: string, x: number, y: number) => handleUpdateOverlay(id, { x, y })}
              onOverlaySizeChange={(id: string, w: number, h: number) => handleUpdateOverlay(id, { width: w, height: h })}
              onTextPositionChange={handleTextPositionChange}
              onTextTransformChange={handleTextTransformChange}
              isMobile
            />
          </div>

          {/* Timeline — expandable on mobile */}
          <Timeline
            ref={timelineRef}
            engine={engine}
            zoom={zoom}
            textOverlays={textOverlays}
            transitions={transitions}
            timelineHeight={mobileTimelineHeight}
            onZoomChange={setZoom}
            onHeightChange={setMobileTimelineHeight}
            onClipsChange={setClips}
            onCurrentClipChange={handleCurrentClipChange}
            onTransitionsChange={setTransitions}
            onTextOverlaysChange={setTextOverlays}
            videoOverlays={videoOverlays}
            onVideoOverlaysChange={setVideoOverlays}
            onPiPToggle={() => videoRef.current?.togglePiP()}
            isPiP={videoRef.current?.isPiP}
            onCropClick={() => setCropDialogOpen(true)}
            onOverlayClick={() => setOverlayDialogOpen(true)}
            hasSelectedClip={!!selectedClipId}
            onSelectedOverlayChange={setSelectedOverlayId}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={undoCount > 0}
            canRedo={redoCount > 0}
            isMobile
            initialClips={clips}
            transcriptions={transcriptions}
          />

          {/* Mobile bottom toolbar — mirrors EditorSidebar */}
          <MobileToolbar
            onAddMedia={() => setFilesSheetOpen(true)}
            onAIClick={() => setMobileAIPanelOpen(true)}
            hasSelectedClip={!!selectedClipId}
            clipEdits={selectedClipId ? clipEditsMap[selectedClipId] || null : null}
            onEditsChange={handleClipEditsChange}
            soundFiles={soundFiles}
            onSoundAddToTimeline={handleSoundAddToTimeline}
            onSoundDelete={handleSoundDelete}
            onAddToTimeline={handleAddToTimeline}
          />
        </div>
      )}

      {/* Desktop timeline */}
      {!isMobile && (
        <Timeline
          ref={timelineRef}
          engine={engine}
          zoom={zoom}
          textOverlays={textOverlays}
          transitions={transitions}
          timelineHeight={timelineHeight}
          onZoomChange={setZoom}
          onHeightChange={setTimelineHeight}
          onClipsChange={setClips}
          onCurrentClipChange={handleCurrentClipChange}
          onTransitionsChange={setTransitions}
          onTextOverlaysChange={setTextOverlays}
          videoOverlays={videoOverlays}
          onVideoOverlaysChange={setVideoOverlays}
          onPiPToggle={() => videoRef.current?.togglePiP()}
          isPiP={videoRef.current?.isPiP}
          onCropClick={() => setCropDialogOpen(true)}
          onOverlayClick={() => setOverlayDialogOpen(true)}
          hasSelectedClip={!!selectedClipId}
          onSelectedOverlayChange={setSelectedOverlayId}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={undoCount > 0}
          canRedo={redoCount > 0}
          initialClips={clips}
        />
      )}

      <FilesSheet
        open={filesSheetOpen}
        onOpenChange={setFilesSheetOpen}
        onFileSelect={handleFileSelect}
        selectedFile={null}
      />

      {/* Mobile AI panel as full-screen sheet */}
      {isMobile && mobileAIPanelOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
            <span className="text-sm font-medium text-neutral-300">AI Assistant</span>
            <button
              onClick={() => setMobileAIPanelOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:text-white"
            >
              <span className="text-lg">&times;</span>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <AIPanel
              userId={user?.id}
              projectId={projectId || undefined}
              selectedRatio={aspectRatio}
              onMediaGenerated={(result) => {
                handleMediaGenerated(result);
                setMobileAIPanelOpen(false);
              }}
              onAudioGenerated={handleAudioGenerated}
              onSoundsLoaded={handleSoundsLoaded}
              onMediaLoaded={handleMediaLoaded}
              onCharacterCreated={handleCharacterCreated}
              savedCharacters={savedCharacters}
              savedMedia={aiGeneratedFiles.map(f => ({ name: f.name, url: f.url, type: f.type }))}
              width={typeof window !== "undefined" ? window.innerWidth : 360}
              textOverlays={textOverlays}
              onUpdateTextOverlay={handleUpdateTextOverlay}
              onDeleteTextOverlay={handleDeleteTextOverlay}
              onAddTextOverlay={handleAIAddText}
              timelineClips={clips.filter(c => c.mediaFile?.type === "video" || c.mediaFile?.type === "image").map((c, i) => ({
                index: i + 1,
                url: c.mediaFile!.url,
                name: c.mediaFile?.name || `Clip ${i + 1}`,
                type: c.mediaFile?.type || "video",
                startTime: c.startTime,
                endTime: c.endTime,
              }))}
            />
          </div>
        </div>
      )}

      <TextOverlayDialog
        open={textDialogOpen}
        onOpenChange={setTextDialogOpen}
        preset={selectedTextPreset}
        onSubmit={handleTextSubmit}
        currentTime={engine.displayTime}
      />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        duration={engine.duration}
        clips={clips}
        transitions={transitions}
        textOverlays={textOverlays}
      />

      <CropDialog
        open={cropDialogOpen}
        onOpenChange={setCropDialogOpen}
        mediaSrc={
          selectedOverlayId
            ? videoOverlays.find((o) => o.id === selectedOverlayId)?.src || null
            : currentMediaFile?.url || null
        }
        mediaType={
          selectedOverlayId
            ? (videoOverlays.find((o) => o.id === selectedOverlayId)?.type === "image" ? "image" : "video")
            : (currentMediaFile?.type === "image" ? "image" : "video")
        }
        initialCrop={
          selectedOverlayId
            ? videoOverlays.find((o) => o.id === selectedOverlayId)?.crop
            : (selectedClipId ? clipEditsMap[selectedClipId]?.crop : undefined)
        }
        onApply={handleCropApply}
      />

      <OverlayDialog
        open={overlayDialogOpen}
        onOpenChange={setOverlayDialogOpen}
        overlays={videoOverlays}
        onAddOverlay={handleAddOverlay}
        onUpdateOverlay={handleUpdateOverlay}
        onDeleteOverlay={handleDeleteOverlay}
        currentTime={engine.displayTime}
        duration={engine.duration}
      />

      {/* Scene DNA Sheet */}
      <Sheet open={sceneDNASheetOpen} onOpenChange={setSceneDNASheetOpen}>
        <SheetContent side="right" className="bg-[#0a0a0c] border-neutral-800 w-[380px] sm:max-w-[380px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white text-lg">Scene DNA</SheetTitle>
            <SheetDescription className="text-neutral-500 text-sm">
              AI-detected context for your project. Used to keep edits consistent.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6 space-y-4">
            {sceneDNALoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-neutral-700 border-t-purple-400 rounded-full animate-spin" />
              </div>
            ) : !sceneDNA ? (
              <div className="text-center py-12 space-y-2">
                <p className="text-sm text-neutral-500">No Scene DNA yet</p>
                <p className="text-xs text-neutral-600">
                  Generate a video to auto-populate, or set scene context in project settings.
                </p>
              </div>
            ) : (
              <>
                {sceneDNA.theme || sceneDNA.mood ? (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-purple-400/70">Vibe</span>
                    <p className="text-sm text-neutral-300 leading-relaxed">
                      {[sceneDNA.theme && `The overall theme is ${sceneDNA.theme}`, sceneDNA.mood && `with a ${sceneDNA.mood} mood`].filter(Boolean).join(" ")}.
                    </p>
                  </div>
                ) : null}

                {sceneDNA.colorPalette?.length ? (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-purple-400/70">Colors</span>
                    <div className="flex flex-wrap gap-2">
                      {sceneDNA.colorPalette.map((c: string, i: number) => (
                        <span key={i} className="text-xs text-neutral-400 px-2 py-1 rounded bg-neutral-800 border border-neutral-700">{c}</span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {sceneDNA.lighting ? (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-purple-400/70">Lighting</span>
                    <p className="text-sm text-neutral-300 leading-relaxed">
                      {[sceneDNA.lighting.type, sceneDNA.lighting.intensity && `${sceneDNA.lighting.intensity} intensity`, sceneDNA.lighting.direction && `from the ${sceneDNA.lighting.direction}`].filter(Boolean).join(", ")}.
                    </p>
                  </div>
                ) : null}

                {sceneDNA.cameraWork ? (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-purple-400/70">Camera</span>
                    <p className="text-sm text-neutral-300 leading-relaxed">
                      {[sceneDNA.cameraWork.shotTypes?.length && `Shot types: ${sceneDNA.cameraWork.shotTypes.join(", ")}`, sceneDNA.cameraWork.movements?.length && `Movements: ${sceneDNA.cameraWork.movements.join(", ")}`].filter(Boolean).join(". ")}.
                    </p>
                  </div>
                ) : null}

                {(sceneDNA.characterProfiles?.length || sceneDNA.characters?.length) ? (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-purple-400/70">Characters</span>
                    {(sceneDNA.characterProfiles || sceneDNA.characters || []).map((c: { name?: string; description?: string }, i: number) => (
                      <p key={i} className="text-sm text-neutral-300 leading-relaxed">
                        <span className="text-neutral-400 font-medium">{c.name || `Character ${i + 1}`}:</span> {c.description}
                      </p>
                    ))}
                  </div>
                ) : null}

                {sceneDNA.objects?.length ? (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-purple-400/70">Key Objects</span>
                    <p className="text-sm text-neutral-300 leading-relaxed">{sceneDNA.objects.join(", ")}.</p>
                  </div>
                ) : null}

                {sceneDNA.audio ? (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-purple-400/70">Audio</span>
                    <p className="text-sm text-neutral-300 leading-relaxed">
                      {[sceneDNA.audio.hasDialogue && "Contains dialogue", sceneDNA.audio.musicStyle && `Music: ${sceneDNA.audio.musicStyle}`, sceneDNA.audio.ambience && `Ambience: ${sceneDNA.audio.ambience}`].filter(Boolean).join(". ")}.
                    </p>
                  </div>
                ) : null}

                {sceneDNA.visionIntelligence ? (
                  <>
                    <div className="border-t border-neutral-800 pt-3 mt-3">
                      <span className="text-[10px] uppercase tracking-wider font-medium text-blue-400/70">Vision Intelligence</span>
                    </div>

                    {sceneDNA.visionIntelligence.sceneLabels?.length ? (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider font-medium text-blue-400/70">Scene Labels</span>
                        <div className="flex flex-wrap gap-1.5">
                          {sceneDNA.visionIntelligence.sceneLabels.slice(0, 12).map((l: { label: string; confidence: number }, i: number) => (
                            <span key={i} className="text-xs text-neutral-400 px-2 py-0.5 rounded bg-neutral-800/80 border border-neutral-700/50">
                              {l.label} <span className="text-neutral-600">{Math.round(l.confidence * 100)}%</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {sceneDNA.visionIntelligence.trackedObjects?.length ? (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider font-medium text-blue-400/70">Tracked Objects</span>
                        <p className="text-sm text-neutral-300 leading-relaxed">
                          {sceneDNA.visionIntelligence.trackedObjects.map((o: { entity: string }) => o.entity).join(", ")}.
                        </p>
                      </div>
                    ) : null}

                    {sceneDNA.visionIntelligence.onScreenText?.length ? (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider font-medium text-blue-400/70">On-Screen Text</span>
                        <p className="text-sm text-neutral-300 leading-relaxed">{sceneDNA.visionIntelligence.onScreenText.join(", ")}.</p>
                      </div>
                    ) : null}

                    {sceneDNA.visionIntelligence.logos?.length ? (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider font-medium text-blue-400/70">Logos Detected</span>
                        <p className="text-sm text-neutral-300 leading-relaxed">{sceneDNA.visionIntelligence.logos.join(", ")}.</p>
                      </div>
                    ) : null}

                    {sceneDNA.visionIntelligence.personAttributes?.length ? (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider font-medium text-blue-400/70">Person Attributes</span>
                        <div className="flex flex-wrap gap-1.5">
                          {sceneDNA.visionIntelligence.personAttributes.slice(0, 10).map((a: string, i: number) => (
                            <span key={i} className="text-xs text-neutral-400 px-2 py-0.5 rounded bg-neutral-800/80 border border-neutral-700/50">{a}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {sceneDNA.visionIntelligence.shotBoundaries?.length ? (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider font-medium text-blue-400/70">Shot Analysis</span>
                        <p className="text-sm text-neutral-300 leading-relaxed">
                          {sceneDNA.visionIntelligence.shotBoundaries.length} cut{sceneDNA.visionIntelligence.shotBoundaries.length !== 1 ? "s" : ""} detected.
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === "error" ? "bg-red-600 text-white" : "bg-green-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
