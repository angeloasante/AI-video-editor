import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

// Service role client - full admin access
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Storage bucket names
export const BUCKETS = {
  MEDIA: "media",
  EXPORTS: "exports",
  PROXIES: "proxies",
  LAYERS: "layers",
  CHARACTERS: "characters",
} as const;
