"use client";

import {
  MoreHorizontal,
  Volume2,
  AlignStartVertical,
  AlignEndVertical,
  Type,
  ChevronDown,
  ChevronRight,
  Mic,
  Wand2,
  AudioLines,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { IconButton } from "@/components/shared/IconButton";
import { SliderControl } from "@/components/shared/SliderControl";
import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  volume: number;
  fadeIn: number;
  fadeOut: number;
  onVolumeChange: (value: number) => void;
  onFadeInChange: (value: number) => void;
  onFadeOutChange: (value: number) => void;
  overrideSettings: boolean;
  onOverrideSettingsChange: (value: boolean) => void;
  onEnhanceText?: () => void;
}

export function SettingsPanel({
  volume,
  fadeIn,
  fadeOut,
  onVolumeChange,
  onFadeInChange,
  onFadeOutChange,
  overrideSettings,
  onOverrideSettingsChange,
  onEnhanceText,
}: SettingsPanelProps) {
  return (
    <aside className="w-[320px] flex-none border-r border-neutral-800/80 bg-[#0f0f11] flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.2)] overflow-hidden">
      {/* Header */}
      <div className="h-14 flex-none flex items-center justify-between px-5 border-b border-neutral-800/80">
        <h2 className="text-base font-normal text-neutral-100 tracking-tight">Edit Speech</h2>
        <IconButton icon={MoreHorizontal} size="sm" />
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 h-0">
        <div className="p-5 space-y-8">
          {/* Volume Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-normal text-neutral-200">Volume</h3>
            <SliderControl
              icon={Volume2}
              value={volume}
              min={0}
              max={100}
              onChange={onVolumeChange}
              unit="%"
            />
            <SliderControl
              icon={AlignStartVertical}
              label="Fade In"
              value={fadeIn}
              min={0}
              max={10}
              step={0.1}
              onChange={onFadeInChange}
              unit="s"
            />
            <SliderControl
              icon={AlignEndVertical}
              label="Fade Out"
              value={fadeOut}
              min={0}
              max={10}
              step={0.1}
              onChange={onFadeOutChange}
              unit="s"
            />
          </div>

          {/* Type Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-normal text-neutral-200">Type</h3>
            <button className="w-full flex items-center justify-between bg-[#1a1a1c] hover:bg-[#202022] border border-neutral-800 rounded-lg px-3 py-2.5 cursor-pointer transition-colors">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
                <span className="text-sm text-neutral-200">Text</span>
              </div>
              <ChevronDown className="w-4 h-4 text-neutral-500" strokeWidth={1.5} />
            </button>
          </div>

          {/* Model Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-normal text-neutral-200">Model</h3>
            <button className="w-full flex items-center justify-between bg-[#1a1a1c] hover:bg-[#202022] border border-neutral-800 rounded-lg px-3 py-2.5 cursor-pointer transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium border border-neutral-700 bg-neutral-800/50 text-neutral-300 px-1 py-0.5 rounded leading-none">
                  V2
                </span>
                <span className="text-sm text-neutral-200 truncate max-w-[180px]">
                  Eleven Multilingual v2
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-500" strokeWidth={1.5} />
            </button>
          </div>

          {/* Voice Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-normal text-neutral-200">Voice</h3>
            <div className="bg-[#1a1a1c] border border-neutral-800 rounded-xl overflow-hidden">
              <button className="w-full flex items-center justify-between px-3 py-3 border-b border-neutral-800 cursor-pointer hover:bg-[#202022] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center relative shadow-sm">
                    <div className="w-1.5 h-1.5 bg-white rounded-full absolute top-1 right-0 border-[1.5px] border-[#1a1a1c]" />
                    <Mic className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                  </div>
                  <span className="text-sm text-neutral-200 font-normal">Rachel (Legacy)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">Default</span>
                  <ChevronDown className="w-4 h-4 text-neutral-600" strokeWidth={1.5} />
                </div>
              </button>
              <div className="px-3 py-3 flex items-center justify-between bg-[#151517]">
                <span className="text-sm text-neutral-300">Override settings</span>
                <Switch
                  checked={overrideSettings}
                  onCheckedChange={onOverrideSettingsChange}
                />
              </div>
            </div>
          </div>

          {/* AI Tools Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-normal text-neutral-200">AI Tools</h3>

            <button
              onClick={onEnhanceText}
              className="w-full bg-[#1a1a1c] border border-neutral-800 rounded-xl p-3 flex gap-3 cursor-pointer hover:bg-[#202022] transition-colors group text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-[#b5603c]/20 flex items-center justify-center flex-none">
                <Wand2 className="w-4 h-4 text-[#e07f56]" strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-sm text-neutral-200 font-normal">Enhance text</div>
                <div className="text-xs text-neutral-500 mt-0.5 group-hover:text-neutral-400 transition-colors">
                  Enhance text to help guide delivery
                </div>
              </div>
            </button>

            <div className="bg-[#151517] border border-neutral-800/50 rounded-xl p-3 flex gap-3 opacity-50 cursor-not-allowed">
              <div className="w-8 h-8 rounded-lg bg-neutral-800/50 flex items-center justify-center flex-none">
                <AudioLines className="w-4 h-4 text-neutral-500" strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-sm text-neutral-400 font-normal">
                  Remove background audio
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
