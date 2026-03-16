import { NavItem, SidebarTab } from "@/types";

export const NAV_ITEMS: NavItem[] = [
  { id: "edit", label: "Edit", icon: "Sparkles" },
  { id: "sfx", label: "SFX", icon: "Wand2" },
  { id: "music", label: "Music", icon: "Music" },
  { id: "video", label: "Video", icon: "Video" },
  { id: "voices", label: "Voices", icon: "LayoutGrid" },
  { id: "files", label: "Files", icon: "Folder" },
] as const;

export const DEFAULT_VOICE_SETTINGS = {
  model: "eleven_multilingual_v2",
  voice_id: "rachel",
  voice_name: "Rachel (Legacy)",
  stability: 0.5,
  similarity_boost: 0.75,
};

export const VIDEO_MODELS = [
  { id: "kling-3.0", name: "Kling 3.0 Pro", price: 0.10, unit: "sec" },
  { id: "veo3", name: "Veo 3", price: 0.20, unit: "sec" },
  { id: "wan-2.6", name: "Wan 2.6", price: 0.05, unit: "sec" },
] as const;

export const IMAGE_MODELS = [
  { id: "nano-banana-pro", name: "Nano Banana Pro", price: 0.04, unit: "image" },
  { id: "flux-dev", name: "FLUX Dev", price: 0.03, unit: "image" },
] as const;

export const VOICE_MODELS = [
  { id: "eleven_multilingual_v2", name: "Eleven Multilingual v2", label: "V2" },
  { id: "eleven_monolingual_v1", name: "Eleven Monolingual v1", label: "V1" },
] as const;

export const DEFAULT_CREDITS = 119680;

export const TIMELINE_PIXELS_PER_SECOND = 100;
