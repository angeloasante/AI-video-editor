"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { createProject, listProjects, deleteProject } from "@/lib/supabase";
import GenerateSheet from "./GenerateSheet";
import {
  Plus,
  Loader2,
  Trash2,
  Film,
  LogOut,
  ChevronDown,
  Search,
  Video,
  Image as ImageIcon,
  Captions,
  MoreHorizontal,
  ChevronRight,
  MoreVertical,
  X,
  Sparkles,
} from "lucide-react";

interface ProjectRow {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
}

// Scene context presets for quick project setup
const MOOD_PRESETS = [
  "Cinematic",
  "Upbeat",
  "Dark",
  "Dreamy",
  "Energetic",
  "Calm",
  "Epic",
  "Nostalgic",
];

const THEME_PRESETS = [
  "Sci-Fi",
  "Fantasy",
  "Documentary",
  "Comedy",
  "Horror",
  "Romance",
  "Action",
  "Drama",
  "Nature",
  "Urban",
];

const LIGHTING_DIRECTIONS = ["Front", "Back", "Side", "Top", "Diffused"];
const LIGHTING_INTENSITIES = ["Low", "Medium", "High"];

// Quick action definitions
const QUICK_ACTIONS = [
  { icon: Video, label: "Video Generator", type: "video" as const, color: "blue" },
  { icon: ImageIcon, label: "AI Poster", type: "poster" as const, color: "indigo" },
  { icon: Captions, label: "Auto Captions", type: "captions" as const, color: "emerald" },
  { icon: MoreHorizontal, label: "More", type: "general" as const, color: "neutral" },
];

const ACTION_COLORS: Record<string, { bg: string; border: string; icon: string; hoverBorder: string }> = {
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", icon: "text-blue-400", hoverBorder: "hover:border-blue-500/30" },
  indigo: { bg: "bg-indigo-500/10", border: "border-indigo-500/20", icon: "text-indigo-400", hoverBorder: "hover:border-indigo-500/30" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: "text-emerald-400", hoverBorder: "hover:border-emerald-500/30" },
  neutral: { bg: "bg-white/5", border: "border-white/10", icon: "text-neutral-400", hoverBorder: "hover:border-white/20" },
};

