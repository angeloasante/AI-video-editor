"use client";

import { useState } from "react";
import {
  Move,
  Volume2,
  Gauge,
  Crop,
  FileText,
  FlipHorizontal2,
  FlipVertical2,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import type { ClipEdits } from "@/types/editor";

type ToolTab = "transform" | "volume" | "speed" | "crop" | "transcribe";

const toolTabs: { id: ToolTab; icon: React.ElementType; label: string }[] = [
  { id: "transform", icon: Move, label: "Transform" },
  { id: "volume", icon: Volume2, label: "Volume" },
  { id: "speed", icon: Gauge, label: "Speed" },
  { id: "crop", icon: Crop, label: "Crop" },
  { id: "transcribe", icon: FileText, label: "Transcribe" },
];

interface EditorToolsPanelProps {
  clipEdits: ClipEdits | null;
  hasSelectedClip: boolean;
  onEditsChange: (edits: Partial<ClipEdits>) => void;
}

export function EditorToolsPanel({
  clipEdits,
  hasSelectedClip,
  onEditsChange,
}: EditorToolsPanelProps) {
  const [activeTab, setActiveTab] = useState<ToolTab>("transform");

  const edits = clipEdits || {
    volume: 1,
    speed: 1,
    mirrorH: false,
    mirrorV: false,
    rotation: 0,
  };

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

    switch (activeTab) {
      case "transform":
        return (
          <div className="space-y-5">
            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
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

            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
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
        );

      case "volume":
        return (
          <div className="space-y-5">
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
              <div className="grid grid-cols-5 gap-1.5">
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

      case "crop":
        return (
          <div className="space-y-5">
            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Crop
            </h3>
            {(["top", "right", "bottom", "left"] as const).map((side) => (
              <div key={side} className="space-y-1.5">
                <label className="text-xs text-neutral-500 capitalize">{side}</label>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[edits.crop?.[side] ?? 0]}
                    min={0}
                    max={45}
                    step={1}
                    onValueChange={(v) =>
                      onEditsChange({
                        crop: { ...{ top: 0, right: 0, bottom: 0, left: 0 }, ...edits.crop, [side]: v[0] },
                      })
                    }
                    className="flex-1"
                  />
                  <span className="text-xs text-cyan-400 font-mono w-8 text-right">
                    {edits.crop?.[side] ?? 0}%
                  </span>
                </div>
              </div>
            ))}
            <button
              onClick={() =>
                onEditsChange({ crop: { top: 0, right: 0, bottom: 0, left: 0 } })
              }
              className="w-full py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs hover:border-neutral-700 transition-colors"
            >
              Reset Crop
            </button>
          </div>
        );

      case "transcribe":
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <FileText className="w-8 h-8 text-neutral-600 mb-3" />
            <p className="text-sm text-neutral-400 mb-1">Transcription</p>
            <p className="text-xs text-neutral-600">
              Auto-transcribe your clips with AI. Coming soon.
            </p>
          </div>
        );
    }
  };

  return (
    <section className="w-[260px] flex-none bg-[#0d0d0f] rounded-2xl border border-neutral-800/50 flex flex-col overflow-hidden">
      {/* Tool tabs */}
      <div className="flex items-center px-1 pt-2 border-b border-neutral-800/50">
        {toolTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 pb-2 pt-1 flex flex-col items-center gap-0.5 text-[10px] transition-all rounded-t-lg",
                isActive
                  ? "font-medium text-white border-b-2 border-cyan-400 bg-cyan-500/10"
                  : "font-normal text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5", isActive && "text-cyan-400")} strokeWidth={1.5} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
        {renderContent()}
      </div>
    </section>
  );
}
