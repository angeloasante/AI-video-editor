import { createSupabaseBrowser } from "./supabase/client";

// Lazy singleton — backwards-compatible with `supabase.storage.from(...)` usage
let _supabase: ReturnType<typeof createSupabaseBrowser> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createSupabaseBrowser();
  return _supabase;
}

// Proxy that auto-initializes on first property access
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseBrowser>, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string, unknown>)[prop as string];
  },
});

// Storage bucket name for media files
export const MEDIA_BUCKET = "media";

// File type based on extension
export type FileType = "video" | "image" | "audio" | "unknown";

// Media file type for the app
export interface MediaFile {
  name: string;
  url: string;
  path: string;
  type: FileType;
  duration?: number;
  /** Low-res proxy URL for preview playback (generated server-side) */
  proxyUrl?: string;
}

// Get file type from extension
export function getFileType(fileName: string): FileType {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext || "")) return "video";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) return "image";
  if (["mp3", "wav", "ogg", "m4a", "aac"].includes(ext || "")) return "audio";
  return "unknown";
}

// Sanitize filename for Supabase storage (no spaces, colons, or special chars)
function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_") // replace any non-safe char with underscore
    .replace(/_+/g, "_");              // collapse multiple underscores
}

// Upload a file to Supabase storage (scoped to user folder)
export async function uploadFile(file: File, userId?: string, path?: string, projectId?: string, opts?: { temp?: boolean }): Promise<MediaFile | null> {
  const supabase = createSupabaseBrowser();
  const fileName = path || `${Date.now()}-${sanitizeFileName(file.name)}`;
  const fullPath = userId ? `${userId}/${fileName}` : fileName;

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(fullPath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Upload error:", error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(data.path);

  const mediaFile: MediaFile = {
    name: file.name,
    url: urlData.publicUrl,
    path: data.path,
    type: getFileType(file.name),
  };

  // Record in user_media table if user is authenticated (skip for temp uploads)
  if (userId && !opts?.temp) {
    await supabase.from("user_media").insert({
      user_id: userId,
      name: file.name,
      url: urlData.publicUrl,
      path: data.path,
      type: getFileType(file.name),
      source: "upload",
      size_bytes: file.size,
      ...(projectId ? { project_id: projectId } : {}),
    });
  }

  return mediaFile;
}

// Delete a file from Supabase storage
export async function deleteFile(path: string): Promise<boolean> {
  const supabase = createSupabaseBrowser();
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .remove([path]);

  if (error) {
    console.error("Delete error:", error);
    return false;
  }

  // Remove from user_media table
  await supabase.from("user_media").delete().eq("path", path);
  return true;
}

// List files for a specific user, optionally filtered by project
export async function listFiles(folderOrUserId?: string, projectId?: string): Promise<MediaFile[]> {
  const supabase = createSupabaseBrowser();

  // Try DB first (user-scoped, project-scoped)
  if (folderOrUserId) {
    let query = supabase
      .from("user_media")
      .select("name, url, path, type")
      .eq("user_id", folderOrUserId);

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data: dbFiles } = await query
      .order("created_at", { ascending: false })
      .limit(100);

    if (dbFiles) {
      return dbFiles.map((f) => ({
        name: f.name,
        url: f.url,
        path: f.path,
        type: f.type as FileType,
      }));
    }
  }

  // Fallback: list from storage ONLY when no projectId (legacy/unscoped usage)
  if (projectId) return []; // Project-scoped — DB is the source of truth, no storage fallback

  const results: MediaFile[] = [];

  const listFolder = async (folder: string) => {
    const { data, error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .list(folder, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });
    if (error || !data) return [];
    return data
      .filter((file) => file.name !== ".emptyFolderPlaceholder" && !file.name.endsWith("/"))
      .map((file) => {
        const filePath = folder ? `${folder}/${file.name}` : file.name;
        const { data: urlData } = supabase.storage
          .from(MEDIA_BUCKET)
          .getPublicUrl(filePath);
        return {
          name: file.name,
          url: urlData.publicUrl,
          path: filePath,
          type: getFileType(file.name),
        };
      });
  };

  // List user folder
  if (folderOrUserId) {
    results.push(...await listFolder(folderOrUserId));
  }

  // Also list root-level files (legacy uploads before user-scoping)
  const rootFiles = await listFolder("");
  // Only include actual media files from root (not folder placeholders)
  const mediaExtensions = ["mp4", "webm", "mov", "avi", "mkv", "jpg", "jpeg", "png", "gif", "webp", "mp3", "wav", "ogg", "m4a"];
  for (const f of rootFiles) {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext && mediaExtensions.includes(ext)) {
      // Avoid duplicates
      if (!results.some((r) => r.name === f.name)) {
        results.push(f);
      }
    }
  }

  return results;
}

