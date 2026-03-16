import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import Redis from "ioredis";
import { Request, Response } from "express";
import { env } from "../config/env.js";

// Redis client for rate limiting
let redisClient: Redis | null = null;

try {
  redisClient = new Redis(env.REDIS_URL);
} catch (error) {
  console.warn("[RateLimit] Redis not available, using memory store");
}

// Base rate limiter config
const baseConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later" },
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise IP
    const authReq = req as Request & { user?: { id: string } };
    return authReq.user?.id || req.ip || "anonymous";
  },
};

// Store configuration
const getStore = () => {
  if (redisClient) {
    return new RedisStore({
      sendCommand: async (...args: string[]) => {
        const result = await redisClient!.call(args[0], ...args.slice(1));
        return result as number | string;
      },
      prefix: "rl:",
    });
  }
  return undefined; // Falls back to memory store
};

/**
 * General API rate limiter
 * 100 requests per minute
 */
export const generalLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  store: getStore(),
});

/**
 * Generation endpoints rate limiter
 * Stricter limits for expensive AI operations
 * 10 requests per minute
 */
export const generationLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 1000,
  max: 10,
  store: getStore(),
  message: { success: false, error: "Generation rate limit exceeded. Please wait before generating more content." },
});

/**
 * Analysis endpoints rate limiter
 * 20 requests per minute
 */
export const analysisLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 1000,
  max: 20,
  store: getStore(),
});

/**
 * Upload rate limiter
 * 30 uploads per minute
 */
export const uploadLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 1000,
  max: 30,
  store: getStore(),
});

/**
 * Export rate limiter
 * 5 exports per 10 minutes
 */
export const exportLimiter = rateLimit({
  ...baseConfig,
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  store: getStore(),
  message: { success: false, error: "Export rate limit exceeded. Please wait before exporting again." },
});

/**
 * Create custom rate limiter
 */
export function createLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
}) {
  return rateLimit({
    ...baseConfig,
    ...options,
    store: getStore(),
    message: options.message
      ? { success: false, error: options.message }
      : baseConfig.message,
  });
}

/**
 * Cleanup function for graceful shutdown
 */
export async function closeRateLimitRedis() {
  if (redisClient) {
    await redisClient.quit();
  }
}
