import { WebSocket } from "ws";
import { broadcastToProject, sendToClient } from "./index.js";

interface PreviewSession {
  projectId: string;
  clientId: string;
  status: "idle" | "streaming" | "paused";
  lastFrame: number;
  frameRate: number;
}

const previewSessions = new Map<string, PreviewSession>();

export function startPreviewStream(
  clientId: string,
  projectId: string,
  frameRate: number = 30
): string {
  const sessionId = `preview_${projectId}_${Date.now()}`;
  
  previewSessions.set(sessionId, {
    projectId,
    clientId,
    status: "streaming",
    lastFrame: 0,
    frameRate,
  });

  // Notify client
  sendToClient(clientId, {
    type: "preview:started",
    sessionId,
    frameRate,
  });

  return sessionId;
}

export function stopPreviewStream(sessionId: string) {
  const session = previewSessions.get(sessionId);
  if (session) {
    session.status = "idle";
    sendToClient(session.clientId, {
      type: "preview:stopped",
      sessionId,
    });
    previewSessions.delete(sessionId);
  }
}

export function pausePreviewStream(sessionId: string) {
  const session = previewSessions.get(sessionId);
  if (session) {
    session.status = "paused";
    sendToClient(session.clientId, {
      type: "preview:paused",
      sessionId,
    });
  }
}

export function resumePreviewStream(sessionId: string) {
  const session = previewSessions.get(sessionId);
  if (session) {
    session.status = "streaming";
    sendToClient(session.clientId, {
      type: "preview:resumed",
      sessionId,
    });
  }
}

export function sendPreviewFrame(
  sessionId: string,
  frameData: {
    frameNumber: number;
    timestamp: number;
    imageUrl?: string;
    imageData?: string; // base64
  }
) {
  const session = previewSessions.get(sessionId);
  if (session && session.status === "streaming") {
    session.lastFrame = frameData.frameNumber;
    sendToClient(session.clientId, {
      type: "preview:frame",
      sessionId,
      ...frameData,
    });
  }
}

export function seekPreview(sessionId: string, timestamp: number) {
  const session = previewSessions.get(sessionId);
  if (session) {
    sendToClient(session.clientId, {
      type: "preview:seek",
      sessionId,
      timestamp,
    });
  }
}

export function getPreviewSession(sessionId: string): PreviewSession | undefined {
  return previewSessions.get(sessionId);
}

export function getActiveSessionsForProject(projectId: string): PreviewSession[] {
  const sessions: PreviewSession[] = [];
  for (const session of previewSessions.values()) {
    if (session.projectId === projectId) {
      sessions.push(session);
    }
  }
  return sessions;
}

export function cleanupInactiveSessions() {
  const now = Date.now();
  for (const [sessionId, session] of previewSessions) {
    // Clean up idle sessions older than 5 minutes
    if (session.status === "idle") {
      previewSessions.delete(sessionId);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupInactiveSessions, 60000);
