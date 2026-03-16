"use client";

import { Sparkles, Wand2, Music, Video, LayoutGrid, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarTab } from "@/types";

const icons = {
  edit: Sparkles,
  sfx: Wand2,
  music: Music,
  video: Video,
  voices: LayoutGrid,
  files: Folder,
} as const;

const labels = {
  edit: "Edit",
  sfx: "SFX",
  music: "Music",
  video: "Video",
  voices: "Voices",
  files: "Files",
} as const;

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const tabs: SidebarTab[] = ["edit", "sfx", "music", "video", "voices", "files"];

  return (
    <nav className="w-[68px] flex-none border-r border-neutral-800/80 bg-[#0a0a0a] flex flex-col items-center py-4 gap-6 z-10">
      {tabs.map((tab) => {
        const Icon = icons[tab];
        const label = labels[tab];
        const isActive = activeTab === tab;

        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={cn(
              "flex flex-col items-center gap-1.5 group transition-opacity",
              !isActive && "opacity-70 hover:opacity-100"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                isActive && "bg-white shadow-sm"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5",
                  isActive ? "text-black" : "text-neutral-400"
                )}
                strokeWidth={1.5}
              />
            </div>
            <span
              className={cn(
                "text-xs",
                isActive ? "font-medium text-white" : "text-neutral-400"
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
