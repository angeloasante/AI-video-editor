"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Sparkles, CheckCircle2, Volume2, Plus, MessageSquare, X, ChevronDown, ImagePlus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { aiApi, type TimelineClipInfo, type TaggedAsset, type CharacterData } from "@/lib/api";
import { saveChatMessage, loadChatMessages, updateChatMessageByRequestId, clearChatMessages, listChatSessions, saveUserMedia, uploadFile as uploadFileToSupabase } from "@/lib/supabase";
import type { TextOverlay } from "@/types/editor";

export type AspectRatio = "4:5" | "1:1" | "9:16" | "16:9" | "4:3";

interface SavedCharacter {
  name: string;
  description: string;
  imageUrl: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  type?: "video" | "image" | "text" | "edit_text" | "add_text" | "delete_text" | "audio" | "element_edit" | "character";
  mediaUrl?: string;
  audioUrl?: string;
  enhancedPrompt?: string;
  referenceImageUrl?: string;
  requestId?: string;
  modelId?: string;
  polling?: boolean;
  character?: CharacterData;
}

type SavedMessage = Omit<ChatMessage, "polling">;

const STORAGE_KEY = "layerai-ai-chat";

const VIDEO_MODELS = [
  { key: "kling-3.0", label: "Kling 3.0", provider: "Kuaishou" },
  { key: "kling-1.6", label: "Kling 1.6", provider: "Kuaishou" },
  { key: "seedance-1.5", label: "Seedance 1.5", provider: "ByteDance" },
  { key: "seedance-1.0", label: "Seedance 1.0", provider: "ByteDance" },
  { key: "veo-3", label: "Veo 3", provider: "Google" },
  { key: "hailuo-02", label: "Hailuo 02", provider: "MiniMax" },
  { key: "minimax-video-01", label: "MiniMax Video 01", provider: "MiniMax" },
  { key: "wan-pro", label: "Wan Pro", provider: "Alibaba" },
  { key: "wan-2.1", label: "Wan 2.1", provider: "Alibaba" },
  { key: "ltx-2.3", label: "LTX 2.3", provider: "Lightricks" },
  { key: "hunyuan-1.5", label: "Hunyuan 1.5", provider: "Tencent" },
  { key: "luma-ray", label: "Luma Ray", provider: "Luma AI" },
] as const;

const STATUS_PHASES = [
  "Sending your prompt to the AI model...",
  "Gemini is enhancing your description...",
  "Adding cinematic details and visual style...",
  "Submitting to AI model for generation...",
  "AI model is rendering your video...",
  "Composing frames and adding motion...",
  "Refining visual details and lighting...",
  "Finalizing the output...",
  "Almost there, polishing the result...",
];

interface AIPanelProps {
  userId?: string;
  projectId?: string;
  selectedRatio?: AspectRatio;
  selectedClipUrl?: string;
  timelineClips?: TimelineClipInfo[];
  onMediaGenerated?: (result: { type: "video" | "image"; url: string; name: string; path: string }) => void;
  onAudioGenerated?: (result: { url: string; name: string; audioType: "sfx" | "tts" }) => void;
  onSoundsLoaded?: (sounds: { url: string; name: string; audioType: "sfx" | "tts" }[]) => void;
  onMediaLoaded?: (media: { type: "video" | "image"; url: string; name: string }[]) => void;
  onCharacterCreated?: (character: { name: string; description: string; imageUrl: string }) => void;
  savedCharacters?: SavedCharacter[];
  savedMedia?: { name: string; url: string; type: string }[];
  width?: number;
  textOverlays?: TextOverlay[];
  onUpdateTextOverlay?: (id: string, changes: Partial<TextOverlay>) => void;
  onDeleteTextOverlay?: (id: string) => void;
  onAddTextOverlay?: (text: string, startTime: number, endTime: number) => void;
}

