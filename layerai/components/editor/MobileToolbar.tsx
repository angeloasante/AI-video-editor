"use client";

import { useState, useEffect, useRef } from "react";
import {
  FolderOpen,
  Move,
  Volume2,
  Gauge,
  Sparkles,
  FlipHorizontal2,
  FlipVertical2,
  RotateCw,
  Play,
  Trash2,
  X,
  PlaySquare,
  Type,
  ArrowRightLeft,
  Wand2,
  Square,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import type { ClipEdits } from "@/types/editor";

type MobileTool = "assets" | "transform" | "sound" | "speed" | "ai" | null;
type AssetSubTab = "media" | "text" | "effects" | "transitions";

interface MobileToolbarProps {
  onAddMedia?: () => void;
  onAIClick?: () => void;
  // Clip editing
  hasSelectedClip: boolean;
  clipEdits: ClipEdits | null;
  onEditsChange: (edits: Partial<ClipEdits>) => void;
  // Sound files
  soundFiles?: Array<{ id: string; name: string; url: string; type: "sfx" | "tts" }>;
  onSoundAddToTimeline?: (sound: { id: string; name: string; url: string; type: "sfx" | "tts" }) => void;
  onSoundDelete?: (id: string) => void;
  // Asset library callbacks
  onAddToTimeline?: (item: { type: string; data: Record<string, unknown> }) => void;
}

const NAV_ITEMS: { id: MobileTool; icon: React.ElementType; label: string }[] = [
  { id: "assets", icon: FolderOpen, label: "Assets" },
  { id: "transform", icon: Move, label: "Transform" },
  { id: "sound", icon: Volume2, label: "Sound" },
  { id: "speed", icon: Gauge, label: "Speed" },
  { id: "ai", icon: Sparkles, label: "AI" },
];

const ASSET_SUB_TABS: { id: AssetSubTab; icon: React.ElementType; label: string }[] = [
  { id: "media", icon: PlaySquare, label: "Media" },
  { id: "text", icon: Type, label: "Text" },
  { id: "effects", icon: Sparkles, label: "Effects" },
  { id: "transitions", icon: ArrowRightLeft, label: "Transitions" },
];

const effectsPresets = [
  { id: "blur", name: "Blur", icon: Wand2 },
  { id: "glow", name: "Glow", icon: Sparkles },
  { id: "zoom", name: "Zoom In", icon: Square },
  { id: "shake", name: "Shake", icon: Wand2 },
  { id: "glitch", name: "Glitch", icon: Sparkles },
];

const transitionsPresets = [
  { id: "fade", name: "Fade", duration: "1.0s", category: "subtle" },
  { id: "fadeblack", name: "Fade Black", duration: "1.5s", category: "subtle" },
  { id: "fadewhite", name: "Fade White", duration: "1.5s", category: "subtle" },
  { id: "dissolve", name: "Dissolve", duration: "1.2s", category: "subtle" },
  { id: "wipeleft", name: "Wipe Left", duration: "1.0s", category: "wipe" },
  { id: "wiperight", name: "Wipe Right", duration: "1.0s", category: "wipe" },
  { id: "wipeup", name: "Wipe Up", duration: "1.0s", category: "wipe" },
  { id: "wipedown", name: "Wipe Down", duration: "1.0s", category: "wipe" },
  { id: "slideleft", name: "Slide Left", duration: "2.0s", category: "slide" },
  { id: "slideright", name: "Slide Right", duration: "1.0s", category: "slide" },
  { id: "slideup", name: "Slide Up", duration: "1.0s", category: "slide" },
  { id: "slidedown", name: "Slide Down", duration: "1.0s", category: "slide" },
  { id: "zoomin", name: "Zoom In", duration: "1.0s", category: "dynamic" },
  { id: "circleopen", name: "Circle Open", duration: "1.2s", category: "dynamic" },
  { id: "circleclose", name: "Circle Close", duration: "1.2s", category: "dynamic" },
  { id: "pixelize", name: "Pixelize", duration: "1.0s", category: "dynamic" },
];

const textPresets = [
  { id: "heading", name: "Heading", style: "Bold 48px" },
  { id: "subheading", name: "Subheading", style: "Semi-bold 32px" },
  { id: "body", name: "Body Text", style: "Regular 24px" },
  { id: "caption", name: "Caption", style: "Light 18px" },
  { id: "label", name: "Label", style: "Medium 14px" },
];

export function MobileToolbar({
  onAddMedia,
  onAIClick,
  hasSelectedClip,
  clipEdits,
  onEditsChange,
  soundFiles = [],
  onSoundAddToTimeline,
  onSoundDelete,
  onAddToTimeline,
}: MobileToolbarProps) {
  const [activePanel, setActivePanel] = useState<MobileTool>(null);
  const [assetSubTab, setAssetSubTab] = useState<AssetSubTab>("media");
  const prevSoundCountRef = useRef(soundFiles.length);

  const edits = clipEdits || { volume: 1, speed: 1, mirrorH: false, mirrorV: false, rotation: 0 };

  // Auto-open Sound tab when a new sound is generated
  useEffect(() => {
    if (soundFiles.length > prevSoundCountRef.current) {
      setActivePanel("sound");
    }
    prevSoundCountRef.current = soundFiles.length;
  }, [soundFiles.length]);

  const handleToolClick = (id: MobileTool) => {
    if (id === "ai") {
      onAIClick?.();
      return;
    }
    setActivePanel((prev) => (prev === id ? null : id));
  };

  const renderAssetsContent = () => {
    switch (assetSubTab) {
      case "media":
        return (
          <div className="space-y-3">
            <p className="text-xs text-neutral-500">Import media files to your project.</p>
            <button
              onClick={onAddMedia}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-neutral-700 text-neutral-300 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span className="text-xs font-medium">Browse Files</span>
            </button>
          </div>
        );

      case "text":
        return (
          <div className="space-y-2">
            {textPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onAddToTimeline?.({ type: "text", data: preset as unknown as Record<string, unknown> })}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-cyan-500/30 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Type className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-neutral-300 font-medium">{preset.name}</span>
                </div>
                <span className="text-[10px] text-neutral-600">{preset.style}</span>
              </button>
            ))}
          </div>
        );

      case "effects":
        return (
          <div className="grid grid-cols-3 gap-2">
            {effectsPresets.map((effect) => {
              const Icon = effect.icon;
              return (
                <button
                  key={effect.id}
                  onClick={() => onAddToTimeline?.({ type: "effect", data: effect as unknown as Record<string, unknown> })}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-cyan-500/30 transition-colors"
                >
                  <Icon className="w-4 h-4 text-cyan-400" />
                  <span className="text-[10px] text-neutral-400">{effect.name}</span>
                </button>
              );
            })}
          </div>
        );

      case "transitions":
        return (
          <div className="space-y-3">
            {["subtle", "wipe", "slide", "dynamic"].map((category) => {
              const items = transitionsPresets.filter((t) => t.category === category);
              return (
                <div key={category}>
                  <h4 className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider mb-1.5">
                    {category}
                  </h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onAddToTimeline?.({ type: "transition", data: t as unknown as Record<string, unknown> })}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-cyan-500/30 transition-colors"
                      >
                        <span className="text-[11px] text-neutral-300">{t.name}</span>
                        <span className="text-[9px] text-neutral-600">{t.duration}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );

      default:
        return null;
    }
  };

  const renderPanelContent = () => {
    if (activePanel === "assets") {
      return renderAssetsContent();
    }

    if (!hasSelectedClip && activePanel !== "sound") {
      return (
        <p className="text-xs text-neutral-500 text-center py-6">
          Select a clip on the timeline to edit
        </p>
      );
    }

    switch (activePanel) {
      case "transform":
        return (
          <div className="space-y-4">
            {/* Mirror */}
            <div>
              <h3 className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-2">Mirror</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onEditsChange({ mirrorH: !edits.mirrorH })}
                  className={cn(
                    "flex items-center justify-center gap-2 p-2.5 rounded-lg border transition-colors",
                    edits.mirrorH
                      ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                      : "bg-neutral-900 border-neutral-800 text-neutral-400"
                  )}
                >
                  <FlipHorizontal2 className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Horizontal</span>
                </button>
                <button
                  onClick={() => onEditsChange({ mirrorV: !edits.mirrorV })}
                  className={cn(
                    "flex items-center justify-center gap-2 p-2.5 rounded-lg border transition-colors",
                    edits.mirrorV
                      ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                      : "bg-neutral-900 border-neutral-800 text-neutral-400"
                  )}
                >
                  <FlipVertical2 className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Vertical</span>
                </button>
              </div>
            </div>

            {/* Rotate */}
            <div>
              <h3 className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-2">Rotate</h3>
              <div className="grid grid-cols-4 gap-2">
                {[0, 90, 180, 270].map((deg) => (
                  <button
                    key={deg}
                    onClick={() => onEditsChange({ rotation: deg })}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors",
                      edits.rotation === deg
                        ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                        : "bg-neutral-900 border-neutral-800 text-neutral-400"
                    )}
                  >
                    <RotateCw className="w-3.5 h-3.5" style={{ transform: `rotate(${deg}deg)` }} />
                    <span className="text-[10px]">{deg}°</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "sound":
        return (
          <div className="space-y-4">
            {/* Clip volume */}
            {hasSelectedClip && (
              <>
                <h3 className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Clip Volume</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <Slider
                      value={[edits.volume * 100]}
                      min={0}
                      max={200}
                      step={5}
                      onValueChange={(v) => onEditsChange({ volume: v[0] / 100 })}
                      className="flex-1"
                    />
                    <span className="text-[11px] text-cyan-400 font-mono w-10 text-right">
                      {Math.round(edits.volume * 100)}%
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {[0, 50, 100, 150, 200].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => onEditsChange({ volume: pct / 100 })}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-[10px] font-medium border transition-colors",
                          Math.round(edits.volume * 100) === pct
                            ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                            : "bg-neutral-900 border-neutral-800 text-neutral-500"
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

            {/* Generated sounds */}
            <h3 className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Generated Sounds</h3>
            {soundFiles.length === 0 ? (
              <p className="text-xs text-neutral-600 leading-relaxed">
                No sounds yet. Ask the AI to generate sound effects or voices — they&apos;ll appear here.
              </p>
            ) : (
              <div className="space-y-2">
                {soundFiles.map((sound) => (
                  <div
                    key={sound.id}
                    className="flex flex-col gap-2 p-2.5 rounded-lg bg-neutral-900 border border-neutral-800"
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
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-medium bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
                      >
                        <Play className="w-3 h-3" />
                        Add to Timeline
                      </button>
                      {onSoundDelete && (
                        <button
                          onClick={() => onSoundDelete(sound.id)}
                          className="px-2 py-1.5 rounded-md border border-neutral-800 text-neutral-600 hover:text-red-400 hover:border-red-500/30 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "speed":
        return (
          <div className="space-y-4">
            <h3 className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Playback Speed</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Gauge className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <Slider
                  value={[edits.speed * 100]}
                  min={25}
                  max={400}
                  step={25}
                  onValueChange={(v) => onEditsChange({ speed: v[0] / 100 })}
                  className="flex-1"
                />
                <span className="text-[11px] text-cyan-400 font-mono w-10 text-right">
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
                        : "bg-neutral-900 border-neutral-800 text-neutral-500"
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const isPanelOpen = activePanel === "assets" || activePanel === "transform" || activePanel === "sound" || activePanel === "speed";

  // Which tabs to show in the panel header
  const panelTabs = activePanel === "assets"
    ? ASSET_SUB_TABS
    : NAV_ITEMS.filter((t) => t.id === "transform" || t.id === "sound" || t.id === "speed");

  return (
    <>
      {/* Expandable panel */}
      {isPanelOpen && (
        <div className="bg-[#0d0d0f] border-t border-neutral-800/50 max-h-[40vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {/* Tabs */}
          <div className="flex items-center border-b border-neutral-800/50 sticky top-0 bg-[#0d0d0f] z-10">
            {activePanel === "assets"
              ? ASSET_SUB_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = assetSubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setAssetSubTab(tab.id)}
                      className={cn(
                        "flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[11px] transition-all",
                        isActive
                          ? "font-medium text-white border-b-2 border-cyan-400 bg-cyan-500/10"
                          : "font-normal text-neutral-500"
                      )}
                    >
                      <Icon className={cn("w-3.5 h-3.5", isActive && "text-cyan-400")} strokeWidth={1.5} />
                      {tab.label}
                    </button>
                  );
                })
              : panelTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activePanel === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActivePanel(tab.id as MobileTool)}
                      className={cn(
                        "flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[11px] transition-all",
                        isActive
                          ? "font-medium text-white border-b-2 border-cyan-400 bg-cyan-500/10"
                          : "font-normal text-neutral-500"
                      )}
                    >
                      <Icon className={cn("w-3.5 h-3.5", isActive && "text-cyan-400")} strokeWidth={1.5} />
                      {tab.label}
                    </button>
                  );
                })
            }
            <button
              onClick={() => setActivePanel(null)}
              className="px-3 py-2.5 text-neutral-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {renderPanelContent()}
          </div>
        </div>
      )}

      {/* Bottom icon bar */}
      <div className="flex-none bg-[#0a0a0a] border-t border-neutral-800/50 flex items-center justify-around px-2 py-2 safe-area-bottom">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleToolClick(item.id)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors",
                isActive ? "text-cyan-400" : "text-neutral-500 active:text-white"
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={1.5} />
              <span className="text-[9px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
