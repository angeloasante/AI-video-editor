import { Request, Response, NextFunction } from "express";

interface RequestLog {
  timestamp: string;
  method: string;
  path: string;
  query: Record<string, unknown>;
  ip: string;
  userAgent: string;
  userId?: string;
  duration?: number;
  statusCode?: number;
  contentLength?: number;
}

/**
 * Request logger middleware
 * Logs incoming requests and response details
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();
  const log: RequestLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    query: req.query as Record<string, unknown>,
    ip: req.ip || req.connection.remoteAddress || "unknown",
    userAgent: req.get("user-agent") || "unknown",
  };

  // Get user ID if authenticated
  const authReq = req as Request & { user?: { id: string } };
  if (authReq.user?.id) {
    log.userId = authReq.user.id;
  }

  // Capture response details
  const originalSend = res.send;
  res.send = function (body) {
    log.duration = Date.now() - startTime;
    log.statusCode = res.statusCode;
    log.contentLength = body ? Buffer.byteLength(body) : 0;

    // Log based on status code
    if (res.statusCode >= 500) {
      console.error("[Request]", JSON.stringify(log));
    } else if (res.statusCode >= 400) {
      console.warn("[Request]", JSON.stringify(log));
    } else if (process.env.NODE_ENV !== "production" || log.duration > 1000) {
      // In production, only log slow requests
      console.log("[Request]", JSON.stringify(log));
    }

    return originalSend.call(this, body);
  };

  next();
}

/**
 * Simple request logger for development
 * More concise output
 */
export function simpleRequestLogger(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const statusColor = res.statusCode >= 500 ? "\x1b[31m" : // red
                        res.statusCode >= 400 ? "\x1b[33m" : // yellow
                        res.statusCode >= 300 ? "\x1b[36m" : // cyan
                        "\x1b[32m"; // green
    const reset = "\x1b[0m";

    console.log(
      `${req.method} ${req.path} ${statusColor}${res.statusCode}${reset} ${duration}ms`
    );
  });

  next();
}

/**
 * Request ID middleware
 * Adds a unique request ID for tracing
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = req.headers["x-request-id"] as string ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);
  
  next();
}

/**
 * Get request details for logging in route handlers
 */
export function getRequestInfo(req: Request): {
  method: string;
  path: string;
  ip: string;
  requestId?: string;
  userId?: string;
} {
  const authReq = req as Request & { user?: { id: string } };
  return {
    method: req.method,
    path: req.path,
    ip: req.ip || "unknown",
    requestId: req.headers["x-request-id"] as string | undefined,
    userId: authReq.user?.id,
  };
}