// Track an AI-generated file in user_media table (so it appears in AssetLibrary on reload)
export async function saveUserMedia(
  userId: string,
  file: { name: string; url: string; path?: string; type: string; source?: string },
  projectId?: string
) {
  const supabase = createSupabaseBrowser();
  // Normalize source to match DB check constraint (allowed: "upload", "ai_generated")
  const rawSource = file.source || "ai_generated";
  const source = rawSource.replace(/-/g, "_"); // "ai-generated" → "ai_generated", "character" stays
  const { error } = await supabase.from("user_media").insert({
    user_id: userId,
    name: file.name,
    url: file.url,
    path: file.path || "",
    type: file.type,
    source,
    ...(projectId ? { project_id: projectId } : {}),
  });
  if (error) {
    // If source constraint fails, retry with "upload" as safe fallback
    if (error.code === "23514") {
      console.warn(`[saveUserMedia] Source "${source}" rejected by DB constraint, retrying with "upload"`);
      const { error: retryErr } = await supabase.from("user_media").insert({
        user_id: userId,
        name: file.name,
        url: file.url,
        path: file.path || "",
        type: file.type,
        source: "upload",
        ...(projectId ? { project_id: projectId } : {}),
      });
      if (retryErr) console.error("[saveUserMedia] Retry also failed:", retryErr);
    } else {
      console.error("[saveUserMedia] Failed:", error);
    }
  }
}

// ============================================================
// AI Chat DB helpers
// ============================================================

export interface ChatMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: string;
  media_url?: string;
  enhanced_prompt?: string;
  request_id?: string;
  model_id?: string;
  created_at: string;
}

export async function saveChatMessage(
  userId: string,
  message: {
    role: "user" | "assistant";
    content: string;
    type?: string;
    mediaUrl?: string;
    enhancedPrompt?: string;
    requestId?: string;
    modelId?: string;
  },
  projectId?: string
) {
  const supabase = createSupabaseBrowser();
  // Guard: content is required by the DB — skip if empty
  if (!message.content) {
    console.warn("[saveChatMessage] Skipping save — content is empty/undefined", message);
    return;
  }
  const { error } = await supabase.from("ai_chat_messages").insert({
    user_id: userId,
    project_id: projectId || null,
    role: message.role,
    content: message.content,
    type: message.type || null,
    media_url: message.mediaUrl || null,
    enhanced_prompt: message.enhancedPrompt || null,
    request_id: message.requestId || null,
    model_id: message.modelId || null,
  });
  if (error) {
    console.error("[saveChatMessage] Failed to save:", error, message);
  }
}

export async function loadChatMessages(
  userId: string,
  limit = 100,
  projectId?: string
): Promise<ChatMessageRow[]> {
  const supabase = createSupabaseBrowser();
  let query = supabase
    .from("ai_chat_messages")
    .select("*")
    .eq("user_id", userId);
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  const { data } = await query
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data || []) as ChatMessageRow[]).reverse();
}

