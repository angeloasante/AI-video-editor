import { broadcast, broadcastToProject, sendToClient } from "./index.js";

export interface JobProgressUpdate {
  jobId: string;
  jobType: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number; // 0-100, -1 for error
  message: string;
  result?: unknown;
  error?: string;
}

// Track active job subscriptions
const jobSubscriptions = new Map<string, Set<string>>(); // jobId -> clientIds

export function subscribeToJob(clientId: string, jobId: string) {
  if (!jobSubscriptions.has(jobId)) {
    jobSubscriptions.set(jobId, new Set());
  }
  jobSubscriptions.get(jobId)!.add(clientId);
}

export function unsubscribeFromJob(clientId: string, jobId: string) {
  const subs = jobSubscriptions.get(jobId);
  if (subs) {
    subs.delete(clientId);
    if (subs.size === 0) {
      jobSubscriptions.delete(jobId);
    }
  }
}

export function notifyJobProgress(update: JobProgressUpdate) {
  // Broadcast to jobs channel
  broadcast("jobs", {
    type: "job:progress",
    ...update,
    timestamp: Date.now(),
  });

  // Also notify specific subscribers
  const subscribers = jobSubscriptions.get(update.jobId);
  if (subscribers) {
    for (const clientId of subscribers) {
      sendToClient(clientId, {
        type: "job:progress",
        ...update,
      });
    }
  }
}

export function notifyJobQueued(
  jobId: string,
  jobType: string,
  projectId?: string
) {
  const update: JobProgressUpdate = {
    jobId,
    jobType,
    status: "queued",
    progress: 0,
    message: "Job queued",
  };

  notifyJobProgress(update);

  if (projectId) {
    broadcastToProject(projectId, {
      type: "job:queued",
      ...update,
    });
  }
}

export function notifyJobStarted(
  jobId: string,
  jobType: string,
  projectId?: string
) {
  const update: JobProgressUpdate = {
    jobId,
    jobType,
    status: "processing",
    progress: 0,
    message: "Job started",
  };

  notifyJobProgress(update);

  if (projectId) {
    broadcastToProject(projectId, {
      type: "job:started",
      ...update,
    });
  }
}

export function notifyJobCompleted(
  jobId: string,
  jobType: string,
  result: unknown,
  projectId?: string
) {
  const update: JobProgressUpdate = {
    jobId,
    jobType,
    status: "completed",
    progress: 100,
    message: "Job completed",
    result,
  };

  notifyJobProgress(update);

  if (projectId) {
    broadcastToProject(projectId, {
      type: "job:completed",
      ...update,
    });
  }

  // Clean up subscriptions
  jobSubscriptions.delete(jobId);
}

export function notifyJobFailed(
  jobId: string,
  jobType: string,
  error: string,
  projectId?: string
) {
  const update: JobProgressUpdate = {
    jobId,
    jobType,
    status: "failed",
    progress: -1,
    message: "Job failed",
    error,
  };

  notifyJobProgress(update);

  if (projectId) {
    broadcastToProject(projectId, {
      type: "job:failed",
      ...update,
    });
  }

  // Clean up subscriptions
  jobSubscriptions.delete(jobId);
}

export function notifyJobUpdate(
  jobId: string,
  jobType: string,
  progress: number,
  message: string,
  projectId?: string
) {
  const update: JobProgressUpdate = {
    jobId,
    jobType,
    status: "processing",
    progress,
    message,
  };

  notifyJobProgress(update);

  if (projectId) {
    broadcastToProject(projectId, {
      type: "job:update",
      ...update,
    });
  }
}
