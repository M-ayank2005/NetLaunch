import Redis from "ioredis";
import { Queue } from "bullmq";
import { env } from "../config/env";

export const redisConnection = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

redisConnection.on("connect", () => {
  console.log("⚡ [Redis] Connected to Redis broker.");
});

redisConnection.on("error", (err) => {
  console.error("❌ [Redis] Connection Error:", err.message);
});

export const deployQueue = new Queue("deployment-build-queue", {
  connection: redisConnection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export async function queueDeploymentJob(deploymentId: string, projectId: string, userId: string) {
  console.log(`📦 [BullMQ] Queuing job for deployment ${deploymentId} (Project: ${projectId})`);
  const job = await deployQueue.add("build-project", {
    deploymentId,
    projectId,
    userId,
    timestamp: Date.now(),
  });
  return job;
}