export async function updateChatMessageByRequestId(
  userId: string,
  requestId: string,
  updates: { content?: string; media_url?: string }
) {
  const supabase = createSupabaseBrowser();
  const { error } = await supabase
    .from("ai_chat_messages")
    .update(updates)
    .eq("user_id", userId)
    .eq("request_id", requestId);
  if (error) {
    console.error("[updateChatMessage] Failed to update:", error, { requestId, updates });
  }
}

export async function clearChatMessages(userId: string, projectId?: string) {
  const supabase = createSupabaseBrowser();
  let query = supabase.from("ai_chat_messages").delete().eq("user_id", userId);
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  await query;
}

/** Get a summary of chat sessions grouped by project */
export async function listChatSessions(userId: string): Promise<
  { projectId: string; projectName: string; messageCount: number; lastMessage: string; lastAt: string }[]
> {
  const supabase = createSupabaseBrowser();
  // Get distinct project_ids with their latest message
  const { data } = await supabase
    .from("ai_chat_messages")
    .select("project_id, content, created_at")
    .eq("user_id", userId)
    .not("project_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!data?.length) return [];

  // Group by project_id
  const grouped = new Map<string, { count: number; lastMsg: string; lastAt: string }>();
  for (const row of data) {
    const pid = row.project_id as string;
    if (!grouped.has(pid)) {
      grouped.set(pid, { count: 1, lastMsg: row.content, lastAt: row.created_at });
    } else {
      grouped.get(pid)!.count++;
    }
  }

  // Fetch project names
  const projectIds = Array.from(grouped.keys());
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .in("id", projectIds);

  const nameMap = new Map((projects || []).map((p) => [p.id, p.name]));

  return projectIds.map((pid) => {
    const g = grouped.get(pid)!;
    return {
      projectId: pid,
      projectName: nameMap.get(pid) || "Untitled",
      messageCount: g.count,
      lastMessage: g.lastMsg,
      lastAt: g.lastAt,
    };
  });
}

// ============================================================
// Studio State DB helpers
// ============================================================

export async function saveStudioState(
  userId: string,
  projectId: string,
  state: {
    clips: unknown[];
    textOverlays: unknown[];
    transitions: unknown[];
    selectedRatio: string;
    videoOverlays?: unknown[];
    clipEditsMap?: Record<string, unknown>;
  }
) {
  const supabase = createSupabaseBrowser();

  // Try saving with all fields first (requires video_overlays + clip_edits_map columns)
  const { error } = await supabase.from("studio_state").upsert(
    {
      project_id: projectId,
      user_id: userId,
      clips: state.clips,
      text_overlays: state.textOverlays,
      transitions: state.transitions,
      selected_ratio: state.selectedRatio,
      video_overlays: state.videoOverlays || [],
      clip_edits_map: state.clipEditsMap || {},
    },
    { onConflict: "project_id" }
  );

  // If it failed (e.g. new columns don't exist yet), fall back to saving core fields only
  if (error) {
    console.warn("[Studio] Full save failed, trying core fields:", error.message);
    const { error: fallbackError } = await supabase.from("studio_state").upsert(
      {
        project_id: projectId,
        user_id: userId,
        clips: state.clips,
        text_overlays: state.textOverlays,
        transitions: state.transitions,
        selected_ratio: state.selectedRatio,
      },
      { onConflict: "project_id" }
    );
    if (fallbackError) {
      console.error("[Studio] Save failed:", fallbackError.message);
    }
  }
}

export async function loadStudioState(projectId: string) {
  const supabase = createSupabaseBrowser();
  const { data, error } = await supabase
    .from("studio_state")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) {
    console.warn("[Studio] Failed to load studio state:", error.message);
    return null;
  }
  return data;
}

// ============================================================
// Transcriptions DB helpers
// ============================================================

export interface TranscriptionCaption {
  text: string;
  startTime: number;
  endTime: number;
}

