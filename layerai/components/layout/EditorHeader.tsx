"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pen,
  Cloud,
  LayoutPanelLeft,
  Share2,
  ArrowUpToLine,
  LogOut,
  Layers,
  MoreVertical,
} from "lucide-react";

interface EditorHeaderProps {
  projectName?: string;
  lastSaved?: string;
  userEmail?: string;
  hasSceneDNA?: boolean;
  onBack?: () => void;
  onShare?: () => void;
  onExport?: () => void;
  onTogglePanel?: () => void;
  onSignOut?: () => void;
  onOpenSceneDNA?: () => void;
}

export function EditorHeader({
  projectName = "Untitled Project",
  lastSaved = "Just now",
  userEmail,
  hasSceneDNA,
  onBack,
  onShare,
  onExport,
  onTogglePanel,
  onSignOut,
  onOpenSceneDNA,
}: EditorHeaderProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="h-12 flex-none flex items-center justify-between px-4 z-10 shrink-0 safe-area-top">
      {/* Left: Title & Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/projects")}
          className="w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-white transition-colors rounded-lg hover:bg-neutral-800"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <div className="flex items-center gap-2 px-2 py-1 hover:bg-neutral-800 rounded-md cursor-pointer transition-colors group">
          <span className="text-[14px] font-medium text-white tracking-tight md:max-w-none max-w-[120px] truncate">
            {projectName}
          </span>
          <Pen
            className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300 transition-colors hidden md:block"
            strokeWidth={1.5}
          />
        </div>

        {/* Scene DNA button — hidden on mobile */}
        <button
          onClick={onOpenSceneDNA}
          title="View Scene DNA"
          className={`h-7 px-2.5 hidden md:flex items-center gap-1.5 rounded-md text-[11px] font-medium transition-colors border ${
            hasSceneDNA
              ? "bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
              : "bg-neutral-800/50 border-neutral-700 text-neutral-400 hover:text-purple-400 hover:border-purple-500/30"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Scene DNA</span>
        </button>
      </div>

      {/* Right: Actions & Status */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Saved status — hidden on mobile */}
        <div className="hidden md:flex items-center gap-1.5 text-sm text-neutral-500">
          <Cloud className="w-4 h-4" strokeWidth={1.5} />
          <span className="font-normal text-xs">Saved {lastSaved}</span>
        </div>

        <div className="h-4 w-px bg-neutral-800 hidden md:block" />

        {/* User — hidden on mobile */}
        {userEmail && (
          <div className="hidden md:flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-[11px] font-bold text-black uppercase">
              {userEmail[0]}
            </div>
            <span className="text-xs text-neutral-500 hidden xl:inline max-w-[120px] truncate">
              {userEmail}
            </span>
            <button
              onClick={onSignOut}
              title="Sign out"
              className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-red-400 transition-colors rounded-lg hover:bg-neutral-800"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        )}

        <button
          onClick={onTogglePanel}
          className="w-8 h-8 hidden md:flex items-center justify-center text-neutral-500 hover:text-white transition-colors rounded-lg hover:bg-neutral-800"
        >
          <LayoutPanelLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>

        <button
          onClick={onShare}
          className="h-8 px-3 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-neutral-300 text-sm font-medium rounded-lg transition-colors hidden md:flex items-center gap-2"
        >
          <Share2 className="w-4 h-4" strokeWidth={1.5} />
          Share
        </button>

        {/* Desktop: Export button */}
        <button
          onClick={onExport}
          className="h-8 px-4 bg-white hover:bg-neutral-200 text-black text-sm font-medium rounded-lg transition-colors hidden md:flex items-center gap-2"
        >
          <ArrowUpToLine className="w-4 h-4" strokeWidth={1.5} />
          Export
        </button>

        {/* Mobile: dropdown menu with all actions */}
        <div className="relative md:hidden">
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white transition-colors rounded-lg hover:bg-neutral-800"
          >
            <MoreVertical className="w-5 h-5" strokeWidth={1.5} />
          </button>

          {mobileMenuOpen && (
            <>
              {/* Backdrop to close menu */}
              <div className="fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)} />

              <div className="absolute right-0 top-full mt-1 w-52 bg-[#141416] border border-neutral-800 rounded-lg shadow-xl z-50 py-1">
                <button
                  onClick={() => { onOpenSceneDNA?.(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-neutral-300 hover:bg-neutral-800"
                >
                  <Layers className="w-4 h-4 text-purple-400" />
                  Scene DNA
                </button>
                <button
                  onClick={() => { onShare?.(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-neutral-300 hover:bg-neutral-800"
                >
                  <Share2 className="w-4 h-4 text-neutral-500" />
                  Share
                </button>
                <button
                  onClick={() => { onExport?.(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-neutral-300 hover:bg-neutral-800"
                >
                  <ArrowUpToLine className="w-4 h-4 text-neutral-500" />
                  Export
                </button>

                <div className="h-px bg-neutral-800 my-1" />

                <div className="flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-500">
                  <Cloud className="w-4 h-4" />
                  Saved {lastSaved}
                </div>

                {userEmail && (
                  <>
                    <div className="h-px bg-neutral-800 my-1" />
                    <div className="flex items-center gap-2.5 px-3 py-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-[8px] font-bold text-black uppercase">
                        {userEmail[0]}
                      </div>
                      <span className="text-xs text-neutral-400 truncate flex-1">{userEmail}</span>
                    </div>
                    <button
                      onClick={() => { onSignOut?.(); setMobileMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-red-400 hover:bg-neutral-800"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