export function AIPanel({
  userId,
  projectId,
  selectedRatio = "16:9",
  selectedClipUrl,
  timelineClips,
  onMediaGenerated,
  onAudioGenerated,
  onSoundsLoaded,
  onMediaLoaded,
  onCharacterCreated,
  savedCharacters = [],
  savedMedia = [],
  width,
  textOverlays = [],
  onUpdateTextOverlay,
  onDeleteTextOverlay,
  onAddTextOverlay,
}: AIPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showPastChats, setShowPastChats] = useState(false);
  const [pastChats, setPastChats] = useState<
    { projectId: string; projectName: string; messageCount: number; lastMessage: string; lastAt: string }[]
  >([]);
  const [pastChatsLoading, setPastChatsLoading] = useState(false);
  const [modKey, setModKey] = useState("Ctrl");

  // Detect platform modifier key on client
  useEffect(() => {
    if (/Mac|iPhone|iPad|iPod/.test(navigator.userAgent)) {
      setModKey("Cmd");
    }
  }, []);

  // Load messages from DB (or localStorage fallback for unauthenticated)
  // Resume polling for any in-flight generation jobs
  useEffect(() => {
    const resumePolling = (loaded: ChatMessage[]) => {
      loaded.forEach((msg, i) => {
        const isGenType = msg.type === "video" || msg.type === "image";
        if (isGenType && msg.requestId && msg.modelId && !msg.mediaUrl) {
          // This message was still generating when the user left — resume polling
          const updatedMessages = [...loaded];
          updatedMessages[i] = { ...msg, polling: true };
          setMessages(updatedMessages);
          startPolling(i, msg.requestId, msg.modelId, msg.type as "video" | "image");
        }
      });
    };

    if (userId) {
      loadChatMessages(userId, 100, projectId).then((rows) => {
        if (rows.length > 0) {
          const loaded = rows.map((r) => ({
            role: r.role,
            content: r.content,
            type: (r.type as ChatMessage["type"]) || undefined,
            mediaUrl: r.type !== "audio" ? (r.media_url || undefined) : undefined,
            audioUrl: r.type === "audio" ? (r.media_url || undefined) : undefined,
            enhancedPrompt: r.enhanced_prompt || undefined,
            requestId: r.request_id || undefined,
            modelId: r.model_id || undefined,
            polling: false,
          }));
          setMessages(loaded);
          lastSavedCountRef.current = loaded.length;
          resumePolling(loaded);

          // Restore sound files from persisted audio messages
          const audioMessages = loaded.filter((m) => m.type === "audio" && m.audioUrl);
          if (audioMessages.length > 0 && onSoundsLoaded) {
            onSoundsLoaded(
              audioMessages.map((m) => {
                const isTTS = m.content?.toLowerCase().match(/voice|say|narrat|voiceover|speak/);
                return {
                  url: m.audioUrl!,
                  name: m.content?.slice(0, 50) || "AI Sound",
                  audioType: isTTS ? "tts" as const : "sfx" as const,
                };
              })
            );
          }

          // Restore AI-generated videos/images from persisted messages
          const mediaMessages = loaded.filter(
            (m) => (m.type === "video" || m.type === "image") && m.mediaUrl
          );
          if (mediaMessages.length > 0 && onMediaLoaded) {
            onMediaLoaded(
              mediaMessages.map((m) => ({
                type: m.type as "video" | "image",
                url: m.mediaUrl!,
                name: m.content?.slice(0, 50) || `AI ${m.type}`,
              }))
            );
          }
        }
      });
    } else {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed: SavedMessage[] = JSON.parse(saved);
          const loaded = parsed.map((m) => ({ ...m, polling: false }));
          setMessages(loaded);
          lastSavedCountRef.current = loaded.length;
          resumePolling(loaded);
        }
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, projectId]);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("kling-3.0");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusPhase, setStatusPhase] = useState(0);
  const [attachedImages, setAttachedImages] = useState<{ file: File; preview: string }[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const completedRef = useRef<Set<string>>(new Set());
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Persist new messages — save to DB if authenticated, localStorage fallback
  const lastSavedCountRef = useRef(0);
  useEffect(() => {
    if (messages.length <= lastSavedCountRef.current) return;

    const newMessages = messages.slice(lastSavedCountRef.current);
    lastSavedCountRef.current = messages.length;

    if (userId) {
      for (const msg of newMessages) {
        // Audio messages are saved explicitly in handleSend — skip to avoid duplicates
        if (msg.type === "audio" && msg.audioUrl) continue;
        saveChatMessage(userId, {
          role: msg.role,
          content: msg.content,
          type: msg.type,
          mediaUrl: msg.mediaUrl || msg.audioUrl,
          enhancedPrompt: msg.enhancedPrompt,
          requestId: msg.requestId,
          modelId: msg.modelId,
        }, projectId);
      }
    } else {
      try {
        const toSave: SavedMessage[] = messages.map(({ polling: _, ...rest }) => rest);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch {}
    }
  }, [messages, userId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, statusPhase]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pollingRef.current.forEach((timer) => clearInterval(timer));
      if (statusTimerRef.current) clearInterval(statusTimerRef.current);
    };
  }, []);

  const startStatusCycling = useCallback(() => {
    setStatusPhase(0);
    statusTimerRef.current = setInterval(() => {
      setStatusPhase((prev) => Math.min(prev + 1, STATUS_PHASES.length - 1));
    }, 4000);
  }, []);

  const stopStatusCycling = useCallback(() => {
    if (statusTimerRef.current) {
      clearInterval(statusTimerRef.current);
      statusTimerRef.current = null;
    }
  }, []);

  const hasPolling = messages.some((m) => m.polling);

  const startPolling = useCallback((msgIndex: number, requestId: string, modelId: string, type: "video" | "image") => {
    startStatusCycling();

    const timer = setInterval(async () => {
      try {
        const status = await aiApi.getStatus(requestId, modelId, type, projectId);

        if (status.status === "completed" && status.result?.url) {
          // Guard against duplicate completions from overlapping interval ticks
          if (completedRef.current.has(requestId)) return;
          completedRef.current.add(requestId);

          clearInterval(timer);
          pollingRef.current.delete(msgIndex);
          stopStatusCycling();

          const url = status.result.url;
          const name = status.result.name || `AI Generated ${type}`;
          const path = status.result.path || "";

          setMessages((prev) => {
            const updated = prev.map((m, i) =>
              i === msgIndex
                ? { ...m, mediaUrl: url, polling: false, content: m.content.replace(/Generating\.\.\./, "Done!") }
                : m
            );
            // Update the existing DB record with the completed media URL
            if (userId && requestId) {
              const completed = updated[msgIndex];
              updateChatMessageByRequestId(userId, requestId, {
                content: completed?.content,
                media_url: url,
              });
            }
            return updated;
          });

          onMediaGenerated?.({ type, url, name, path });
        }
      } catch {
        // Keep polling on transient errors
      }
    }, 5000);

    pollingRef.current.set(msgIndex, timer);
  }, [onMediaGenerated, startStatusCycling, stopStatusCycling, userId, projectId]);

  // Execute text edit locally — find overlay by search text, apply changes
  const executeTextEdit = useCallback((searchText: string, newText: string): string | null => {
    const search = searchText.toLowerCase();
    const match = textOverlays.find((t) => t.text.toLowerCase().includes(search));
    if (!match || !onUpdateTextOverlay) return null;

    const updatedText = match.text.replace(
      new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      newText
    );
    onUpdateTextOverlay(match.id, { text: updatedText });
    return match.id;
  }, [textOverlays, onUpdateTextOverlay]);

  // Execute text delete locally
  const executeTextDelete = useCallback((searchText: string): string | null => {
    const search = searchText.toLowerCase();
    const match = textOverlays.find((t) => t.text.toLowerCase().includes(search));
    if (!match || !onDeleteTextOverlay) return null;

    onDeleteTextOverlay(match.id);
    return match.id;
  }, [textOverlays, onDeleteTextOverlay]);

  // Image upload handler
  const handleImageUpload = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    const newImages = imageFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setAttachedImages(prev => [...prev, ...newImages]);
  }, []);

  const removeAttachedImage = useCallback((index: number) => {
    setAttachedImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  // Paste handler for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        handleImageUpload(imageFiles);
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleImageUpload]);

  // @ mention input handler
  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    // Detect @ mentions — allow word chars + dots, colons, hyphens (filenames)
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const textBefore = value.slice(0, cursorPos);
    const atMatch = textBefore.match(/@([\w.:\-]*)$/);
    if (atMatch) {
      // Filter using just the word-char portion for broader matching
      setMentionFilter(atMatch[1].toLowerCase().replace(/[^a-z0-9_]/g, "_"));
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  }, []);

  // Get filterable assets for @ mentions (characters + media)
  const mentionableAssets = useCallback(() => {
    const assets: { name: string; url: string; type: "character" | "image" | "video" }[] = [];
    // Add saved characters
    for (const char of savedCharacters) {
      assets.push({ name: char.name, url: char.imageUrl, type: "character" });
    }
    // Add saved media (asset library images + videos)
    const addedUrls = new Set<string>();
    for (const char of savedCharacters) addedUrls.add(char.imageUrl);
    for (const media of savedMedia) {
      if (!addedUrls.has(media.url)) {
        addedUrls.add(media.url);
        assets.push({
          name: media.name.replace(/\.[^.]+$/, "").replace(/\s+/g, "_"),
          url: media.url,
          type: media.type === "image" ? "image" : "video",
        });
      }
    }
    // Add timeline clips
    if (timelineClips) {
      for (const clip of timelineClips) {
        if (clip.name && !addedUrls.has(clip.url)) {
          addedUrls.add(clip.url);
          assets.push({
            name: clip.name.replace(/\.[^.]+$/, "").replace(/\s+/g, "_"),
            url: clip.url,
            type: clip.type === "image" ? "image" : "video",
          });
        }
      }
    }
    return assets.filter(a =>
      !mentionFilter || a.name.toLowerCase().replace(/[^a-z0-9_]/g, "_").includes(mentionFilter)
    );
  }, [savedCharacters, savedMedia, timelineClips, mentionFilter]);

  // Insert @ mention
  const insertMention = useCallback((assetName: string) => {
    const cursorPos = textareaRef.current?.selectionStart || input.length;
    const textBefore = input.slice(0, cursorPos);
    const textAfter = input.slice(cursorPos);
    const replaced = textBefore.replace(/@[\w.:\-]*$/, `@${assetName} `);
    setInput(replaced + textAfter);
    setShowMentions(false);
    setMentionFilter(""); // Reset filter so parseTaggedAssets gets full list
    textareaRef.current?.focus();
  }, [input]);

  // Build the UNFILTERED asset list for matching at send time
  const allMentionableAssets = useCallback(() => {
    const assets: { name: string; url: string; type: "character" | "image" | "video" }[] = [];
    for (const char of savedCharacters) {
      assets.push({ name: char.name, url: char.imageUrl, type: "character" });
    }
    const addedUrls = new Set<string>();
    for (const char of savedCharacters) addedUrls.add(char.imageUrl);
    for (const media of savedMedia) {
      if (!addedUrls.has(media.url)) {
        addedUrls.add(media.url);
        assets.push({
          name: media.name.replace(/\.[^.]+$/, "").replace(/\s+/g, "_"),
          url: media.url,
          type: media.type === "image" ? "image" : "video",
        });
      }
    }
    if (timelineClips) {
      for (const clip of timelineClips) {
        if (clip.name && !addedUrls.has(clip.url)) {
          addedUrls.add(clip.url);
          assets.push({
            name: clip.name.replace(/\.[^.]+$/, "").replace(/\s+/g, "_"),
            url: clip.url,
            type: clip.type === "image" ? "image" : "video",
          });
        }
      }
    }
    return assets;
  }, [savedCharacters, savedMedia, timelineClips]);

  // Normalize asset names for comparison — colons, dots, hyphens, spaces all become underscores
  const normalizeName = useCallback((n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_"), []);

  // Parse @ mentions from input text into tagged assets
  const parseTaggedAssets = useCallback((text: string): TaggedAsset[] => {
    // Match @mentions — capture word chars plus dots, hyphens, colons (filenames)
    const mentions = text.match(/@[\w.:\-]+/g) || [];
    const assets: TaggedAsset[] = [];
    // Use UNFILTERED asset list (not affected by mentionFilter state)
    const allAssets = allMentionableAssets();
    console.log("[AIPanel] parseTaggedAssets:", { mentions, availableAssets: allAssets.map(a => a.name) });
    for (const mention of mentions) {
      const rawName = mention.slice(1).replace(/\.\w+$/, ""); // Remove @ prefix and file extension
      const normalized = normalizeName(rawName);
      // Try exact match first, then normalized match, then partial match
      const match = allAssets.find(a => a.name.toLowerCase() === rawName.toLowerCase())
        || allAssets.find(a => normalizeName(a.name) === normalized)
        || allAssets.find(a => normalizeName(a.name).includes(normalized) || normalized.includes(normalizeName(a.name)));
      if (match && !assets.some(a => a.url === match.url)) {
        console.log(`[AIPanel] Matched @mention "${mention}" → asset "${match.name}" (${match.type})`);
        assets.push(match);
      } else if (!match) {
        console.warn(`[AIPanel] No match for @mention "${mention}" (normalized: "${normalized}") — available: ${allAssets.map(a => `${a.name} [${normalizeName(a.name)}]`).join(", ")}`);
      }
    }
    return assets;
  }, [allMentionableAssets, normalizeName]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    // Upload attached images to Supabase and collect URLs
    let imageUrls: string[] = [];
    if (attachedImages.length > 0) {
      for (const img of attachedImages) {
        try {
          const result = await uploadFileToSupabase(img.file, userId, undefined, projectId, { temp: true });
          if (result?.url) imageUrls.push(result.url);
        } catch {
          // Fallback: use preview URL (data URL won't work for backend, but at least don't block)
          console.warn("[AIPanel] Failed to upload image, skipping");
        }
      }
      // Clear attached images
      attachedImages.forEach(img => URL.revokeObjectURL(img.preview));
      setAttachedImages([]);
    }

    // Parse @ mentions
    const taggedAssets = parseTaggedAssets(trimmed);
    console.log("[AIPanel] handleSend:", {
      message: trimmed.slice(0, 100),
      taggedAssets: taggedAssets.map(a => ({ name: a.name, type: a.type, url: a.url.slice(0, 80) })),
      imageUrls: imageUrls.map(u => u.slice(0, 80)),
    });

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => m.content)
        .map((m) => ({ role: m.role, content: m.content }));

      const result = await aiApi.chat({
        message: trimmed,
        history,
        projectId,
        aspectRatio: selectedRatio,
        model: selectedModel,
        existingVideoUrl: selectedClipUrl,
        timelineClips: timelineClips && timelineClips.length > 0 ? timelineClips : undefined,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        taggedAssets: taggedAssets.length > 0 ? taggedAssets : undefined,
      });

      if (result.type === "edit_text" && result.editParams) {
        const { searchText, newText } = result.editParams;
        if (searchText && newText) {
          const matchedId = executeTextEdit(searchText, newText);
          const msg = matchedId
            ? result.message
            : `I couldn't find text containing "${searchText}" on your timeline. Make sure you have a text overlay with that content.`;
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: msg, type: "edit_text" },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: result.message, type: "text" },
          ]);
        }
      } else if (result.type === "add_text" && result.editParams) {
        const { text, startTime = 0, endTime = 5 } = result.editParams;
        if (text && onAddTextOverlay) {
          onAddTextOverlay(text, startTime, endTime);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: result.message, type: "add_text" },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: result.message, type: "text" },
          ]);
        }
      } else if (result.type === "delete_text" && result.editParams) {
        const { searchText } = result.editParams;
        if (searchText) {
          const matchedId = executeTextDelete(searchText);
          const msg = matchedId
            ? result.message
            : `I couldn't find text containing "${searchText}" on your timeline.`;
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: msg, type: "delete_text" },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: result.message, type: "text" },
          ]);
        }
      } else if (result.type === "audio" && result.audioUrl) {
        const audioMsg: ChatMessage = {
          role: "assistant",
          content: result.message,
          type: "audio",
          audioUrl: result.audioUrl,
        };
        setMessages((prev) => [...prev, audioMsg]);

        // Explicitly save audio message to DB (don't rely on effect alone)
        if (userId) {
          saveChatMessage(userId, {
            role: audioMsg.role,
            content: audioMsg.content,
            type: audioMsg.type,
            mediaUrl: audioMsg.audioUrl,
          }, projectId).catch((err) => console.error("[AIPanel] Failed to save audio message:", err));
        }

        // Determine if SFX or TTS from the message content
        const isTTS = trimmed.toLowerCase().match(/voice|say|narrat|voiceover|speak/);
        const audioType = isTTS ? "tts" : "sfx";
        const audioName = `AI ${audioType === "tts" ? "Voice" : "Sound"} - ${trimmed.slice(0, 40)}`;
        onAudioGenerated?.({ url: result.audioUrl, name: audioName, audioType });
      } else if (result.type === "character" && result.character) {
        // Character reference sheet created
        const char = result.character;
        const charMsg: ChatMessage = {
          role: "assistant",
          content: result.message,
          type: "character",
          character: char,
        };
        setMessages((prev) => [...prev, charMsg]);

        // Save character (asset library + DB only, NOT timeline)
        if (char.images.length > 0) {
          onCharacterCreated?.({
            name: char.name,
            description: char.description,
            imageUrl: char.images[0],
          });
        }
      } else if (result.type === "element_edit" && result.elementEdit) {
        // SAM2 element edit — show segmentation result + modified element image
        const edit = result.elementEdit;
        let editContent = result.message;
        if (edit.modifiedElementImageUrl) {
          editContent += `\nModified "${edit.target}" → ${edit.modification}`;
        }
        // Show the result video if available, otherwise the masked video
        const displayVideoUrl = edit.resultVideoUrl || edit.maskedVideoUrl;
        const editMsg: ChatMessage = {
          role: "assistant",
          content: editContent,
          type: "text",
          referenceImageUrl: edit.modifiedElementImageUrl,
          mediaUrl: displayVideoUrl,
        };
        setMessages((prev) => [...prev, editMsg]);

        // Add the result video to the timeline (auto-add after element edit)
        if (edit.resultVideoUrl) {
          onMediaGenerated?.({
            type: "video",
            url: edit.resultVideoUrl,
            name: `Edited ${edit.target} - ${edit.modification.slice(0, 20)}`,
            path: "",
          });
        } else if (edit.maskedVideoUrl) {
          // Fallback: add masked video if recomposite isn't ready yet
          onMediaGenerated?.({
            type: "video",
            url: edit.maskedVideoUrl,
            name: `SAM2 Mask - ${edit.target}`,
            path: "",
          });
        }
        if (edit.modifiedElementImageUrl) {
          onMediaGenerated?.({
            type: "image",
            url: edit.modifiedElementImageUrl,
            name: `Reference - ${edit.target} ${edit.modification.slice(0, 15)}`,
            path: "",
          });
        }
      } else if (result.type === "text") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: result.message, type: "text" },
        ]);
      } else {
        const content = result.referenceImageUrl
          ? `${result.message} I created a reference image for visual consistency and am now animating it... Generating...`
          : `${result.message} Generating...`;
        const newMsg: ChatMessage = {
          role: "assistant",
          content,
          type: result.type as ChatMessage["type"],
          enhancedPrompt: result.enhancedPrompt,
          referenceImageUrl: result.referenceImageUrl,
          requestId: result.requestId,
          modelId: result.modelId,
          polling: true,
        };

        setMessages((prev) => {
          const updated = [...prev, newMsg];
          const msgIndex = updated.length - 1;
          if (result.requestId && result.modelId) {
            startPolling(msgIndex, result.requestId, result.modelId, result.type as "video" | "image");
          }
          return updated;
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${errorMsg}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, selectedRatio, selectedModel, selectedClipUrl, timelineClips, startPolling, executeTextEdit, executeTextDelete, onAddTextOverlay, onAudioGenerated, onMediaGenerated, onCharacterCreated, attachedImages, userId, projectId, parseTaggedAssets]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  // New chat — clear messages for this project
  const handleNewChat = useCallback(async () => {
    if (userId && projectId) {
      await clearChatMessages(userId, projectId);
    }
    setMessages([]);
    lastSavedCountRef.current = 0;
    // Clear any active polling
    pollingRef.current.forEach((timer) => clearInterval(timer));
    pollingRef.current.clear();
    completedRef.current.clear();
    stopStatusCycling();
    setShowPastChats(false);
  }, [userId, projectId, stopStatusCycling]);

  // Load past chat sessions
  const handleShowPastChats = useCallback(async () => {
    if (!userId) return;
    setShowPastChats(true);
    setPastChatsLoading(true);
    try {
      const sessions = await listChatSessions(userId);
      setPastChats(sessions);
    } catch (err) {
      console.error("Failed to load past chats:", err);
    } finally {
      setPastChatsLoading(false);
    }
  }, [userId]);

  // Format relative time
  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <section
      className="flex-none bg-[#0d0d0f] rounded-2xl border border-neutral-800/50 flex flex-col overflow-hidden"
      style={{ width: width || 320 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800/50">
        <Sparkles className="w-4 h-4 text-cyan-400" strokeWidth={1.5} />
        <span className="text-sm font-medium text-neutral-300">AI</span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={handleShowPastChats}
            title="Past chats"
            className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-600 hover:text-neutral-400 hover:bg-neutral-800 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleNewChat}
            title="New chat"
            className="w-7 h-7 flex items-center justify-center rounded-md text-neutral-600 hover:text-cyan-400 hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowModelPicker((v) => !v)}
              title="Select AI video model"
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors border",
                showModelPicker
                  ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                  : "bg-transparent border-neutral-800 text-neutral-600 hover:text-neutral-500 hover:border-neutral-700"
              )}
            >
              {VIDEO_MODELS.find((m) => m.key === selectedModel)?.label || "Kling 3.0"}
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {showModelPicker && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-[#141416] border border-neutral-800 rounded-lg shadow-xl z-50 py-1 max-h-64 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                {VIDEO_MODELS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => {
                      setSelectedModel(m.key);
                      setShowModelPicker(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors",
                      selectedModel === m.key
                        ? "bg-cyan-500/10 text-cyan-400"
                        : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300"
                    )}
                  >
                    <div>
                      <span className="text-[11px] font-medium">{m.label}</span>
                      <span className="text-[9px] text-neutral-600 ml-1.5">{m.provider}</span>
                    </div>
                    {selectedModel === m.key && (
                      <span className="text-[9px] text-cyan-500">●</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Past chats overlay */}
      {showPastChats && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800/50">
            <span className="text-xs font-medium text-neutral-400">Past Chats</span>
            <button
              onClick={() => setShowPastChats(false)}
              className="w-6 h-6 flex items-center justify-center rounded text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5" style={{ scrollbarWidth: "none" }}>
            {pastChatsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-4 h-4 text-neutral-600 animate-spin" />
              </div>
            ) : pastChats.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-6 h-6 text-neutral-700 mx-auto mb-2" />
                <p className="text-xs text-neutral-600">No past chats yet</p>
              </div>
            ) : (
              pastChats.map((chat) => (
                <button
                  key={chat.projectId}
                  onClick={() => {
                    setShowPastChats(false);
                    // If this is the current project, just close the panel
                    // Otherwise the user would need to navigate to that project
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                    chat.projectId === projectId
                      ? "bg-cyan-500/10 border border-cyan-500/20"
                      : "hover:bg-neutral-800/50 border border-transparent"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-neutral-300 truncate max-w-[180px]">
                      {chat.projectName}
                    </span>
                    <span className="text-[10px] text-neutral-600 shrink-0 ml-2">
                      {timeAgo(chat.lastAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 truncate">
                    {chat.lastMessage}
                  </p>
                  <span className="text-[10px] text-neutral-600 mt-0.5 block">
                    {chat.messageCount} message{chat.messageCount !== 1 ? "s" : ""}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages area */}
      {!showPastChats && <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center pt-12">
            <Sparkles className="w-8 h-8 text-neutral-700 mb-3" />
            <p className="text-sm text-neutral-500 mb-1">AI Assistant</p>
            <p className="text-xs text-neutral-600 leading-relaxed max-w-[220px]">
              Generate videos, sound effects &amp; voices, or edit your timeline with natural language.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="space-y-1.5">
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider font-medium",
                msg.role === "user" ? "text-neutral-500" : "text-cyan-500/70"
              )}
            >
              {msg.role === "user" ? "You" : "AI"}
            </span>
            <p
              className={cn(
                "text-sm leading-relaxed",
                msg.role === "user" ? "text-neutral-300" : "text-neutral-400"
              )}
            >
              {(msg.type === "edit_text" || msg.type === "add_text" || msg.type === "delete_text") && (
                <CheckCircle2 className="inline-block w-3.5 h-3.5 mr-1.5 align-text-bottom text-green-400" />
              )}
              {msg.type === "audio" && (
                <Volume2 className="inline-block w-3.5 h-3.5 mr-1.5 align-text-bottom text-cyan-400" />
              )}
              {msg.content}
              {msg.polling && (
                <Loader2 className="inline-block w-3.5 h-3.5 animate-spin ml-1.5 align-text-bottom text-cyan-500" />
              )}
            </p>

            {msg.enhancedPrompt && (
              <details className="mt-1">
                <summary className="text-[10px] text-neutral-600 cursor-pointer hover:text-neutral-500">
                  Enhanced prompt
                </summary>
                <p className="text-[11px] text-neutral-600 mt-1 leading-relaxed">
                  {msg.enhancedPrompt}
                </p>
              </details>
            )}

            {msg.referenceImageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border border-cyan-500/20 relative">
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-cyan-400 font-medium uppercase tracking-wider z-10">
                  Reference Frame
                </div>
                <img
                  src={msg.referenceImageUrl}
                  alt="Reference image"
                  className="w-full"
                />
              </div>
            )}

            {msg.mediaUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border border-neutral-800">
                {msg.type === "video" ? (
                  <video
                    src={msg.mediaUrl}
                    controls
                    className="w-full"
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={msg.mediaUrl}
                    alt="Generated"
                    className="w-full"
                  />
                )}
              </div>
            )}

            {msg.audioUrl && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800">
                <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <audio src={msg.audioUrl} controls className="w-full h-8" preload="metadata" />
              </div>
            )}

            {/* Character reference sheet */}
            {msg.character && (
              <div className="mt-2 rounded-lg overflow-hidden border border-purple-500/30 bg-purple-500/5">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-purple-500/20">
                  <User className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-[11px] font-medium text-purple-300">{msg.character.name}</span>
                  <span className="text-[9px] text-purple-500 uppercase tracking-wider ml-auto">Character Sheet</span>
                </div>
                {msg.character.images.map((imgUrl, imgIdx) => (
                  <img key={imgIdx} src={imgUrl} alt={`${msg.character!.name} reference`} className="w-full" />
                ))}
                <p className="px-3 py-2 text-[10px] text-neutral-500">{msg.character.description}</p>
              </div>
            )}
          </div>
        ))}

        {/* Loading / status indicator */}
        {(isLoading || hasPolling) && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin text-cyan-500 shrink-0" />
              <p className="text-[11px] text-cyan-400/80 leading-relaxed transition-all duration-500">
                {isLoading ? "Analyzing your request..." : STATUS_PHASES[statusPhase]}
              </p>
            </div>
          </div>
        )}
      </div>}

      {/* Input area */}
      <div className="border-t border-neutral-800/50 p-3">
        {/* Attached images preview */}
        {attachedImages.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {attachedImages.map((img, idx) => (
              <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-neutral-700 group">
                <img src={img.preview} alt="Attached" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeAttachedImage(idx)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* @ mention autocomplete dropdown */}
        {showMentions && (
          <div className="mb-2 bg-[#141416] border border-neutral-800 rounded-lg shadow-xl max-h-40 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {mentionableAssets().length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-neutral-600">No matching assets. Create a character first.</div>
            ) : (
              mentionableAssets().map((asset, idx) => (
                <button
                  key={idx}
                  onClick={() => insertMention(asset.name)}
                  className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-neutral-800 transition-colors"
                >
                  {asset.type === "character" ? (
                    <User className="w-3 h-3 text-blue-400" />
                  ) : asset.type === "image" ? (
                    <ImagePlus className="w-3 h-3 text-blue-300" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-blue-400" />
                  )}
                  <span className="text-[11px] text-neutral-300">@{asset.name}</span>
                  <span className="text-[9px] text-neutral-600 ml-auto">{asset.type}</span>
                </button>
              ))
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Image upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Attach image"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-cyan-400 hover:border-neutral-700 transition-colors shrink-0"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleImageUpload(e.target.files);
              e.target.value = "";
            }}
          />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Describe a video, create a character, or use @name..."
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm text-neutral-300 resize-none outline-none placeholder:text-neutral-600 focus:border-neutral-700 transition-colors"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-xl transition-colors shrink-0",
              input.trim() && !isLoading
                ? "bg-cyan-500 hover:bg-cyan-400 text-black"
                : "bg-neutral-800 text-neutral-600 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-neutral-600 mt-1.5 text-right">
          {modKey}+Enter to send · @ to tag assets · paste images
        </p>
      </div>
    </section>
  );
}
