import Redis from "ioredis";
import { prisma } from "@netlaunch/database";
import { env } from "../config/env";
import { BuildLogEntry } from "../types";

export class WorkerLoggerService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
    });
  }

  /**
   * Log message to database and publish to Redis PubSub for instantaneous Socket.IO streaming
   */
  async log(deploymentId: string, level: "INFO" | "WARN" | "ERROR" | "COMMAND", message: string): Promise<void> {
    const timestamp = new Date();
    
    try {
      // 1. Insert into PostgreSQL BuildLog
      const logEntry = await prisma.buildLog.create({
        data: {
          deploymentId,
          level,
          message,
          timestamp,
        },
      });

      // 2. Publish to Redis channel `deployment:logs:<deploymentId>` for apps/api Socket.IO broadcasting
      const channel = `deployment:logs:${deploymentId}`;
      await this.redis.publish(channel, JSON.stringify(logEntry));
      
      // Also echo to local worker terminal with color
      const prefix = level === "COMMAND" ? "⚡ $" : level === "ERROR" ? "❌" : level === "WARN" ? "⚠️" : "ℹ️";
      console.log(`[WorkerLog] [${deploymentId}] ${prefix} ${message}`);
    } catch (err) {
      console.error(`❌ [WorkerLogger] Failed to write/publish log:`, err);
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export const workerLogger = new WorkerLoggerService();