export default function ProjectsPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Generate sheet state
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateType, setGenerateType] = useState<
    "video" | "poster" | "captions" | "general"
  >("video");

  // New project form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mood, setMood] = useState("");
  const [theme, setTheme] = useState("");
  const [lightingDirection, setLightingDirection] = useState("Front");
  const [lightingIntensity, setLightingIntensity] = useState("Medium");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load projects
  const loadProjects = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await listProjects(user.id);
      setProjects(data as ProjectRow[]);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Close menu on outside click
  useEffect(() => {
    const handleClick = () => setMenuOpenId(null);
    if (menuOpenId) {
      window.addEventListener("click", handleClick);
      return () => window.removeEventListener("click", handleClick);
    }
  }, [menuOpenId]);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
  }, [showSearch]);

  // Create project
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !name.trim()) return;

    setCreating(true);
    try {
      const project = await createProject(user.id, name.trim(), {
        description: description.trim() || undefined,
        sceneContext:
          mood || theme
            ? {
                mood: mood.toLowerCase(),
                theme: theme.toLowerCase(),
                lightingDirection: lightingDirection.toLowerCase(),
                lightingIntensity: lightingIntensity.toLowerCase(),
              }
            : undefined,
      });
      router.push(`/studio?projectId=${project.id}`);
    } catch (err) {
      console.error("Failed to create project:", err);
      setCreating(false);
    }
  };

  // Open generate sheet
  const handleQuickAction = (action: (typeof QUICK_ACTIONS)[number]) => {
    setGenerateType(action.type);
    setGenerateOpen(true);
  };

  // Delete project
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setDeletingId(null);
      setMenuOpenId(null);
    }
  };

  // Open project in studio
  const openProject = (id: string) => {
    router.push(`/studio?projectId=${id}`);
  };

  // Format date
  const formatDate = (date: string) => {
    const d = new Date(date);
    return (
      d.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "2-digit",
      }) +
      ", " +
      d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    );
  };

  // Get user's first name
  const firstName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  // Filter projects by search
  const filteredProjects = searchQuery
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : projects;

  // Recent = sorted by updated_at desc
  const recentProjects = [...filteredProjects].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#030305] flex flex-col items-center justify-center gap-4">
        <Image src="/logo.png" alt="Kluxta" width={40} height={40} className="animate-pulse" />
        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#030305] text-white relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/5 blur-[150px] rounded-full" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      {/* ─── Generate Sheet (full-screen overlay) ─── */}
      <GenerateSheet
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        userId={user.id}
        actionType={generateType}
      />

      {/* ─── Header ─── */}
      <header className="relative z-10 px-5 sm:px-8 pt-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Kluxta" width={28} height={28} />
            <span className="font-semibold text-base tracking-tight text-white hidden sm:inline">
              Kluxta
            </span>
          </div>
          <div className="h-5 w-px bg-white/10 hidden sm:block" />
          <h1 className="text-base sm:text-lg font-medium tracking-tight text-neutral-300">
            Welcome back, <span className="text-white font-semibold">{firstName}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
          >
            <Search className="w-[18px] h-[18px] text-neutral-500" />
          </button>
          {user.email && (
            <div className="hidden sm:flex items-center gap-2 px-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[11px] font-bold text-white uppercase ring-2 ring-blue-500/20">
                {user.email[0]}
              </div>
            </div>
          )}
          <button
            onClick={signOut}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
            title="Sign out"
          >
            <LogOut className="w-[18px] h-[18px] text-neutral-500" />
          </button>
        </div>
      </header>

      {/* ─── Search Bar ─── */}
      {showSearch && (
        <div className="relative z-10 px-5 sm:px-8 pb-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="relative max-w-3xl mx-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full bg-white/[0.03] border border-white/[0.08] text-white text-sm rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder-neutral-600"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowSearch(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-neutral-500 hover:text-white" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-8 py-4">
        {/* ─── Create New Project Card ─── */}
        <button
          onClick={() => {
            setName("");
            setDescription("");
            setMood("");
            setTheme("");
            setShowNewForm(!showNewForm);
          }}
          className="w-full bg-white/[0.02] border border-dashed border-white/[0.08] rounded-2xl py-8 sm:py-10 flex flex-col items-center justify-center gap-3 hover:border-blue-500/30 hover:bg-blue-500/[0.03] transition-all group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/15 flex items-center justify-center transition-all group-hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]">
            <Plus className="w-5 h-5 text-blue-400" />
          </div>
          <span className="text-sm font-medium text-neutral-400 group-hover:text-white transition-colors">
            Create New Project
          </span>
        </button>

        {/* ─── New Project Form ─── */}
        {showNewForm && (
          <form
            onSubmit={handleCreate}
            className="mt-4 bg-[#0a0a0c] border border-white/[0.06] rounded-2xl p-5 sm:p-6 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-500 ml-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Video Project"
                  className="w-full bg-white/[0.03] border border-white/[0.08] text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder-neutral-700"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-500 ml-1">
                  Description{" "}
                  <span className="text-neutral-700">(optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A short film about..."
                  className="w-full bg-white/[0.03] border border-white/[0.08] text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder-neutral-700"
                />
              </div>
            </div>

            {/* Scene Context */}
            <div>
              <label className="text-xs font-medium text-neutral-500 ml-1 mb-2 block">
                Scene Context{" "}
                <span className="text-neutral-700">
                  (sets the initial SceneDNA)
                </span>
              </label>

              <div className="mb-3">
                <span className="text-[11px] text-neutral-600 ml-1 mb-1.5 block uppercase tracking-wider">
                  Mood
                </span>
                <div className="flex flex-wrap gap-2">
                  {MOOD_PRESETS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMood(mood === m ? "" : m)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        mood === m
                          ? "bg-blue-500 text-white border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                          : "bg-white/[0.03] text-neutral-400 border-white/[0.08] hover:border-blue-500/30 hover:text-white"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <span className="text-[11px] text-neutral-600 ml-1 mb-1.5 block uppercase tracking-wider">
                  Theme
                </span>
                <div className="flex flex-wrap gap-2">
                  {THEME_PRESETS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(theme === t ? "" : t)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        theme === t
                          ? "bg-blue-500 text-white border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                          : "bg-white/[0.03] text-neutral-400 border-white/[0.08] hover:border-blue-500/30 hover:text-white"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-300 transition-colors mt-2"
              >
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${
                    showAdvanced ? "rotate-180" : ""
                  }`}
                />
                Lighting Settings
              </button>

              {showAdvanced && (
                <div className="grid grid-cols-2 gap-4 mt-3 pl-1">
                  <div>
                    <span className="text-[11px] text-neutral-600 mb-1.5 block uppercase tracking-wider">
                      Direction
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {LIGHTING_DIRECTIONS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setLightingDirection(d)}
                          className={`text-xs px-2.5 py-1 rounded border transition-all ${
                            lightingDirection === d
                              ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                              : "bg-white/[0.03] text-neutral-500 border-white/[0.06] hover:border-white/10"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-neutral-600 mb-1.5 block uppercase tracking-wider">
                      Intensity
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {LIGHTING_INTENSITIES.map((i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setLightingIntensity(i)}
                          className={`text-xs px-2.5 py-1 rounded border transition-all ${
                            lightingIntensity === i
                              ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                              : "bg-white/[0.03] text-neutral-500 border-white/[0.06] hover:border-white/10"
                          }`}
                        >
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl text-sm px-5 py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(59,130,246,0.25)]"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Create & Open Studio
              </button>
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors px-3 py-2.5"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* ─── Quick Actions ─── */}
        <div className="grid grid-cols-4 gap-3 mt-6">
          {QUICK_ACTIONS.map((action) => {
            const colors = ACTION_COLORS[action.color];
            return (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action)}
                className={`flex flex-col items-center gap-2.5 py-4 sm:py-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] ${colors.hoverBorder} hover:bg-white/[0.04] transition-all group`}
              >
                <div
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center transition-all`}
                >
                  <action.icon
                    className={`w-5 h-5 ${colors.icon} transition-colors`}
                  />
                </div>
                <span className="text-[10px] sm:text-xs text-neutral-500 group-hover:text-neutral-300 transition-colors text-center leading-tight">
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ─── Recent Projects ─── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <Film className="w-7 h-7 text-neutral-700" />
            </div>
            <p className="text-neutral-400 text-sm mb-2">No projects yet</p>
            <p className="text-neutral-600 text-xs">
              Create your first project to start building with AI.
            </p>
          </div>
        ) : (
          <section className="mt-8 pb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
                Recent Projects
              </h2>
              {recentProjects.length > 5 && (
                <button className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-0.5">
                  See More <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="space-y-1">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => openProject(project.id)}
                  className="flex items-center gap-3 sm:gap-4 py-3 px-3 -mx-3 rounded-xl cursor-pointer hover:bg-white/[0.03] transition-all group border border-transparent hover:border-white/[0.06]"
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 rounded-xl bg-[#0a0a0c] border border-white/[0.06] overflow-hidden">
                    {project.thumbnail_url ? (
                      <img
                        src={project.thumbnail_url}
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-6 h-6 text-neutral-800" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-neutral-600">
                        {formatDate(project.updated_at)}
                      </span>
                    </div>
                    {project.description && (
                      <p className="text-[11px] text-neutral-700 mt-0.5 truncate">
                        {project.description}
                      </p>
                    )}
                  </div>

                  {/* Menu */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(
                          menuOpenId === project.id ? null : project.id
                        );
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/5 transition-all sm:opacity-60"
                    >
                      <MoreVertical className="w-4 h-4 text-neutral-500" />
                    </button>

                    {menuOpenId === project.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1 w-44 bg-[#111113] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                      >
                        <button
                          onClick={() => openProject(project.id)}
                          className="w-full text-left px-4 py-2.5 text-xs text-neutral-300 hover:bg-white/5 hover:text-white transition-colors"
                        >
                          Open in Studio
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                        >
                          {deletingId === project.id ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Deleting...
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <Trash2 className="w-3 h-3" />
                              Delete Project
                            </span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
