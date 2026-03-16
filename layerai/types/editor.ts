// Shared editor types — single source of truth

export type TextAnimationType =
  | "none"
  | "fade"
  | "typewriter"
  | "slide-up"
  | "slide-down"
  | "scale"
  | "bounce";

export type TransitionType =
  | "fade"
  | "fadeblack"
  | "fadewhite"
  | "dissolve"
  | "wipeleft"
  | "wiperight"
  | "wipeup"
  | "wipedown"
  | "slideleft"
  | "slideright"
  | "slideup"
  | "slidedown"
  | "coverleft"
  | "coverright"
  | "revealleft"
  | "revealright"
  | "zoomin"
  | "circleopen"
  | "circleclose"
  | "pixelize"
  | "radial"
  | "smoothleft"
  | "smoothright"
  | "diagtl"
  | "diagtr"
  | "squeezev"
  | "squeezeh";

export interface TextOverlay {
  id: string;
  text: string;
  preset: string;
  startTime: number;
  endTime: number;
  position: { x: number; y: number }; // percentage 0-100
  transform?: {
    scale: number;     // 0.1 - 5
    rotation: number;  // degrees
  };
  fontSize?: number;   // px, overrides preset default
  fontFamily?: string; // Google Font name, e.g. "Inter", "Playfair Display"
  fontWeight?: number; // 100-900
  color?: string;      // hex color, default "#ffffff"
  animation?: {
    type: TextAnimationType;
    fadeIn: number;
    fadeOut: number;
  };
}

export interface ClipEdits {
  volume: number;       // 0 - 2 (1 = normal)
  speed: number;        // 0.25 - 4 (1 = normal)
  mirrorH: boolean;     // horizontal mirror
  mirrorV: boolean;     // vertical mirror
  rotation: number;     // degrees (0, 90, 180, 270)
  crop?: {              // percentage values 0-100
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export const DEFAULT_CLIP_EDITS: ClipEdits = {
  volume: 1,
  speed: 1,
  mirrorH: false,
  mirrorV: false,
  rotation: 0,
};

export interface Transition {
  id: string;
  type: TransitionType;
  duration: number;
  clipAId: string;
  clipBId: string;
  startTime: number;
}

export type OverlayType = "image" | "video";

export interface VideoOverlay {
  id: string;
  src: string;          // URL of the overlay media
  name: string;         // display name
  type: OverlayType;
  x: number;            // percentage 0-100
  y: number;            // percentage 0-100
  width: number;        // percentage 0-100
  height: number;       // percentage 0-100
  opacity: number;      // 0-1
  rotation: number;     // degrees
  startTime: number;    // seconds
  endTime: number;      // seconds
  zIndex?: number;      // stacking order (higher = on top)
  crop?: {              // percentage inset crop on the overlay media
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}
