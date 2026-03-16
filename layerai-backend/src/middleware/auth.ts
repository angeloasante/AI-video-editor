import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Middleware to verify Supabase JWT token
 * Extracts user info from Authorization header
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Missing or invalid authorization header",
      });
      return;
    }

    const token = authHeader.slice(7);

    // Verify the JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email || "",
      role: user.role || "authenticated",
    };

    next();
  } catch (error) {
    console.error("[Auth] Error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication error",
    });
  }
}

/**
 * Optional auth middleware - doesn't fail if no token
 * Useful for endpoints that work differently for auth/unauth users
 */
export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: { user } } = await supabase.auth.getUser(token);

      if (user) {
        req.user = {
          id: user.id,
          email: user.email || "",
          role: user.role || "authenticated",
        };
      }
    }

    next();
  } catch (error) {
    // Don't fail, just continue without user
    next();
  }
}

/**
 * Middleware to require specific role
 */
export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: "Insufficient permissions",
      });
      return;
    }

    next();
  };
}

/**
 * API key authentication for server-to-server requests
 */
export function apiKeyMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: "API key required",
    });
    return;
  }

  // In production, validate against stored API keys
  // For now, accept a simple check
  if (apiKey !== process.env.API_SECRET_KEY) {
    res.status(401).json({
      success: false,
      error: "Invalid API key",
    });
    return;
  }

  next();
}
