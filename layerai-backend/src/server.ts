import express, { Express } from "express";
import cors from "cors";
import morgan from "morgan";
import http from "http";
import { corsOptions } from "./config/cors.js";
import { env } from "./config/env.js";
import { router } from "./routes/index.js";
import { initializeWebSocket } from "./ws/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";

export function createServer(): { app: Express; server: http.Server } {
  const app = express();
  const server = http.createServer(app);

  // Middleware
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  
  // Logging
  if (env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
    app.use(requestLogger);
  }

  // API Routes
  app.use("/api", router);

  // WebSocket setup
  initializeWebSocket(server);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return { app, server };
}
