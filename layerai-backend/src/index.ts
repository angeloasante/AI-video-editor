import { createServer } from "./server.js";
import { env } from "./config/env.js";
import { closeQueues } from "./jobs/queue.js";
import { closeWorkers } from "./jobs/workers.js";
import { closeWebSocket } from "./ws/index.js";

async function main() {
  const { app, server } = createServer();

  // Import workers to start them
  await import("./jobs/workers.js");
  console.log("✅ Job workers started");

  server.listen(Number(env.PORT), () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🎬 LayerAI Backend v1.0.0                       ║
║                                                   ║
║   Server:  http://localhost:${env.PORT}           ║
║   Env:     ${env.NODE_ENV.padEnd(11)}             ║
║   Python:  ${env.PYTHON_API_URL}                  ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n🛑 Shutting down gracefully...");
    
    // Close WebSocket connections
    closeWebSocket();
    console.log("✅ WebSocket connections closed");

    // Close job workers
    await closeWorkers();
    console.log("✅ Job workers closed");

    // Close queues
    await closeQueues();
    console.log("✅ Job queues closed");

    // Close HTTP server
    server.close(() => {
      console.log("✅ Server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
