"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const aspectPresets = [
  { label: "Free", value: null as number | null },
  { label: "16:9", value: 16 / 9 },
  { label: "9:16", value: 9 / 16 },
  { label: "4:3", value: 4 / 3 },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
];

interface CropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaSrc: string | null;
  mediaType: "video" | "image";
  initialCrop?: { top: number; right: number; bottom: number; left: number };
  onApply: (crop: { top: number; right: number; bottom: number; left: number }) => void;
}

type DragHandle = "top" | "right" | "bottom" | "left" | "tl" | "tr" | "bl" | "br" | "move" | null;

export function CropDialog({
  open,
  onOpenChange,
  mediaSrc,
  mediaType,
  initialCrop,
  onApply,
}: CropDialogProps) {
  // Crop values as percentages (0-100)
  const [top, setTop] = useState(initialCrop?.top ?? 0);
  const [right, setRight] = useState(initialCrop?.right ?? 0);
  const [bottom, setBottom] = useState(initialCrop?.bottom ?? 0);
  const [left, setLeft] = useState(initialCrop?.left ?? 0);
  const [aspect, setAspect] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    handle: DragHandle;
    startX: number;
    startY: number;
    startTop: number;
    startRight: number;
    startBottom: number;
    startLeft: number;
  } | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setTop(initialCrop?.top ?? 0);
      setRight(initialCrop?.right ?? 0);
      setBottom(initialCrop?.bottom ?? 0);
      setLeft(initialCrop?.left ?? 0);
      setAspect(null);
    }
  }, [open, initialCrop]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const handleMouseDown = useCallback((handle: DragHandle, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startTop: top,
      startRight: right,
      startBottom: bottom,
      startLeft: left,
    };
  }, [top, right, bottom, left]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      const container = containerRef.current;
      if (!drag || !container) return;

      const rect = container.getBoundingClientRect();
      const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;

      const minSize = 5; // minimum crop area 5%

      if (drag.handle === "move") {
        // Move the entire crop rectangle
        const cropW = 100 - drag.startLeft - drag.startRight;
        const cropH = 100 - drag.startTop - drag.startBottom;
        let newLeft = clamp(drag.startLeft + dxPct, 0, 100 - cropW);
        let newTop = clamp(drag.startTop + dyPct, 0, 100 - cropH);
        setLeft(newLeft);
        setRight(100 - newLeft - cropW);
        setTop(newTop);
        setBottom(100 - newTop - cropH);
        return;
      }

      let newTop = drag.startTop;
      let newRight = drag.startRight;
      let newBottom = drag.startBottom;
      let newLeft = drag.startLeft;

      // Edge drags
      if (drag.handle === "top" || drag.handle === "tl" || drag.handle === "tr") {
        newTop = clamp(drag.startTop + dyPct, 0, 100 - newBottom - minSize);
      }
      if (drag.handle === "bottom" || drag.handle === "bl" || drag.handle === "br") {
        newBottom = clamp(drag.startBottom - dyPct, 0, 100 - newTop - minSize);
      }
      if (drag.handle === "left" || drag.handle === "tl" || drag.handle === "bl") {
        newLeft = clamp(drag.startLeft + dxPct, 0, 100 - newRight - minSize);
      }
      if (drag.handle === "right" || drag.handle === "tr" || drag.handle === "br") {
        newRight = clamp(drag.startRight - dxPct, 0, 100 - newLeft - minSize);
      }

      // Enforce aspect ratio if set
      if (aspect !== null) {
        const cropW = 100 - newLeft - newRight;
        const cropH = 100 - newTop - newBottom;
        const containerAspect = rect.width / rect.height;
        const currentAspect = (cropW / cropH) * containerAspect;

        if (drag.handle === "right" || drag.handle === "left") {
          // Width changed — adjust height
          const targetH = (cropW * containerAspect) / aspect;
          const dh = targetH - cropH;
          newBottom = clamp(newBottom - dh / 2, 0, 100 - newTop - minSize);
          newTop = clamp(newTop - dh / 2, 0, 100 - newBottom - minSize);
        } else {
          // Height changed — adjust width
          const targetW = (cropH * aspect) / containerAspect;
          const dw = targetW - cropW;
          newRight = clamp(newRight - dw / 2, 0, 100 - newLeft - minSize);
          newLeft = clamp(newLeft - dw / 2, 0, 100 - newRight - minSize);
        }
      }

      setTop(newTop);
      setRight(newRight);
      setBottom(newBottom);
      setLeft(newLeft);
    };

    const handleMouseUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [aspect]);

  if (!open || !mediaSrc) return null;

  const handleApply = () => {
    onApply({
      top: Math.max(0, Math.round(top)),
      right: Math.max(0, Math.round(right)),
      bottom: Math.max(0, Math.round(bottom)),
      left: Math.max(0, Math.round(left)),
    });
    onOpenChange(false);
  };

  const handleReset = () => {
    setTop(0);
    setRight(0);
    setBottom(0);
    setLeft(0);
  };

  const handleStyle = "absolute bg-cyan-400 z-10";
  const cornerSize = 14;
  const edgeThickness = 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-white">Crop</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              title="Reset crop"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-white"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
        </div>

        {/* Crop Area */}
        <div
          ref={containerRef}
          className="relative w-full h-[450px] bg-black select-none"
        >
          {/* Media */}
          {mediaType === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaSrc}
              alt="Crop preview"
              className="w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
          ) : (
            <video
              src={mediaSrc}
              className="w-full h-full object-contain pointer-events-none"
              autoPlay
              loop
              muted
              playsInline
            />
          )}

          {/* Dark overlay outside crop area */}
          {/* Top */}
          <div
            className="absolute left-0 right-0 top-0 bg-black/60"
            style={{ height: `${top}%` }}
          />
          {/* Bottom */}
          <div
            className="absolute left-0 right-0 bottom-0 bg-black/60"
            style={{ height: `${bottom}%` }}
          />
          {/* Left */}
          <div
            className="absolute left-0 bg-black/60"
            style={{ top: `${top}%`, bottom: `${bottom}%`, width: `${left}%` }}
          />
          {/* Right */}
          <div
            className="absolute right-0 bg-black/60"
            style={{ top: `${top}%`, bottom: `${bottom}%`, width: `${right}%` }}
          />

          {/* Crop border */}
          <div
            className="absolute border-2 border-cyan-400"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              right: `${right}%`,
              bottom: `${bottom}%`,
            }}
          >
            {/* Grid lines (rule of thirds) */}
            <div className="absolute inset-0">
              <div className="absolute top-1/3 left-0 right-0 h-px bg-cyan-400/30" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-cyan-400/30" />
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-cyan-400/30" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-cyan-400/30" />
            </div>

            {/* Move handle — entire crop area is draggable */}
            <div
              className="absolute inset-0 cursor-move"
              onMouseDown={(e) => handleMouseDown("move", e)}
            />
          </div>

          {/* Edge handles */}
          {/* Top edge */}
          <div
            className={cn(handleStyle, "cursor-ns-resize rounded-full")}
            style={{
              top: `${top}%`,
              left: `${left + (100 - left - right) * 0.3}%`,
              width: `${(100 - left - right) * 0.4}%`,
              height: edgeThickness,
              transform: "translateY(-50%)",
            }}
            onMouseDown={(e) => handleMouseDown("top", e)}
          />
          {/* Bottom edge */}
          <div
            className={cn(handleStyle, "cursor-ns-resize rounded-full")}
            style={{
              bottom: `${bottom}%`,
              left: `${left + (100 - left - right) * 0.3}%`,
              width: `${(100 - left - right) * 0.4}%`,
              height: edgeThickness,
              transform: "translateY(50%)",
            }}
            onMouseDown={(e) => handleMouseDown("bottom", e)}
          />
          {/* Left edge */}
          <div
            className={cn(handleStyle, "cursor-ew-resize rounded-full")}
            style={{
              left: `${left}%`,
              top: `${top + (100 - top - bottom) * 0.3}%`,
              height: `${(100 - top - bottom) * 0.4}%`,
              width: edgeThickness,
              transform: "translateX(-50%)",
            }}
            onMouseDown={(e) => handleMouseDown("left", e)}
          />
          {/* Right edge */}
          <div
            className={cn(handleStyle, "cursor-ew-resize rounded-full")}
            style={{
              right: `${right}%`,
              top: `${top + (100 - top - bottom) * 0.3}%`,
              height: `${(100 - top - bottom) * 0.4}%`,
              width: edgeThickness,
              transform: "translateX(50%)",
            }}
            onMouseDown={(e) => handleMouseDown("right", e)}
          />

          {/* Corner handles */}
          {/* Top-left */}
          <div
            className={cn(handleStyle, "cursor-nwse-resize rounded-sm")}
            style={{
              top: `${top}%`,
              left: `${left}%`,
              width: cornerSize,
              height: cornerSize,
              transform: "translate(-50%, -50%)",
            }}
            onMouseDown={(e) => handleMouseDown("tl", e)}
          />
          {/* Top-right */}
          <div
            className={cn(handleStyle, "cursor-nesw-resize rounded-sm")}
            style={{
              top: `${top}%`,
              right: `${right}%`,
              width: cornerSize,
              height: cornerSize,
              transform: "translate(50%, -50%)",
            }}
            onMouseDown={(e) => handleMouseDown("tr", e)}
          />
          {/* Bottom-left */}
          <div
            className={cn(handleStyle, "cursor-nesw-resize rounded-sm")}
            style={{
              bottom: `${bottom}%`,
              left: `${left}%`,
              width: cornerSize,
              height: cornerSize,
              transform: "translate(-50%, 50%)",
            }}
            onMouseDown={(e) => handleMouseDown("bl", e)}
          />
          {/* Bottom-right */}
          <div
            className={cn(handleStyle, "cursor-nwse-resize rounded-sm")}
            style={{
              bottom: `${bottom}%`,
              right: `${right}%`,
              width: cornerSize,
              height: cornerSize,
              transform: "translate(50%, 50%)",
            }}
            onMouseDown={(e) => handleMouseDown("br", e)}
          />

          {/* Dimensions display */}
          <div
            className="absolute text-[10px] text-cyan-300 font-mono bg-black/60 px-1.5 py-0.5 rounded pointer-events-none"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              transform: "translate(4px, 4px)",
            }}
          >
            {Math.round(100 - left - right)}% × {Math.round(100 - top - bottom)}%
          </div>
        </div>

        {/* Controls */}
        <div className="px-4 py-3 border-t border-neutral-800 space-y-3">
          {/* Aspect ratio presets */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 w-12 shrink-0">Ratio</span>
            <div className="flex gap-1.5">
              {aspectPresets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setAspect(p.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                    aspect === p.value
                      ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                      : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Manual input */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 w-12 shrink-0">Inset</span>
            <div className="flex gap-2">
              {[
                { label: "T", value: top, set: setTop },
                { label: "R", value: right, set: setRight },
                { label: "B", value: bottom, set: setBottom },
                { label: "L", value: left, set: setLeft },
              ].map(({ label, value, set }) => (
                <label key={label} className="flex items-center gap-1">
                  <span className="text-[10px] text-neutral-500 w-3">{label}</span>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={Math.round(value)}
                    onChange={(e) => set(clamp(Number(e.target.value), 0, 90))}
                    className="w-12 px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-xs text-white text-center"
                  />
                  <span className="text-[10px] text-neutral-600">%</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-neutral-800">
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2.5 rounded-xl transition-colors font-medium bg-cyan-500 hover:bg-cyan-400 text-black"
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}
