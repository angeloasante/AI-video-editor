import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";

interface Client {
  ws: WebSocket;
  projectId?: string;
  subscriptions: Set<string>;
}

const clients = new Map<string, Client>();

let wss: WebSocketServer;

export function initializeWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const clientId = generateClientId();
    const client: Client = {
      ws,
      subscriptions: new Set(["global"]),
    };
    clients.set(clientId, client);

    console.log(`[WS] Client ${clientId} connected`);

    // Send welcome message
    ws.send(JSON.stringify({
      type: "connected",
      clientId,
      timestamp: Date.now(),
    }));

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(clientId, message);
      } catch (error) {
        console.error(`[WS] Invalid message from ${clientId}:`, error);
      }
    });

    ws.on("close", () => {
      clients.delete(clientId);
      console.log(`[WS] Client ${clientId} disconnected`);
    });

    ws.on("error", (error) => {
      console.error(`[WS] Client ${clientId} error:`, error);
      clients.delete(clientId);
    });
  });

  console.log("[WS] WebSocket server initialized");
}

function handleMessage(clientId: string, message: Record<string, unknown>) {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case "subscribe":
      // Subscribe to a channel (e.g., project-specific updates)
      if (typeof message.channel === "string") {
        client.subscriptions.add(message.channel);
        if (message.channel.startsWith("project:")) {
          client.projectId = message.channel.split(":")[1];
        }
      }
      break;

    case "unsubscribe":
      if (typeof message.channel === "string") {
        client.subscriptions.delete(message.channel);
      }
      break;

    case "ping":
      client.ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      break;

    case "preview:request":
      // Handle preview stream request
      handlePreviewRequest(clientId, message);
      break;

    default:
      console.log(`[WS] Unknown message type: ${message.type}`);
  }
}

function handlePreviewRequest(
  clientId: string,
  message: Record<string, unknown>
) {
  const client = clients.get(clientId);
  if (!client) return;

  // Acknowledge preview request
  client.ws.send(JSON.stringify({
    type: "preview:ack",
    requestId: message.requestId,
    status: "processing",
  }));
}

// Broadcast to all clients subscribed to a channel
export function broadcast(channel: string, message: Record<string, unknown>) {
  const payload = JSON.stringify({ ...message, channel, timestamp: Date.now() });

  for (const [_clientId, client] of clients) {
    if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

// Broadcast to a specific project
export function broadcastToProject(
  projectId: string,
  message: Record<string, unknown>
) {
  broadcast(`project:${projectId}`, message);
}

// Broadcast job progress
export function broadcastJobProgress(
  jobId: string,
  jobType: string,
  progress: number,
  message: string
) {
  broadcast("jobs", {
    type: "job:progress",
    jobId,
    jobType,
    progress,
    message,
  });
}

// Broadcast generation result
export function broadcastGenerationResult(
  projectId: string,
  result: Record<string, unknown>
) {
  broadcastToProject(projectId, {
    type: "generation:complete",
    ...result,
  });
}

// Send to specific client
export function sendToClient(clientId: string, message: Record<string, unknown>) {
  const client = clients.get(clientId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify({ ...message, timestamp: Date.now() }));
  }
}

// Get connected client count
export function getClientCount(): number {
  return clients.size;
}

// Get clients for a project
export function getProjectClients(projectId: string): string[] {
  const result: string[] = [];
  for (const [clientId, client] of clients) {
    if (client.projectId === projectId) {
      result.push(clientId);
    }
  }
  return result;
}

// Close all connections
export function closeWebSocket() {
  for (const [_, client] of clients) {
    client.ws.close();
  }
  wss?.close();
}

function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
