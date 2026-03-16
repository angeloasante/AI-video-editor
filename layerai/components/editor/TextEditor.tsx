"use client";

import { RefreshCw, StopCircle, Lock, BookOpen, ChevronLeft } from "lucide-react";
import { IconButton } from "@/components/shared/IconButton";
import { Separator } from "@/components/ui/separator";

interface TextEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  onGenerate?: () => void;
  onToggleLock?: () => void;
  isLocked?: boolean;
  onCollapseSidebar?: () => void;
}

export function TextEditor({
  content,
  onContentChange,
  onGenerate,
  onToggleLock,
  isLocked = false,
  onCollapseSidebar,
}: TextEditorProps) {
  return (
    <section className="flex-1 flex flex-col bg-[#0d0d0f] border-r border-neutral-800/80 relative min-w-[300px]">
      {/* Editor Toolbar */}
      <div className="h-14 flex items-center justify-center gap-6 px-6 border-b border-neutral-800/50">
        <button
          onClick={onGenerate}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
          <span>Generate</span>
        </button>
        <Separator orientation="vertical" className="h-4 bg-neutral-800" />
        <IconButton icon={StopCircle} size="sm" tooltip="Stop" />
        <IconButton
          icon={Lock}
          size="sm"
          tooltip="Lock"
          active={isLocked}
          onClick={onToggleLock}
        />
        <Separator orientation="vertical" className="h-4 bg-neutral-800" />
        <IconButton icon={BookOpen} size="sm" tooltip="Script" />
      </div>

      {/* Text Area */}
      <div className="flex-1 p-10 relative group">
        {/* Collapse Sidebar Button */}
        <button
          onClick={onCollapseSidebar}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 hover:w-4 h-16 bg-neutral-800 hover:bg-neutral-700 rounded-r-md opacity-50 hover:opacity-100 transition-all duration-200 cursor-pointer flex items-center justify-center overflow-hidden z-50 shadow-sm border-y border-r border-neutral-700/50"
          title="Collapse sidebar"
        >
          <ChevronLeft className="w-3 h-3 text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity flex-none" />
        </button>

        <div
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onContentChange(e.currentTarget.textContent || "")}
          className="text-lg text-neutral-600 font-normal tracking-tight leading-relaxed max-w-2xl outline-none focus:text-neutral-400 transition-colors"
        >
          {content || "Start typing here or paste any text you want to turn into lifelike speech..."}
        </div>
      </div>
    </section>
  );
}
