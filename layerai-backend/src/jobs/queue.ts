import { Queue } from "bullmq";
import { env } from "../config/env.js";

// Connection options for BullMQ
const connection = {
  url: env.REDIS_URL,
};

// Export queue
export const exportQueue = new Queue("export", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Generation queue (video/image)
export const generateQueue = new Queue("generate", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Analysis queue (Scene DNA generation)
export const analyzeQueue = new Queue("analyze", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 50,
    removeOnFail: 20,
  },
});

// Composite queue (FFmpeg operations)
export const compositeQueue = new Queue("composite", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "fixed",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// Audio queue (TTS, SFX)
export const audioQueue = new Queue("audio", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 50,
    removeOnFail: 20,
  },
});

// Segment queue (SAM2 operations)
export const segmentQueue = new Queue("segment", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 50,
    removeOnFail: 20,
  },
});

// Get all queues for monitoring
export const allQueues = {
  export: exportQueue,
  generate: generateQueue,
  analyze: analyzeQueue,
  composite: compositeQueue,
  audio: audioQueue,
  segment: segmentQueue,
};

// Helper to get queue stats
export async function getQueueStats(queueName: keyof typeof allQueues) {
  const queue = allQueues[queueName];
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

// Helper to get all queue stats
export async function getAllQueueStats() {
  const stats: Record<string, Awaited<ReturnType<typeof getQueueStats>>> = {};
  
  for (const [name] of Object.entries(allQueues)) {
    stats[name] = await getQueueStats(name as keyof typeof allQueues);
  }
  
  return stats;
}

// Graceful shutdown
export async function closeQueues() {
  await Promise.all([
    exportQueue.close(),
    generateQueue.close(),
    analyzeQueue.close(),
    compositeQueue.close(),
    audioQueue.close(),
    segmentQueue.close(),
  ]);
}
