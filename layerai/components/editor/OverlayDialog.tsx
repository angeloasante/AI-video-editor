"use client";

import { useState, useCallback, useRef } from "react";
import { X, Upload, Image as ImageIcon, Film, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { VideoOverlay } from "@/types/editor";

interface OverlayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overlays: VideoOverlay[];
  onAddOverlay: (overlay: Omit<VideoOverlay, "id">) => void;
  onUpdateOverlay: (id: string, changes: Partial<VideoOverlay>) => void;
  onDeleteOverlay: (id: string) => void;
  currentTime: number;
  duration: number;
}

export function OverlayDialog({
  open,
  onOpenChange,
  overlays,
  onAddOverlay,
  onUpdateOverlay,
  onDeleteOverlay,
  currentTime,
  duration,
}: OverlayDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedOverlay = overlays.find((o) => o.id === selectedId) || null;

  const handleFileUpload = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file) => {
        const isVideo = file.type.startsWith("video/");
        const isImage = file.type.startsWith("image/");
        if (!isVideo && !isImage) return;

        const url = URL.createObjectURL(file);
        const endTime = Math.min(currentTime + 5, duration || currentTime + 5);

        onAddOverlay({
          src: url,
          name: file.name,
          type: isVideo ? "video" : "image",
          x: 10,
          y: 10,
          width: 30,
          height: 30,
          opacity: 1,
          rotation: 0,
          startTime: currentTime,
          endTime,
        });
      });
    },
    [currentTime, duration, onAddOverlay]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFileUpload(e.dataTransfer.files);
    },
    [handleFileUpload]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111114] border border-neutral-800 rounded-xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <h3 className="text-sm font-medium text-white">Overlay Layers</h3>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left: overlay list */}
          <div className="w-[220px] border-r border-neutral-800 flex flex-col">
            <div className="p-2 border-b border-neutral-800">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800/50 hover:bg-neutral-700/50 text-neutral-300 text-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Overlay
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>

            <div
              className={cn(
                "flex-1 overflow-y-auto p-2 space-y-1",
                dragOver && "bg-cyan-500/10 ring-1 ring-inset ring-cyan-500/30"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {overlays.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Upload className="w-6 h-6 text-neutral-600 mb-2" />
                  <p className="text-xs text-neutral-500">
                    Drop images or videos here
                  </p>
                </div>
              ) : (
                overlays.map((overlay) => (
                  <div
                    key={overlay.id}
                    onClick={() => setSelectedId(overlay.id)}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors cursor-pointer",
                      selectedId === overlay.id
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                    )}
                  >
                    {overlay.type === "image" ? (
                      <ImageIcon className="w-3.5 h-3.5 flex-none" />
                    ) : (
                      <Film className="w-3.5 h-3.5 flex-none" />
                    )}
                    <span className="truncate flex-1">{overlay.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteOverlay(overlay.id);
                        if (selectedId === overlay.id) setSelectedId(null);
                      }}
                      className="p-0.5 rounded hover:bg-red-500/20 text-neutral-600 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: selected overlay properties */}
          <div className="flex-1 p-4 overflow-y-auto">
            {selectedOverlay ? (
              <div className="space-y-4">
                {/* Preview thumbnail */}
                <div className="aspect-video rounded-lg bg-neutral-900 border border-neutral-800 overflow-hidden flex items-center justify-center">
                  {selectedOverlay.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedOverlay.src}
                      alt={selectedOverlay.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <video
                      src={selectedOverlay.src}
                      className="max-w-full max-h-full object-contain"
                      muted
                    />
                  )}
                </div>

                {/* Position */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-neutral-500">Position</span>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-xs text-neutral-400">X (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={Math.round(selectedOverlay.x)}
                        onChange={(e) => onUpdateOverlay(selectedOverlay.id, { x: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-neutral-400">Y (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={Math.round(selectedOverlay.y)}
                        onChange={(e) => onUpdateOverlay(selectedOverlay.id, { y: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs text-white"
                      />
                    </label>
                  </div>
                </div>

                {/* Size */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-neutral-500">Size</span>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-xs text-neutral-400">Width (%)</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={Math.round(selectedOverlay.width)}
                        onChange={(e) => onUpdateOverlay(selectedOverlay.id, { width: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-neutral-400">Height (%)</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={Math.round(selectedOverlay.height)}
                        onChange={(e) => onUpdateOverlay(selectedOverlay.id, { height: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs text-white"
                      />
                    </label>
                  </div>
                </div>

                {/* Opacity */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-neutral-500">Opacity</span>
                    <span className="text-xs text-neutral-400">{Math.round(selectedOverlay.opacity * 100)}%</span>
                  </div>
                  <Slider
                    value={[selectedOverlay.opacity * 100]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([v]) => onUpdateOverlay(selectedOverlay.id, { opacity: v / 100 })}
                  />
                </div>

                {/* Rotation */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-neutral-500">Rotation</span>
                    <span className="text-xs text-neutral-400">{selectedOverlay.rotation}°</span>
                  </div>
                  <Slider
                    value={[selectedOverlay.rotation]}
                    min={0}
                    max={360}
                    step={1}
                    onValueChange={([v]) => onUpdateOverlay(selectedOverlay.id, { rotation: v })}
                  />
                </div>

                {/* Time range */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-neutral-500">Time Range</span>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-xs text-neutral-400">Start (s)</span>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={selectedOverlay.startTime.toFixed(1)}
                        onChange={(e) => onUpdateOverlay(selectedOverlay.id, { startTime: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-neutral-400">End (s)</span>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={selectedOverlay.endTime.toFixed(1)}
                        onChange={(e) => onUpdateOverlay(selectedOverlay.id, { endTime: Number(e.target.value) })}
                        className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs text-white"
                      />
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-xs text-neutral-500">
                  Select an overlay to edit its properties
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-neutral-800">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
