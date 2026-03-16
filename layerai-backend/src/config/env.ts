import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  // Server
  PORT: z.string().default("8080"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Google Gemini (optional - for AI features)
  GOOGLE_GEMINI_API_KEY: z.string().optional().transform(v => v || undefined),

  // fal.ai
  FAL_KEY: z.string().min(1),

  // Replicate (SAM2 - optional)
  REPLICATE_API_TOKEN: z.string().optional().transform(v => v || undefined),

  // ElevenLabs
  ELEVENLABS_API_KEY: z.string().min(1),

  // Redis (for BullMQ)
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Python service URL (same container or external)
  PYTHON_API_URL: z.string().url().default("http://localhost:8001"),

  // CORS - Frontend URL
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  
  // Allowed Origins (comma-separated)
  ALLOWED_ORIGINS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export type Env = z.infer<typeof envSchema>;
