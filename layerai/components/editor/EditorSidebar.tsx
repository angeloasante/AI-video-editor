"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Move,
  Volume2,
  Gauge,
  FileText,
  FlipHorizontal2,
  FlipVertical2,
  RotateCw,
  FolderOpen,
  Play,
  Trash2,
  Loader2,
  Plus,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import type { ClipEdits } from "@/types/editor";
import { audioApi } from "@/lib/api";

export interface SoundFile {
  id: string;
  name: string;
  url: string;
  type: "sfx" | "tts";
}

type EditorTool = "transform" | "sound" | "speed" | "transcribe";

interface NavItem {
  id: EditorTool;
  icon: React.ElementType;
  label: string;
}

const toolNavItems: NavItem[] = [
  { id: "transform", icon: Move, label: "Transform" },
  { id: "sound", icon: Volume2, label: "Sound" },
  { id: "speed", icon: Gauge, label: "Speed" },
  { id: "transcribe", icon: FileText, label: "Transcribe" },
];

interface EditorSidebarProps {
  clipEdits: ClipEdits | null;
  hasSelectedClip: boolean;
  onEditsChange: (edits: Partial<ClipEdits>) => void;
  onPanelOpenChange?: (isOpen: boolean) => void;
  onAssetsClick?: () => void;
  soundFiles?: SoundFile[];
  onSoundAddToTimeline?: (sound: SoundFile) => void;
  onSoundDelete?: (id: string) => void;
  /** ID of the currently selected clip */
  selectedClipId?: string;
  /** URL of the currently selected clip's media (for transcription) */
  selectedClipUrl?: string;
  /** Type of the currently selected clip */
  selectedClipType?: string;
  /** Callback when transcription produces captions */
  onTranscriptionComplete?: (
    captions: Array<{ text: string; startTime: number; endTime: number }>,
    clipId?: string,
    sourceUrl?: string,
    fullText?: string,
    languageCode?: string,
  ) => void;
  /** Saved transcriptions from DB */
  transcriptions?: Array<{ clip_id: string; full_text: string; captions: Array<{ text: string; startTime: number; endTime: number }> }>;
}

