// Scene DNA Types
export interface SceneDNA {
  video_id: string;
  source_prompt: string;
  source_model: string;
  scene: SceneSettings;
  assets: Asset[];
  edit_history: EditHistoryItem[];
}

export interface SceneSettings {
  theme: string;
  mood: string;
  dominant_colors: string[];
  color_temperature: string;
  lighting: LightingSettings;
  grain_level: string;
  background: {
    description: string;
  };
}

export interface LightingSettings {
  direction: string;
  intensity: string;
  shadows: string;
}

export interface Asset {
  asset_id: string;
  type: "character" | "object" | "background";
  label: string;
  position: string;
  bounding_box: BoundingBox;
  layer_file: string;
  clothing?: string;
  dominant_colors: string[];
  last_edited: string | null;
}

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EditHistoryItem {
  timestamp: string;
  action: string;
  target_asset?: string;
  changes: Record<string, unknown>;
}

// Project Types
export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  scene_dna: SceneDNA;
  video_url?: string;
  thumbnail_url?: string;
}

// Voice Settings
export interface VoiceSettings {
  model: string;
  voice_id: string;
  voice_name: string;
  stability: number;
  similarity_boost: number;
}

// Timeline Types
export interface TimelineTrack {
  id: string;
  type: "video" | "audio" | "speech" | "sfx";
  name: string;
  clips: TimelineClip[];
}

export interface TimelineClip {
  id: string;
  start_time: number;
  end_time: number;
  asset_id?: string;
  thumbnail_url?: string;
  waveform_data?: number[];
}

// Navigation Types
export type SidebarTab = "edit" | "sfx" | "music" | "video" | "voices" | "files";

export interface NavItem {
  id: SidebarTab;
  label: string;
  icon: string;
}
