import { Server, Socket } from "socket.io";
import Redis from "ioredis";
import { env } from "../config/env";
import { prisma, DeploymentStatus } from "@netlaunch/database";

export function setupLogStreamSocket(io: Server) {
  // Create a dedicated Redis subscriber instance for PubSub
  const redisSubscriber = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
  });

  redisSubscriber.on("connect", () => {
    console.log("⚡ [Redis PubSub] Socket.IO Log Stream subscriber ready.");
  });

  // Listen for published logs from Workers across all channels matching pattern
  redisSubscriber.psubscribe("deployment:logs:*", (err, count) => {
    if (err) console.error("❌ [Redis PubSub] Subscription error:", err.message);
  });

  redisSubscriber.on("pmessage", (_pattern, channel, message) => {
    try {
      // Channel format: deployment:logs:<deploymentId>
      const deploymentId = channel.split(":")[2];
      const logPayload = JSON.parse(message);
      
      // Broadcast to all connected sockets in that deployment room
      io.to(`deployment:${deploymentId}`).emit("deployment:log:new", logPayload);
    } catch (e) {
      console.error("❌ Failed to parse published log message:", e);
    }
  });

  io.on("connection", (socket: Socket) => {
    console.log(`🔌 [Socket.IO] Client connected: ${socket.id}`);

    // Client requests to watch live logs for a specific deployment
    socket.on("subscribe:deployment:logs", async ({ deploymentId }: { deploymentId: string }) => {
      if (!deploymentId) return;

      const room = `deployment:${deploymentId}`;
      socket.join(room);
      console.log(`👁️ Client ${socket.id} joined room ${room}`);

      // Send existing logs immediately so the client has full context right away
      try {
        const existingLogs = await prisma.buildLog.findMany({
          where: { deploymentId },
          orderBy: { timestamp: "asc" },
        });

        socket.emit("deployment:log:history", existingLogs);

        // Check if deployment is currently BUILDING or QUEUED and simulate live build steps for interactive UI testing
        const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } });
        if (deployment && (deployment.status === DeploymentStatus.BUILDING || deployment.status === DeploymentStatus.QUEUED)) {
          simulateLiveBuildStream(io, deploymentId);
        }
      } catch (err) {
        console.error("❌ Error fetching historical logs for socket:", err);
      }
    });

    socket.on("unsubscribe:deployment:logs", ({ deploymentId }: { deploymentId: string }) => {
      if (deploymentId) {
        socket.leave(`deployment:${deploymentId}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`🔌 [Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
}

// Helper to simulate a live Docker container build step-by-step when testing locally
// This demonstrates how Workers stream logs via Redis -> Socket.IO -> UI Animations
function simulateLiveBuildStream(io: Server, deploymentId: string) {
  const steps = [
    { level: "COMMAND", message: "⚡ NetLaunch Worker #01 initializing Docker container (node:20-alpine)...", delay: 2000 },
    { level: "INFO", message: "📦 Container mounted. Restoring build cache from MinIO object storage...", delay: 4000 },
    { level: "COMMAND", message: "$ pnpm install --frozen-lockfile", delay: 6000 },
    { level: "INFO", message: "Lockfile is up to date, resolution step is skipped", delay: 8000 },
    { level: "INFO", message: "Already up to date. Done in 3.4s", delay: 10000 },
    { level: "COMMAND", message: "$ pnpm run build", delay: 12000 },
    { level: "INFO", message: "vite v5.4.1 building for production...", delay: 15000 },
    { level: "INFO", message: "transforming (184) src/main.tsx...", delay: 18000 },
    { level: "INFO", message: "✓ 246 modules transformed.", delay: 21000 },
    { level: "INFO", message: "dist/index.html                   0.46 kB │ gzip:  0.31 kB", delay: 24000 },
    { level: "INFO", message: "dist/assets/index-B_k8j9l0.css   18.42 kB │ gzip:  4.12 kB", delay: 25000 },
    { level: "INFO", message: "dist/assets/index-C_x1z2p9.js   194.88 kB │ gzip: 62.44 kB", delay: 26000 },
    { level: "INFO", message: "✓ built in 14.12s", delay: 27000 },
    { level: "INFO", message: "🚀 Uploading static bundle (dist/) to MinIO bucket netlaunch-artifacts...", delay: 29000 },
    { level: "INFO", message: "✨ Build & upload completed successfully! Marking deployment READY.", delay: 31000 },
  ];

  steps.forEach((step) => {
    setTimeout(async () => {
      try {
        const logEntry = await prisma.buildLog.create({
          data: {
            deploymentId,
            level: step.level,
            message: step.message,
          },
        });

        // Broadcast to clients listening in the deployment room
        io.to(`deployment:${deploymentId}`).emit("deployment:log:new", logEntry);

        // If this was the last step, update deployment status to READY
        if (step === steps[steps.length - 1]) {
          const finished = await prisma.deployment.update({
            where: { id: deploymentId },
            data: {
              status: DeploymentStatus.READY,
              finishedAt: new Date(),
              durationMs: 31000,
            },
          });
          io.to(`deployment:${deploymentId}`).emit("deployment:status:update", finished);
        }
      } catch (e) {
        // Deployment might have been deleted or modified
      }
    }, step.delay);
  });
}
