"use client";

import { Menu, Undo, Redo, CircleDashed, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/shared/IconButton";
import { Separator } from "@/components/ui/separator";
import { DEFAULT_CREDITS } from "@/lib/constants";

interface HeaderProps {
  projectName?: string;
  credits?: number;
  onMenuClick?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onShare?: () => void;
  onExport?: () => void;
}

export function Header({
  projectName = "An animated sitcom fea...",
  credits = DEFAULT_CREDITS,
  onMenuClick,
  onUndo,
  onRedo,
  canUndo = true,
  canRedo = false,
  onShare,
  onExport,
}: HeaderProps) {
  return (
    <header className="h-14 flex-none border-b border-neutral-800/80 flex items-center justify-between px-4 bg-[#0a0a0a] relative z-20">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <IconButton icon={Menu} onClick={onMenuClick} tooltip="Menu" />
        <Separator orientation="vertical" className="h-4 bg-neutral-800" />
        <IconButton icon={Undo} onClick={onUndo} disabled={!canUndo} tooltip="Undo" />
        <IconButton icon={Redo} onClick={onRedo} disabled={!canRedo} tooltip="Redo" />
      </div>

      {/* Center Section - Project Name */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-normal text-neutral-200">{projectName}</span>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs">
          <CircleDashed className="w-3.5 h-3.5 text-neutral-500" strokeWidth={1.5} />
          <span>{credits.toLocaleString()} credits remaining</span>
        </div>
        <IconButton icon={MessageSquare} tooltip="Feedback" />
        <Button
          variant="secondary"
          size="sm"
          onClick={onShare}
          className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
        >
          Share
        </Button>
        <Button
          size="sm"
          onClick={onExport}
          className="bg-neutral-100 hover:bg-white text-black shadow-sm"
        >
          Export
        </Button>
      </div>
    </header>
  );
}