export function EditorSidebar({
  clipEdits,
  hasSelectedClip,
  onEditsChange,
  onPanelOpenChange,
  onAssetsClick,
  soundFiles = [],
  onSoundAddToTimeline,
  onSoundDelete,
  selectedClipId,
  selectedClipUrl,
  selectedClipType,
  onTranscriptionComplete,
  transcriptions = [],
}: EditorSidebarProps) {
  const [activeTool, setActiveTool] = useState<EditorTool | null>(null);
  const prevSoundCountRef = useRef(soundFiles.length);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [transcriptionResult, setTranscriptionResult] = useState<Array<{ text: string; startTime: number; endTime: number }> | null>(null);

  // Auto-open Sound tab when a new sound is generated
  useEffect(() => {
    if (soundFiles.length > prevSoundCountRef.current) {
      setActiveTool("sound");
      onPanelOpenChange?.(true);
    }
    prevSoundCountRef.current = soundFiles.length;
  }, [soundFiles.length, onPanelOpenChange]);

  const edits = clipEdits || {
    volume: 1,
    speed: 1,
    mirrorH: false,
    mirrorV: false,
    rotation: 0,
  };

  const handleToolClick = (id: EditorTool) => {
    const next = activeTool === id ? null : id;
    setActiveTool(next);
    onPanelOpenChange?.(next !== null);
  };

  // Load saved transcription for current clip, reset local state
  const savedTranscription = selectedClipId
    ? transcriptions.find((t) => t.clip_id === selectedClipId)
    : undefined;

  useEffect(() => {
    setTranscriptionResult(null);
    setTranscriptionError(null);
  }, [selectedClipUrl]);

  // Track full text + language from last transcription (for DB save)
  const lastTranscriptRef = useRef<{ fullText: string; languageCode: string }>({ fullText: "", languageCode: "en" });

  const handleTranscribe = useCallback(async () => {
    if (!selectedClipUrl) return;
    setIsTranscribing(true);
    setTranscriptionError(null);
    setTranscriptionResult(null);

    try {
      // If it's a video, extract audio first
      let audioUrl = selectedClipUrl;
      if (selectedClipType === "video") {
        const extracted = await audioApi.extractAudio(selectedClipUrl);
        audioUrl = extracted.url;
      }

      // Transcribe via ElevenLabs
      const result = await audioApi.transcribe(audioUrl);

      // Store full text + language for DB save
      lastTranscriptRef.current = {
        fullText: result.text,
        languageCode: result.language_code || "en",
      };

      // Group words into caption segments (~5-8 words each)
      const captions: Array<{ text: string; startTime: number; endTime: number }> = [];
      const words = result.words.filter((w) => w.type === "word");

      const WORDS_PER_CAPTION = 6;
      for (let i = 0; i < words.length; i += WORDS_PER_CAPTION) {
        const chunk = words.slice(i, i + WORDS_PER_CAPTION);
        captions.push({
          text: chunk.map((w) => w.text).join(" "),
          startTime: chunk[0].start,
          endTime: chunk[chunk.length - 1].end,
        });
      }

      setTranscriptionResult(captions);
    } catch (err) {
      setTranscriptionError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setIsTranscribing(false);
    }
  }, [selectedClipUrl, selectedClipType]);

  const isPanelOpen = activeTool !== null;

  const renderContent = () => {
    if (!hasSelectedClip) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-neutral-500 text-center">
            Select a clip on the timeline to edit
          </p>
        </div>
      );
    }

    switch (activeTool) {
      case "transform":
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
                Mirror
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onEditsChange({ mirrorH: !edits.mirrorH })}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors",
                    edits.mirrorH
                      ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                      : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                  )}
                >
                  <FlipHorizontal2 className="w-4 h-4" />
                  <span className="text-xs">Horizontal</span>
                </button>
                <button
                  onClick={() => onEditsChange({ mirrorV: !edits.mirrorV })}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors",
                    edits.mirrorV
                      ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                      : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                  )}
                >
                  <FlipVertical2 className="w-4 h-4" />
                  <span className="text-xs">Vertical</span>
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
                Rotate
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {[0, 90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => onEditsChange({ rotation: deg })}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-colors",
                      edits.rotation === deg
                        ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                        : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                    )}
                  >
                    <RotateCw
                      className="w-4 h-4"
                      style={{ transform: `rotate(${deg}deg)` }}
                    />
                    <span className="text-[10px]">{deg}°</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "sound":
        return (
          <div className="space-y-5">
            {/* Clip volume controls */}
            {hasSelectedClip && (
              <>
                <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Clip Volume
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-4 h-4 text-neutral-500 shrink-0" />
                    <Slider
                      value={[edits.volume * 100]}
                      min={0}
                      max={200}
                      step={5}
                      onValueChange={(v) => onEditsChange({ volume: v[0] / 100 })}
                      className="flex-1"
                    />
                    <span className="text-xs text-cyan-400 font-mono w-12 text-right">
                      {Math.round(edits.volume * 100)}%
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {[0, 50, 100, 150, 200].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => onEditsChange({ volume: pct / 100 })}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-[10px] font-medium border transition-colors",
                          Math.round(edits.volume * 100) === pct
                            ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                            : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700"
                        )}
                      >
                        {pct === 0 ? "Mute" : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-full h-px bg-neutral-800" />
              </>
            )}

            {/* AI-generated sounds */}
            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Generated Sounds
            </h3>
            {soundFiles.length === 0 ? (
              <p className="text-xs text-neutral-600 leading-relaxed">
                No sounds yet. Ask the AI to generate sound effects or voices — they&apos;ll appear here.
              </p>
            ) : (
              <div className="space-y-2">
                {soundFiles.map((sound) => (
                  <div
                    key={sound.id}
                    className="group flex flex-col gap-2 p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-xs text-neutral-300 truncate flex-1">{sound.name}</span>
                      <span className="text-[10px] text-neutral-600 uppercase">{sound.type}</span>
                    </div>
                    <audio src={sound.url} controls className="w-full h-7" preload="metadata" />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => onSoundAddToTimeline?.(sound)}
                        className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[10px] font-medium bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        Add to Timeline
                      </button>
                      <button
                        onClick={() => onSoundDelete?.(sound.id)}
                        className="px-2 py-1 rounded-md border border-neutral-800 text-neutral-600 hover:text-red-400 hover:border-red-500/30 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "speed":
        return (
          <div className="space-y-5">
            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Playback Speed
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Gauge className="w-4 h-4 text-neutral-500 shrink-0" />
                <Slider
                  value={[edits.speed * 100]}
                  min={25}
                  max={400}
                  step={25}
                  onValueChange={(v) => onEditsChange({ speed: v[0] / 100 })}
                  className="flex-1"
                />
                <span className="text-xs text-cyan-400 font-mono w-10 text-right">
                  {edits.speed.toFixed(2)}x
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[0.25, 0.5, 1, 1.5, 2, 3, 4].map((s) => (
                  <button
                    key={s}
                    onClick={() => onEditsChange({ speed: s })}
                    className={cn(
                      "py-1.5 rounded-lg text-[10px] font-medium border transition-colors",
                      edits.speed === s
                        ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                        : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700"
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "transcribe": {
        // Show saved or fresh transcription results
        const displayCaptions = transcriptionResult || savedTranscription?.captions || null;
        const isAlreadyTranscribed = !!savedTranscription && !transcriptionResult;

        return (
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            <div>
              <h3 className="text-xs font-medium text-white mb-1">Auto Transcription</h3>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Transcribe your clip&apos;s audio into captions and add them to the timeline.
              </p>
            </div>

            {!hasSelectedClip ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="w-8 h-8 text-neutral-700 mb-3" />
                <p className="text-xs text-neutral-500">Select a video or audio clip to transcribe</p>
              </div>
            ) : selectedClipType !== "video" && selectedClipType !== "audio" ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="w-8 h-8 text-neutral-700 mb-3" />
                <p className="text-xs text-neutral-500">Select a video or audio clip (images can&apos;t be transcribed)</p>
              </div>
            ) : (
              <>
                <button
                  onClick={handleTranscribe}
                  disabled={isTranscribing}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors",
                    isTranscribing
                      ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                      : "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                  )}
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Transcribing...
                    </>
                  ) : isAlreadyTranscribed ? (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      Re-transcribe
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      Transcribe Clip
                    </>
                  )}
                </button>

                {transcriptionError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {transcriptionError}
                  </p>
                )}

                {isAlreadyTranscribed && savedTranscription?.full_text && (
                  <div className="p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                    <p className="text-[10px] text-yellow-500/80 uppercase tracking-wider font-medium mb-1">Saved Transcript</p>
                    <p className="text-xs text-neutral-400 leading-relaxed">{savedTranscription.full_text}</p>
                  </div>
                )}

                {displayCaptions && displayCaptions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                        Captions ({displayCaptions.length})
                      </h4>
                      {!isAlreadyTranscribed && (
                        <button
                          onClick={() => onTranscriptionComplete?.(
                            displayCaptions,
                            selectedClipId,
                            selectedClipUrl,
                            lastTranscriptRef.current.fullText,
                            lastTranscriptRef.current.languageCode,
                          )}
                          className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
                        >
                          <Plus className="w-3 h-3" />
                          Save &amp; Add to Timeline
                        </button>
                      )}
                    </div>

                    {displayCaptions.map((caption, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 space-y-1.5"
                      >
                        <p className="text-xs text-neutral-300 leading-relaxed">{caption.text}</p>
                        <div className="flex items-center gap-1 text-[10px] text-neutral-600">
                          <Clock className="w-3 h-3" />
                          {caption.startTime.toFixed(1)}s – {caption.endTime.toFixed(1)}s
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <>
      {/* Icon sidebar — always visible, far left */}
      <nav className="w-[72px] h-full flex-none bg-[#0a0a0a] border-r border-neutral-800/50 flex flex-col items-center py-5 shrink-0 z-20">
        <div className="flex flex-col gap-4 w-full px-2">
          {/* Assets button */}
          <button
            onClick={() => {
              setActiveTool(null);
              onPanelOpenChange?.(false);
              onAssetsClick?.();
            }}
            className={cn(
              "flex flex-col items-center gap-1.5 group transition-colors",
              activeTool === null ? "text-white" : "text-neutral-500 hover:text-white"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                activeTool === null ? "bg-neutral-800" : "hover:bg-neutral-800/50"
              )}
            >
              <FolderOpen className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <span className={cn("text-[10px] tracking-tight", activeTool === null ? "font-medium" : "font-normal")}>
              Assets
            </span>
          </button>

          <div className="w-8 h-px bg-neutral-800 mx-auto" />

          {toolNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTool === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleToolClick(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 group transition-colors",
                  isActive ? "text-white" : "text-neutral-500 hover:text-white"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                    isActive ? "bg-neutral-800" : "hover:bg-neutral-800/50"
                  )}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <span
                  className={cn(
                    "text-[10px] tracking-tight",
                    isActive ? "font-medium" : "font-normal"
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Tool panel — inline in the flex row, same design as AssetLibrary */}
      {isPanelOpen && (
        <section className="w-[320px] flex-none bg-[#0d0d0f] rounded-2xl border border-neutral-800/50 flex flex-col overflow-hidden">
          {/* Tabs — same style as AssetLibrary */}
          <div className="flex items-center px-1 pt-2 border-b border-neutral-800/50">
            {toolNavItems.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTool === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTool(tab.id)}
                  className={cn(
                    "flex-1 pb-2 pt-1 flex items-center justify-center gap-1 text-xs transition-all rounded-t-lg",
                    isActive
                      ? "font-medium text-white border-b-2 border-cyan-400 bg-cyan-500/10"
                      : "font-normal text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", isActive && "text-cyan-400")} strokeWidth={1.5} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content — scrollable */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
            {renderContent()}
          </div>
        </section>
      )}
    </>
  );
}