export interface TranscriptionRecord {
  id: string;
  project_id: string;
  clip_id: string;
  source_url: string;
  full_text: string;
  language_code: string;
  captions: TranscriptionCaption[];
  created_at: string;
}

export async function saveTranscription(
  userId: string,
  projectId: string,
  clipId: string,
  sourceUrl: string,
  fullText: string,
  captions: TranscriptionCaption[],
  languageCode = "en"
): Promise<TranscriptionRecord | null> {
  const supabase = createSupabaseBrowser();
  const { data, error } = await supabase
    .from("transcriptions")
    .upsert(
      {
        project_id: projectId,
        user_id: userId,
        clip_id: clipId,
        source_url: sourceUrl,
        full_text: fullText,
        language_code: languageCode,
        captions,
      },
      { onConflict: "project_id,clip_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("[Transcription] Save failed:", error.message);
    return null;
  }
  return data as TranscriptionRecord;
}

export async function loadTranscriptions(projectId: string): Promise<TranscriptionRecord[]> {
  const supabase = createSupabaseBrowser();
  const { data, error } = await supabase
    .from("transcriptions")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[Transcription] Load failed:", error.message);
    return [];
  }
  return (data || []) as TranscriptionRecord[];
}

export async function deleteTranscription(projectId: string, clipId: string): Promise<void> {
  const supabase = createSupabaseBrowser();
  const { error } = await supabase
    .from("transcriptions")
    .delete()
    .eq("project_id", projectId)
    .eq("clip_id", clipId);

  if (error) {
    console.error("[Transcription] Delete failed:", error.message);
  }
}

// ============================================================
// Projects DB helpers
// ============================================================

export async function createProject(
  userId: string,
  name = "Untitled Project",
  options?: {
    description?: string;
    sceneContext?: {
      theme?: string;
      mood?: string;
      colorTemperature?: string;
      lightingDirection?: string;
      lightingIntensity?: string;
    };
  }
) {
  const supabase = createSupabaseBrowser();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name,
      description: options?.description || null,
    })
    .select()
    .single();
  if (error) throw error;

  // If scene context provided, create initial SceneDNA in scene_dna table
  if (options?.sceneContext && data?.id) {
    const sc = options.sceneContext;
    const initialDna = {
      theme: sc.theme || "",
      mood: sc.mood || "",
      colorPalette: [],
      lighting: {
        type: "natural",
        intensity: sc.lightingIntensity || "medium",
        direction: sc.lightingDirection || "front",
      },
      cameraWork: { shotTypes: [], movements: [] },
      characters: [],
      objects: [],
      audio: { hasDialogue: false, musicStyle: "", ambience: "" },
      timeline: [],
      editHistory: [],
      generatedAssets: [],
      characterProfiles: [],
      styleLock: { enabled: false, lockedProperties: [] },
    };
    await supabase.from("scene_dna").upsert(
      { project_id: data.id, user_id: userId, dna: initialDna },
      { onConflict: "project_id" }
    );
  }

  return data;
}

export async function deleteProject(projectId: string) {
  const supabase = createSupabaseBrowser();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}

export async function getProjectSceneDNA(projectId: string) {
  const supabase = createSupabaseBrowser();
  const { data } = await supabase
    .from("scene_dna")
    .select("dna")
    .eq("project_id", projectId)
    .single();
  return data?.dna || null;
}

export async function saveProjectSceneDNA(
  userId: string,
  projectId: string,
  dna: Record<string, unknown>
) {
  const supabase = createSupabaseBrowser();
  const { error } = await supabase.from("scene_dna").upsert(
    { project_id: projectId, user_id: userId, dna },
    { onConflict: "project_id" }
  );
  if (error) console.error("[saveProjectSceneDNA] Failed:", error);
}

export async function listProjects(userId: string) {
  const supabase = createSupabaseBrowser();
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  return data || [];
}
