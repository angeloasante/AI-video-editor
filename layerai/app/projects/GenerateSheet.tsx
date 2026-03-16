"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/lib/supabase";
import { aiApi, generateApi } from "@/lib/api";
import {
  X,
  Clock,
  ChevronDown,
  ImagePlus,
  Sparkles,
  Loader2,
  Wand2,
  Film,
  Image as ImageIcon,
  Captions,
  Check,
} from "lucide-react";

type QuickActionType = "video" | "poster" | "captions" | "general";

interface GenerateSheetProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  actionType: QuickActionType;
}

const MODELS = [
  { id: "kling-1.6", label: "Kling 1.6" },
  { id: "kling-3.0", label: "Kling 3.0" },
  { id: "veo-3", label: "Veo 3" },
];

const DURATIONS = [
  { value: 5, label: "5s" },
  { value: 10, label: "10s" },
];

const RATIOS = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
];

const ACTION_CONFIG: Record<
  QuickActionType,
  { title: string; accent: string; placeholder: string; defaultModel: string }
> = {
  video: {
    title: "Generate AI",
    accent: "Video Generator",
    placeholder:
      "Describe your video scene... e.g. A cinematic drone shot over a neon-lit Tokyo street at night with rain reflections on the pavement",
    defaultModel: "kling-3.0",
  },
  poster: {
    title: "Generate AI",
    accent: "AI Poster",
    placeholder:
      "Describe your poster... e.g. A bold movie poster with a mysterious figure silhouetted against a sunset skyline",
    defaultModel: "kling-3.0",
  },
  captions: {
    title: "Generate AI",
    accent: "Auto Captions",
    placeholder:
      "Describe a video to generate with captions... e.g. A narrator explaining how coffee is made, with subtitles",
    defaultModel: "kling-3.0",
  },
  general: {
    title: "Generate AI",
    accent: "Generate AI",
    placeholder:
      "Describe what you want to create... e.g. Create a high-energy sports video with a vibrant and dynamic atmosphere",
    defaultModel: "kling-3.0",
  },
};

