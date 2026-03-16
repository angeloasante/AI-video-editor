"use client";

import { useState, useCallback, useEffect, DragEvent, useRef } from "react";
import {
  PlaySquare,
  Type,
  Sparkles,
  ArrowRightLeft,
  Search,
  Filter,
  ImagePlus,
  Film,
  Music,
  Image as ImageIcon,
  Loader2,
  Upload,
  Wand2,
  Square,
  ArrowRight,
  Play,
  X,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MediaFile, uploadFile, listFiles, deleteFile } from "@/lib/supabase";
import type { TextOverlay } from "@/types/editor";

type TabType = "media" | "text" | "effects" | "transitions";

interface AssetLibraryProps {
  userId?: string;
  projectId?: string;
  onImport?: () => void;
  onFileSelect?: (file: MediaFile) => void;
  onAddToTimeline?: (item: { type: string; data: any }) => void;
  textOverlays?: TextOverlay[];
  onDeleteTextOverlay?: (id: string) => void;
  onUpdateTextOverlay?: (id: string, changes: Partial<TextOverlay>) => void;
  onDeleteMediaFile?: (file: MediaFile) => void;
  injectedFiles?: MediaFile[];
}

const tabs = [
  { id: "media" as TabType, icon: PlaySquare, label: "Media" },
  { id: "text" as TabType, icon: Type, label: "Text" },
  { id: "effects" as TabType, icon: Sparkles, label: "Effects" },
  { id: "transitions" as TabType, icon: ArrowRightLeft, label: "Transitions" },
];

// Default text preset
const defaultTextPreset = { id: "body", name: "Text", style: "Regular 24px" };

// Effects presets
const effectsPresets = [
  { id: "blur", name: "Blur", icon: Wand2 },
  { id: "glow", name: "Glow", icon: Sparkles },
  { id: "zoom", name: "Zoom In", icon: Square },
  { id: "shake", name: "Shake", icon: Wand2 },
  { id: "glitch", name: "Glitch", icon: Sparkles },
];

// Transitions presets - matches FFmpeg xfade options
const transitionsPresets = [
  // Subtle / Professional
  { id: "fade", name: "Fade", duration: "1.0s", category: "subtle" },
  { id: "fadeblack", name: "Fade Black", duration: "1.5s", category: "subtle" },
  { id: "fadewhite", name: "Fade White", duration: "1.5s", category: "subtle" },
  { id: "dissolve", name: "Dissolve", duration: "1.2s", category: "subtle" },

  // Directional Wipes
  { id: "wipeleft", name: "Wipe Left", duration: "1.0s", category: "wipe" },
  { id: "wiperight", name: "Wipe Right", duration: "1.0s", category: "wipe" },
  { id: "wipeup", name: "Wipe Up", duration: "1.0s", category: "wipe" },
  { id: "wipedown", name: "Wipe Down", duration: "1.0s", category: "wipe" },

  // Slides
  { id: "slideleft", name: "Slide Left", duration: "2.0s", category: "slide" },
  { id: "slideright", name: "Slide Right", duration: "1.0s", category: "slide" },
  { id: "slideup", name: "Slide Up", duration: "1.0s", category: "slide" },
  { id: "slidedown", name: "Slide Down", duration: "1.0s", category: "slide" },

  // Cover/Reveal
  { id: "coverleft", name: "Cover Left", duration: "1.0s", category: "cover" },
  { id: "coverright", name: "Cover Right", duration: "1.0s", category: "cover" },
  { id: "revealleft", name: "Reveal Left", duration: "1.0s", category: "cover" },
  { id: "revealright", name: "Reveal Right", duration: "1.0s", category: "cover" },

  // Dynamic / CapCut-style
  { id: "zoomin", name: "Zoom In", duration: "1.0s", category: "dynamic" },
  { id: "circleopen", name: "Circle Open", duration: "1.2s", category: "dynamic" },
  { id: "circleclose", name: "Circle Close", duration: "1.2s", category: "dynamic" },
  { id: "pixelize", name: "Pixelize", duration: "1.0s", category: "dynamic" },
  { id: "radial", name: "Radial", duration: "1.2s", category: "dynamic" },
  
  // Cinematic
  { id: "smoothleft", name: "Smooth Left", duration: "1.2s", category: "cinematic" },
  { id: "smoothright", name: "Smooth Right", duration: "1.2s", category: "cinematic" },
  { id: "diagtl", name: "Diagonal TL", duration: "1.0s", category: "cinematic" },
  { id: "diagtr", name: "Diagonal TR", duration: "1.0s", category: "cinematic" },
  { id: "squeezev", name: "Squeeze V", duration: "1.0s", category: "cinematic" },
  { id: "squeezeh", name: "Squeeze H", duration: "1.0s", category: "cinematic" },
];

