"use client";

import { useState, useEffect, useRef } from "react";
import { X, Sparkles, Type, ArrowUp, ArrowDown, Maximize2, Zap, RotateCw, Move, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Text animation types
type TextAnimationType = "none" | "fade" | "typewriter" | "slide-up" | "slide-down" | "scale" | "bounce";

// Curated Google Fonts list — popular, diverse, and well-supported
const GOOGLE_FONTS = [
  { name: "Inter", weights: [300, 400, 500, 600, 700, 800, 900] },
  { name: "Roboto", weights: [100, 300, 400, 500, 700, 900] },
  { name: "Open Sans", weights: [300, 400, 500, 600, 700, 800] },
  { name: "Montserrat", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: "Lato", weights: [100, 300, 400, 700, 900] },
  { name: "Poppins", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: "Playfair Display", weights: [400, 500, 600, 700, 800, 900] },
  { name: "Oswald", weights: [200, 300, 400, 500, 600, 700] },
  { name: "Raleway", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: "Bebas Neue", weights: [400] },
  { name: "Merriweather", weights: [300, 400, 700, 900] },
  { name: "Nunito", weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { name: "Rubik", weights: [300, 400, 500, 600, 700, 800, 900] },
  { name: "Work Sans", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: "Quicksand", weights: [300, 400, 500, 600, 700] },
  { name: "Barlow", weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { name: "Archivo Black", weights: [400] },
  { name: "Pacifico", weights: [400] },
  { name: "Caveat", weights: [400, 500, 600, 700] },
  { name: "Dancing Script", weights: [400, 500, 600, 700] },
  { name: "Permanent Marker", weights: [400] },
  { name: "Bangers", weights: [400] },
  { name: "Righteous", weights: [400] },
  { name: "Abril Fatface", weights: [400] },
  { name: "Cinzel", weights: [400, 500, 600, 700, 800, 900] },
  { name: "Source Code Pro", weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { name: "Space Mono", weights: [400, 700] },
  { name: "JetBrains Mono", weights: [100, 200, 300, 400, 500, 600, 700, 800] },
] as const;

const WEIGHT_LABELS: Record<number, string> = {
  100: "Thin",
  200: "ExtraLight",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
  700: "Bold",
  800: "ExtraBold",
  900: "Black",
};

// Track which fonts have been loaded to avoid duplicate link tags
const loadedFonts = new Set<string>();

function loadGoogleFont(fontName: string, weights?: number[]) {
  const key = `${fontName}:${(weights || [400]).join(",")}`;
  if (loadedFonts.has(key)) return;
  loadedFonts.add(key);

  const weightStr = (weights || [400]).join(";");
  const family = fontName.replace(/ /g, "+");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@${weightStr}&display=swap`;
  document.head.appendChild(link);
}

// Animation presets
const animationPresets: { id: TextAnimationType; name: string; icon: React.ElementType }[] = [
  { id: "none", name: "None", icon: Type },
  { id: "fade", name: "Fade", icon: Sparkles },
  { id: "typewriter", name: "Typewriter", icon: Type },
  { id: "slide-up", name: "Slide Up", icon: ArrowUp },
  { id: "slide-down", name: "Slide Down", icon: ArrowDown },
  { id: "scale", name: "Scale", icon: Maximize2 },
  { id: "bounce", name: "Bounce", icon: Zap },
];

interface TextOverlayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: {
    id: string;
    name: string;
    style: string;
  } | null;
  onSubmit: (
    text: string,
    preset: string,
    startTime: number,
    duration: number,
    animationType?: TextAnimationType,
    fadeIn?: number,
    fadeOut?: number,
    transform?: { scale: number; rotation: number },
    fontSize?: number,
    position?: { x: number; y: number },
    fontFamily?: string,
    fontWeight?: number,
    color?: string,
  ) => void;
  currentTime?: number;
}

export function TextOverlayDialog({
  open,
  onOpenChange,
  preset,
  onSubmit,
  currentTime = 0,
}: TextOverlayDialogProps) {
  const [text, setText] = useState("");
  const [startTime, setStartTime] = useState(currentTime);
  const [duration, setDuration] = useState(3);
  const [animationType, setAnimationType] = useState<TextAnimationType>("fade");
  const [fadeIn, setFadeIn] = useState(0.3);
  const [fadeOut, setFadeOut] = useState(0.3);

  // Transform controls
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [fontSize, setFontSize] = useState(24);
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);

  // Font controls
  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontWeight, setFontWeight] = useState(400);
  const [color, setColor] = useState("#ffffff");
  const [fontSearchQuery, setFontSearchQuery] = useState("");
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const fontDropdownRef = useRef<HTMLDivElement>(null);

  // Load selected font
  useEffect(() => {
    const font = GOOGLE_FONTS.find((f) => f.name === fontFamily);
    if (font) loadGoogleFont(font.name, font.weights as unknown as number[]);
  }, [fontFamily]);

  // Close font dropdown on outside click
  useEffect(() => {
    if (!fontDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target as Node)) {
        setFontDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [fontDropdownOpen]);

  const filteredFonts = fontSearchQuery
    ? GOOGLE_FONTS.filter((f) => f.name.toLowerCase().includes(fontSearchQuery.toLowerCase()))
    : GOOGLE_FONTS;

  const selectedFontData = GOOGLE_FONTS.find((f) => f.name === fontFamily);
  const availableWeights = selectedFontData?.weights ?? [400];

  // Sync start time with playhead when dialog opens
  useEffect(() => {
    if (open) {
      setStartTime(currentTime);
    }
  }, [open, currentTime]);

  if (!open || !preset) return null;

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit(
        text.trim(),
        preset.id,
        startTime,
        duration,
        animationType,
        fadeIn,
        fadeOut,
        { scale, rotation },
        fontSize,
        { x: posX, y: posY },
        fontFamily,
        fontWeight,
        color,
      );
      // Reset
      setText("");
      setAnimationType("fade");
      setScale(1.0);
      setRotation(0);
      setFontSize(24);
      setFontFamily("Inter");
      setFontWeight(400);
      setColor("#ffffff");
      setPosX(50);
      setPosY(50);
      onOpenChange(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-white">Add Text</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Text Input */}
          <div>
            <label className="block text-sm text-neutral-400 mb-2">Text Content</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter your text..."
              className="w-full h-20 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder:text-neutral-600 resize-none focus:outline-none focus:border-cyan-500 transition-colors"
              autoFocus
            />
          </div>

          {/* Font Family */}
          <div ref={fontDropdownRef} className="relative">
            <label className="block text-sm text-neutral-400 mb-2">Font</label>
            <button
              onClick={() => setFontDropdownOpen(!fontDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white hover:border-neutral-600 transition-colors"
            >
              <span style={{ fontFamily }} className="truncate">{fontFamily}</span>
              <ChevronDown className={cn("w-4 h-4 text-neutral-400 transition-transform", fontDropdownOpen && "rotate-180")} />
            </button>
            {fontDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl overflow-hidden">
                <div className="p-2 border-b border-neutral-700">
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-neutral-900 rounded-lg">
                    <Search className="w-3.5 h-3.5 text-neutral-500" />
                    <input
                      type="text"
                      value={fontSearchQuery}
                      onChange={(e) => setFontSearchQuery(e.target.value)}
                      placeholder="Search fonts..."
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-neutral-600 focus:outline-none"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredFonts.map((font) => {
                    // Preload font on hover for instant preview
                    return (
                      <button
                        key={font.name}
                        onClick={() => {
                          setFontFamily(font.name);
                          // Reset weight if not available in new font
                          if (!font.weights.includes(fontWeight as any)) {
                            setFontWeight(font.weights.includes(400 as any) ? 400 : font.weights[0]);
                          }
                          setFontDropdownOpen(false);
                          setFontSearchQuery("");
                        }}
                        onMouseEnter={() => loadGoogleFont(font.name, font.weights as unknown as number[])}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm hover:bg-neutral-700 transition-colors",
                          fontFamily === font.name ? "bg-cyan-500/10 text-cyan-400" : "text-white"
                        )}
                        style={{ fontFamily: font.name }}
                      >
                        {font.name}
                      </button>
                    );
                  })}
                  {filteredFonts.length === 0 && (
                    <p className="px-3 py-4 text-sm text-neutral-500 text-center">No fonts found</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Font Weight & Size */}
          <div className="grid grid-cols-2 gap-3">
            {/* Weight */}
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Weight</label>
              <select
                value={fontWeight}
                onChange={(e) => setFontWeight(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors appearance-none cursor-pointer"
              >
                {availableWeights.map((w) => (
                  <option key={w} value={w}>
                    {WEIGHT_LABELS[w] || w} ({w})
                  </option>
                ))}
              </select>
            </div>

            {/* Size */}
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Size</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={12}
                  max={120}
                  step={1}
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="flex-1 h-1 accent-cyan-500 bg-neutral-700 rounded-full appearance-none cursor-pointer"
                />
                <span className="text-xs text-cyan-400 font-mono w-10 text-right">{fontSize}px</span>
              </div>
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm text-neutral-400 mb-2">Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-neutral-700 bg-neutral-800 cursor-pointer p-0.5"
              />
              <div className="flex gap-1.5">
                {["#ffffff", "#000000", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "w-7 h-7 rounded-md border-2 transition-all",
                      color === c ? "border-cyan-400 scale-110" : "border-neutral-700 hover:border-neutral-500"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Transform Controls */}
          <div className="grid grid-cols-2 gap-3">
            {/* Scale */}
            <div>
              <label className="flex items-center gap-1.5 text-sm text-neutral-400 mb-2">
                <Maximize2 className="w-3.5 h-3.5" /> Scale
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="flex-1 h-1 accent-cyan-500 bg-neutral-700 rounded-full appearance-none cursor-pointer"
                />
                <span className="text-xs text-cyan-400 font-mono w-8 text-right">{scale.toFixed(1)}x</span>
              </div>
            </div>

            {/* Rotation */}
            <div>
              <label className="flex items-center gap-1.5 text-sm text-neutral-400 mb-2">
                <RotateCw className="w-3.5 h-3.5" /> Rotation
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={rotation}
                  onChange={(e) => setRotation(parseInt(e.target.value))}
                  className="flex-1 h-1 accent-cyan-500 bg-neutral-700 rounded-full appearance-none cursor-pointer"
                />
                <span className="text-xs text-cyan-400 font-mono w-10 text-right">{rotation}&deg;</span>
              </div>
            </div>
          </div>

          {/* Position */}
          <div>
            <label className="flex items-center gap-1.5 text-sm text-neutral-400 mb-2">
              <Move className="w-3.5 h-3.5" /> Position
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 w-4">X</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={posX}
                  onChange={(e) => setPosX(parseInt(e.target.value))}
                  className="flex-1 h-1 accent-cyan-500 bg-neutral-700 rounded-full appearance-none cursor-pointer"
                />
                <span className="text-xs text-cyan-400 font-mono w-8 text-right">{posX}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 w-4">Y</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={posY}
                  onChange={(e) => setPosY(parseInt(e.target.value))}
                  className="flex-1 h-1 accent-cyan-500 bg-neutral-700 rounded-full appearance-none cursor-pointer"
                />
                <span className="text-xs text-cyan-400 font-mono w-8 text-right">{posY}%</span>
              </div>
            </div>
          </div>

          {/* Animation Type */}
          <div>
            <label className="block text-sm text-neutral-400 mb-2">Animation</label>
            <div className="grid grid-cols-4 gap-2">
              {animationPresets.map((anim) => {
                const Icon = anim.icon;
                return (
                  <button
                    key={anim.id}
                    onClick={() => setAnimationType(anim.id)}
                    className={cn(
                      "p-2 rounded-lg border flex flex-col items-center gap-1 transition-all",
                      animationType === anim.id
                        ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                        : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px]">{anim.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fade Duration */}
          {(animationType === "fade" || animationType === "scale" || animationType === "slide-up" || animationType === "slide-down") && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Fade In (s)</label>
                <input
                  type="number"
                  value={fadeIn}
                  onChange={(e) => setFadeIn(Math.max(0, Math.min(2, parseFloat(e.target.value) || 0.3)))}
                  step="0.1"
                  min="0"
                  max="2"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Fade Out (s)</label>
                <input
                  type="number"
                  value={fadeOut}
                  onChange={(e) => setFadeOut(Math.max(0, Math.min(2, parseFloat(e.target.value) || 0.3)))}
                  step="0.1"
                  min="0"
                  max="2"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Timing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Start Time (s)</label>
              <input
                type="number"
                value={startTime}
                onChange={(e) => setStartTime(Math.max(0, parseFloat(e.target.value) || 0))}
                step="0.1"
                min="0"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Duration (s)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Math.max(0.5, parseFloat(e.target.value) || 3))}
                step="0.5"
                min="0.5"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {/* Live Preview */}
          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden">
            <p className="text-xs text-neutral-500 mb-2">Preview</p>
            <div className="relative h-24 flex items-center justify-center">
              <div
                style={{
                  fontSize: `${Math.min(fontSize, 48)}px`,
                  fontFamily: `"${fontFamily}", sans-serif`,
                  fontWeight,
                  color,
                  textShadow: "0 2px 4px rgba(0,0,0,0.8)",
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                {text || "Your text here..."}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-neutral-800">
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className={cn(
              "flex-1 px-4 py-2 rounded-xl transition-colors font-medium",
              text.trim()
                ? "bg-cyan-500 hover:bg-cyan-400 text-black"
                : "bg-neutral-700 text-neutral-500 cursor-not-allowed"
            )}
          >
            Add Text
          </button>
        </div>
      </div>
    </div>
  );
}