export default function GenerateSheet({
  open,
  onClose,
  userId,
  actionType,
}: GenerateSheetProps) {
  const router = useRouter();
  const config = ACTION_CONFIG[actionType];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [model, setModel] = useState(config.defaultModel);
  const [duration, setDuration] = useState(10);
  const [ratio, setRatio] = useState("16:9");
  const [prompt, setPrompt] = useState("");
  const [referenceImages, setReferenceImages] = useState<
    { file: File; preview: string }[]
  >([]);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Reset form when action type changes
  useEffect(() => {
    const cfg = ACTION_CONFIG[actionType];
    setModel(cfg.defaultModel);
    setPrompt("");
    setReferenceImages([]);
    setStatus("");
    setGenerating(false);
  }, [actionType]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const handler = () => setOpenDropdown(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [openDropdown]);

  const handleAddImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setReferenceImages((prev) => [...prev, ...newImages].slice(0, 4));
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setReferenceImages((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return;

    setGenerating(true);
    setStatus("Creating project...");

    try {
      // 1. Create project with a generated name
      const projectName =
        prompt.trim().slice(0, 40) + (prompt.length > 40 ? "..." : "");
      const project = await createProject(userId, projectName, {
        description: prompt.trim().slice(0, 120),
        sceneContext: {
          mood: "cinematic",
          theme: actionType === "poster" ? "drama" : "cinematic",
          lightingDirection: "front",
          lightingIntensity: "medium",
        },
      });

      // 2. Send to AI chat for generation
      setStatus("Generating with AI...");

      const modePrefix =
        actionType === "poster"
          ? "Generate an image: "
          : actionType === "captions"
            ? "Generate a video with captions: "
            : "Generate a video: ";

      const chatResult = await aiApi.chat({
        message: modePrefix + prompt.trim(),
        projectId: project.id,
        aspectRatio: ratio,
        model,
      });

      // 3. If we get a requestId, poll for completion
      if (chatResult.requestId && chatResult.modelId) {
        setStatus("Processing...");
        let attempts = 0;
        const maxAttempts = 120; // 4 minutes max

        while (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 2000));
          attempts++;

          try {
            const statusResult = await aiApi.getStatus(
              chatResult.requestId,
              chatResult.modelId,
              chatResult.type === "image" ? "image" : "video",
              project.id
            );

            if (statusResult.status === "completed" && statusResult.result?.url) {
              setStatus("Done! Opening studio...");
              // Navigate to studio — the video is already saved to the project
              router.push(`/studio?projectId=${project.id}`);
              return;
            }
            if (statusResult.status === "failed") {
              setStatus("Generation failed. Redirecting to studio...");
              setTimeout(() => router.push(`/studio?projectId=${project.id}`), 1500);
              return;
            }

            // Update status with progress hint
            const progressHints = [
              "AI is thinking...",
              "Generating frames...",
              "Composing scene...",
              "Rendering video...",
              "Almost there...",
            ];
            setStatus(progressHints[Math.min(Math.floor(attempts / 6), progressHints.length - 1)]);
          } catch {
            // Polling error — continue trying
          }
        }

        // Timeout — still send them to the studio
        setStatus("Taking longer than expected. Opening studio...");
        setTimeout(() => router.push(`/studio?projectId=${project.id}`), 1000);
      } else {
        // No requestId (maybe it was a text response or instant result)
        setStatus("Opening studio...");
        router.push(`/studio?projectId=${project.id}`);
      }
    } catch (err) {
      console.error("Generation error:", err);
      setStatus("Something went wrong. Please try again.");
      setGenerating(false);
    }
  }, [prompt, generating, userId, actionType, ratio, model, router]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-5 pb-2">
        <button
          onClick={onClose}
          disabled={generating}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-900 hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-900 hover:bg-zinc-800 transition-colors">
          <Clock className="w-4 h-4 text-zinc-400" />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 pb-28">
        <div className="max-w-lg mx-auto">
          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold mt-6 mb-8 leading-tight">
            Bring your ideas to life with{" "}
            <span className="text-cyan-400">{config.accent}</span>
          </h1>

          {/* Selector pills */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {/* Model selector */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(openDropdown === "model" ? null : "model");
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:border-zinc-600 transition-all"
              >
                <Film className="w-3.5 h-3.5 text-zinc-500" />
                {MODELS.find((m) => m.id === model)?.label}
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              </button>
              {openDropdown === "model" && (
                <div className="absolute top-full mt-1 left-0 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setModel(m.id);
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between ${
                        model === m.id
                          ? "text-white bg-zinc-800"
                          : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                      }`}
                    >
                      {m.label}
                      {model === m.id && <Check className="w-3 h-3 text-cyan-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Duration selector */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(openDropdown === "duration" ? null : "duration");
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:border-zinc-600 transition-all"
              >
                <Wand2 className="w-3.5 h-3.5 text-zinc-500" />
                {duration}s
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              </button>
              {openDropdown === "duration" && (
                <div className="absolute top-full mt-1 left-0 w-28 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => {
                        setDuration(d.value);
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between ${
                        duration === d.value
                          ? "text-white bg-zinc-800"
                          : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                      }`}
                    >
                      {d.label}
                      {duration === d.value && <Check className="w-3 h-3 text-cyan-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Aspect ratio selector */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(openDropdown === "ratio" ? null : "ratio");
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:border-zinc-600 transition-all"
              >
                <Wand2 className="w-3.5 h-3.5 text-zinc-500" />
                {ratio}
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              </button>
              {openDropdown === "ratio" && (
                <div className="absolute top-full mt-1 left-0 w-28 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  {RATIOS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => {
                        setRatio(r.value);
                        setOpenDropdown(null);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between ${
                        ratio === r.value
                          ? "text-white bg-zinc-800"
                          : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                      }`}
                    >
                      {r.label}
                      {ratio === r.value && <Check className="w-3 h-3 text-cyan-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Prompt card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {/* Reference images */}
            {referenceImages.length > 0 && (
              <div className="flex items-center gap-2 px-4 pt-4">
                {referenceImages.map((img, i) => (
                  <div key={i} className="relative w-16 h-16 flex-shrink-0">
                    <img
                      src={img.preview}
                      alt=""
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-700 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                {referenceImages.length < 4 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-16 flex-shrink-0 rounded-lg border border-dashed border-zinc-700 flex items-center justify-center hover:border-zinc-500 transition-colors"
                  >
                    <ImagePlus className="w-5 h-5 text-zinc-600" />
                  </button>
                )}
              </div>
            )}

            {/* Textarea */}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={config.placeholder}
              disabled={generating}
              rows={4}
              className="w-full bg-transparent text-sm text-white px-4 py-4 focus:outline-none placeholder-zinc-600 resize-none disabled:opacity-50"
            />

            {/* Bottom bar */}
            <div className="flex items-center justify-between px-4 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={generating}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-800 transition-colors disabled:opacity-50"
                  title="Add reference image"
                >
                  <ImagePlus className="w-4 h-4 text-zinc-500" />
                </button>
                <button
                  disabled={generating}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-zinc-800 transition-colors disabled:opacity-50"
                  title="Style transfer"
                >
                  <Wand2 className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
              {generating && (
                <span className="text-xs text-cyan-400">{status}</span>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleAddImage}
            className="hidden"
          />
        </div>
      </div>

      {/* Generate button — fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black via-black/95 to-transparent">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-white text-black hover:bg-zinc-200 active:scale-[0.98]"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {status || "Generating..."}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