function getMediaIcon(type?: string) {
  switch (type) {
    case "video":
      return Film;
    case "audio":
      return Music;
    case "image":
      return ImageIcon;
    default:
      return Film;
  }
}

function formatDuration(duration?: number): string {
  if (!duration) return "00:00";
  const mins = Math.floor(duration / 60);
  const secs = Math.floor(duration % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Lazy loading video thumbnail - only loads when in viewport
function LazyVideoThumbnail({ url, name }: { url: string; name: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "50px" }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full h-full bg-neutral-800">
      {isVisible && !hasError ? (
        <video
          src={`${url}#t=0.5`}
          className="w-full h-full object-cover"
          muted
          preload="metadata"
          playsInline
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
          <Play className="w-6 h-6 text-neutral-600" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}

export function AssetLibrary({ userId, projectId, onImport, onFileSelect, onAddToTimeline, textOverlays = [], onDeleteTextOverlay, onUpdateTextOverlay, onDeleteMediaFile, injectedFiles }: AssetLibraryProps) {
  const [activeTab, setActiveTab] = useState<TabType>("media");
  const [searchQuery, setSearchQuery] = useState("");
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Merge AI-generated files into the list
  useEffect(() => {
    if (injectedFiles && injectedFiles.length > 0) {
      setFiles((prev) => {
        const existingUrls = new Set(prev.map((f) => f.url));
        const newFiles = injectedFiles.filter((f) => !existingUrls.has(f.url));
        return newFiles.length > 0 ? [...newFiles, ...prev] : prev;
      });
    }
  }, [injectedFiles]);

  // Selected item for delete key
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<"media" | "text" | null>(null);

  // Inline editing for text overlays
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "text" | "media"; id: string; name: string } | null>(null);

  const confirmDelete = useCallback(() => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "text" && onDeleteTextOverlay) {
      onDeleteTextOverlay(deleteConfirm.id);
    } else if (deleteConfirm.type === "media" && onDeleteMediaFile) {
      const file = files.find((f) => f.name === deleteConfirm.id);
      if (file) {
        onDeleteMediaFile(file);
        setFiles((prev) => prev.filter((f) => f.name !== deleteConfirm.id));
      }
    }
    setSelectedItemId(null);
    setSelectedItemType(null);
    setDeleteConfirm(null);
  }, [deleteConfirm, onDeleteTextOverlay, onDeleteMediaFile, files]);

  // Delete key handler — shows confirmation dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedItemId || !selectedItemType) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
        e.preventDefault();
        if (selectedItemType === "text") {
          const overlay = textOverlays?.find((t) => t.id === selectedItemId);
          setDeleteConfirm({ type: "text", id: selectedItemId, name: overlay?.text || "text overlay" });
        } else if (selectedItemType === "media") {
          setDeleteConfirm({ type: "media", id: selectedItemId, name: selectedItemId });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItemId, selectedItemType, textOverlays]);

  // Transition duration popup state
  const [transitionPopup, setTransitionPopup] = useState<{
    transition: (typeof transitionsPresets)[number];
    rect: { top: number; left: number };
  } | null>(null);
  const [popupDuration, setPopupDuration] = useState(1.0);
  const popupRef = useRef<HTMLDivElement>(null);

  // Close popup on click outside
  useEffect(() => {
    if (!transitionPopup) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setTransitionPopup(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [transitionPopup]);

  // Handle file upload
  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const result = await uploadFile(file, userId, undefined, projectId);
        if (!result) continue;

        setFiles(prev => [result, ...prev]);

        // Auto-select the first uploaded file
        if (onFileSelect) {
          onFileSelect(result);
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  // Trigger native file picker
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // Handle drag start for any item
  const handleDragStart = (e: DragEvent, type: string, data: any) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ type, data }));
    e.dataTransfer.effectAllowed = "copy";
  };

  // Handle double click to add to timeline
  const handleDoubleClick = (type: string, data: any) => {
    onAddToTimeline?.({ type, data });
  };

  // Fetch files from Supabase on mount (scoped to user + project)
  useEffect(() => {
    async function fetchFiles() {
      setIsLoading(true);
      try {
        const mediaFiles = await listFiles(userId, projectId);
        setFiles(mediaFiles);
      } catch (err) {
        console.error("Error:", err);
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFiles();
  }, [userId, projectId]);

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case "media":
        return (
          <div className="grid grid-cols-2 gap-3">
            {/* Hidden file input for native picker */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,audio/*,image/*"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
            
            {/* Import Button */}
            <button
              onClick={handleImportClick}
              disabled={isUploading}
              className="aspect-video rounded-xl border border-dashed border-neutral-700 bg-neutral-900 hover:bg-neutral-800 flex flex-col items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 text-neutral-500 animate-spin" strokeWidth={1.5} />
              ) : (
                <Upload className="w-5 h-5 text-neutral-500" strokeWidth={1.5} />
              )}
              <span className="text-sm font-normal text-neutral-400">
                {isUploading ? "Uploading..." : "Import"}
              </span>
            </button>

            {/* Media Items */}
            {filteredFiles.map((file, index) => {
              const Icon = getMediaIcon(file.type);
              return (
                <div
                  key={`${file.path}-${index}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, "media", file)}
                  onDoubleClick={() => handleDoubleClick("media", file)}
                  onClick={() => {
                    onFileSelect?.(file);
                    setSelectedItemId(file.name);
                    setSelectedItemType("media");
                  }}
                  className="group cursor-grab active:cursor-grabbing"
                >
                  <div className={cn(
                    "aspect-video rounded-xl bg-neutral-900 relative overflow-hidden border transition-colors",
                    selectedItemId === file.name
                      ? "border-cyan-500 ring-1 ring-cyan-500/30"
                      : "border-neutral-800 hover:border-cyan-500/50"
                  )}>
                    {file.type === "image" ? (
                      <img
                        src={file.url}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        alt={file.name}
                        draggable={false}
                      />
                    ) : file.type === "video" ? (
                      <LazyVideoThumbnail url={file.url} name={file.name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-blue-900/30">
                        <Icon className="w-8 h-8 text-purple-400" strokeWidth={1.5} />
                      </div>
                    )}
                    {file.duration && (
                      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded text-[10px] text-white font-medium tracking-wide">
                        {formatDuration(file.duration)}
                      </div>
                    )}
                    {/* Delete button on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm({ type: "media", id: file.name, name: file.name });
                      }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-md bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all z-10"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                  <h3 className="text-[12px] font-normal text-neutral-400 mt-1.5 truncate group-hover:text-white transition-colors">
                    {file.name}
                  </h3>
                </div>
              );
            })}

            {filteredFiles.length === 0 && !isLoading && (
              <div className="col-span-2 py-8 text-center text-neutral-600 text-sm">
                No media files yet
              </div>
            )}
          </div>
        );

      case "text":
        return (
          <div className="space-y-3">
            <button
              onClick={() => handleDoubleClick("text", defaultTextPreset)}
              className="w-full p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-cyan-500/50 transition-colors text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Type className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="text-white font-medium group-hover:text-cyan-400 transition-colors">
                    Add Text
                  </div>
                  <div className="text-xs text-neutral-500">
                    Click to add text at playhead
                  </div>
                </div>
              </div>
            </button>

            {/* Existing text overlays */}
            {textOverlays.length > 0 && (
              <>
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mt-4">
                  On Timeline ({textOverlays.length})
                </h3>
                <div className="space-y-1.5">
                  {textOverlays.map((overlay) => {
                    const isEditing = editingTextId === overlay.id;
                    return (
                      <div
                        key={overlay.id}
                        onClick={() => {
                          setSelectedItemId(overlay.id);
                          setSelectedItemType("text");
                        }}
                        onDoubleClick={() => {
                          setEditingTextId(overlay.id);
                          setEditingTextValue(overlay.text);
                          setTimeout(() => editInputRef.current?.focus(), 0);
                        }}
                        className={cn(
                          "flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer group",
                          selectedItemId === overlay.id
                            ? "bg-cyan-500/10 border-cyan-500/50"
                            : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                        )}
                      >
                        <div className="w-8 h-8 rounded bg-neutral-800 flex items-center justify-center shrink-0">
                          <Type className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editingTextValue}
                              onChange={(e) => setEditingTextValue(e.target.value)}
                              onBlur={() => {
                                if (editingTextValue.trim() && onUpdateTextOverlay) {
                                  onUpdateTextOverlay(overlay.id, { text: editingTextValue.trim() });
                                }
                                setEditingTextId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if (editingTextValue.trim() && onUpdateTextOverlay) {
                                    onUpdateTextOverlay(overlay.id, { text: editingTextValue.trim() });
                                  }
                                  setEditingTextId(null);
                                } else if (e.key === "Escape") {
                                  setEditingTextId(null);
                                }
                                e.stopPropagation();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full text-xs text-white bg-neutral-800 border border-cyan-500 rounded px-1.5 py-0.5 outline-none"
                              autoFocus
                            />
                          ) : (
                            <div className="text-xs text-white truncate">{overlay.text}</div>
                          )}
                          <div className="text-[10px] text-neutral-500">
                            {overlay.startTime.toFixed(1)}s – {overlay.endTime.toFixed(1)}s
                            {overlay.fontSize ? ` · ${overlay.fontSize}px` : ""}
                            <span className="ml-1 text-neutral-600">· dbl-click to edit</span>
                          </div>
                        </div>
                        {onDeleteTextOverlay && !isEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({ type: "text", id: overlay.id, name: overlay.text || "text overlay" });
                            }}
                            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 transition-all shrink-0"
                          >
                            <X className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {textOverlays.length === 0 && (
              <p className="text-[11px] text-neutral-600 px-1">
                Customize font size, position, scale &amp; rotation in the popup.
              </p>
            )}
          </div>
        );

      case "effects":
        return (
          <div className="grid grid-cols-2 gap-3">
            {effectsPresets.map((effect) => {
              const Icon = effect.icon;
              return (
                <button
                  key={effect.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, "effect", effect)}
                  onDoubleClick={() => handleDoubleClick("effect", effect)}
                  className="aspect-square rounded-xl bg-neutral-900 border border-neutral-800 hover:border-cyan-500/50 transition-colors flex flex-col items-center justify-center gap-2 group cursor-grab active:cursor-grabbing"
                >
                  <Icon className="w-6 h-6 text-neutral-500 group-hover:text-cyan-400 transition-colors" strokeWidth={1.5} />
                  <span className="text-xs text-neutral-400 group-hover:text-white transition-colors">
                    {effect.name}
                  </span>
                </button>
              );
            })}
          </div>
        );

      case "transitions":
        // Group transitions by category
        const categories = [
          { id: "subtle", name: "Subtle" },
          { id: "wipe", name: "Wipes" },
          { id: "slide", name: "Slides" },
          { id: "cover", name: "Cover/Reveal" },
          { id: "dynamic", name: "Dynamic" },
          { id: "cinematic", name: "Cinematic" },
        ];
        return (
          <div className="space-y-4">
            {categories.map((category) => {
              const categoryTransitions = transitionsPresets.filter(
                (t) => t.category === category.id
              );
              if (categoryTransitions.length === 0) return null;
              return (
                <div key={category.id}>
                  <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                    {category.name}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {categoryTransitions.map((transition) => (
                      <button
                        key={transition.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, "transition", transition)}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setPopupDuration(parseFloat(transition.duration));
                          setTransitionPopup({
                            transition,
                            rect: { top: rect.top, left: rect.right + 8 },
                          });
                        }}
                        onDoubleClick={() => handleDoubleClick("transition", transition)}
                        className={cn(
                          "p-2 rounded-lg bg-neutral-900 border transition-colors group cursor-grab active:cursor-grabbing text-left",
                          transitionPopup?.transition.id === transition.id
                            ? "border-cyan-500"
                            : "border-neutral-800 hover:border-cyan-500/50"
                        )}
                      >
                        <div className="text-xs text-white group-hover:text-cyan-400 transition-colors truncate">
                          {transition.name}
                        </div>
                        <div className="text-[10px] text-neutral-600">{transition.duration}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
    }
  };

  return (
    <section className="w-[320px] flex-none bg-[#0d0d0f] rounded-2xl border border-neutral-800/50 flex flex-col overflow-hidden">
      {/* Tabs - stretched to fit, no horizontal scroll */}
      <div className="flex items-center px-1 pt-2 border-b border-neutral-800/50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 pb-2 pt-1 flex items-center justify-center gap-1 text-xs transition-all rounded-t-lg",
                isActive
                  ? "font-medium text-white border-b-2 border-cyan-400 bg-cyan-500/10"
                  : "font-normal text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5", isActive && "text-cyan-400")} strokeWidth={1.5} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search & Filter - only show for media tab */}
      {activeTab === "media" && (
        <div className="px-4 mt-4 flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-neutral-900 border border-neutral-800 focus:border-neutral-700 rounded-xl text-sm outline-none transition-all placeholder:text-neutral-600 text-white"
            />
          </div>
          <button className="w-9 h-9 flex items-center justify-center bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-500 hover:text-white hover:bg-neutral-800 shrink-0 transition-colors">
            <Filter className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Tab Content - vertical scroll only, hidden scrollbar */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {isLoading && activeTab === "media" ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
          </div>
        ) : (
          renderTabContent()
        )}
      </div>

      {/* Transition duration popup */}
      {transitionPopup && (
        <div
          ref={popupRef}
          className="fixed z-50 w-56 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-3"
          style={{
            top: transitionPopup.rect.top,
            left: transitionPopup.rect.left,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-white">
              {transitionPopup.transition.name}
            </span>
            <button
              onClick={() => setTransitionPopup(null)}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
            <input
              type="range"
              min={0.3}
              max={3.0}
              step={0.1}
              value={popupDuration}
              onChange={(e) => setPopupDuration(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-cyan-500 bg-neutral-700 rounded-full appearance-none cursor-pointer"
            />
            <span className="text-xs text-cyan-400 font-mono w-8 text-right">
              {popupDuration.toFixed(1)}s
            </span>
          </div>

          <button
            onClick={() => {
              onAddToTimeline?.({
                type: "transition",
                data: {
                  ...transitionPopup.transition,
                  duration: `${popupDuration}s`,
                },
              });
              setTransitionPopup(null);
            }}
            className="w-full py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors"
          >
            Apply Transition
          </button>
        </div>
      )}
      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-sm mb-2">Delete {deleteConfirm.type === "media" ? "Media File" : "Text Overlay"}?</h3>
            <p className="text-neutral-400 text-xs mb-4">
              {deleteConfirm.type === "media"
                ? `"${deleteConfirm.name}" will be permanently deleted from storage. This cannot be undone.`
                : `Text overlay "${deleteConfirm.name}" will be removed from the timeline.`}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
