import express, { Request, Response } from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { apiLimiter } from "./middlewares/rateLimiter";
import authRoutes from "./routes/auth.routes";
import githubRoutes from "./routes/github.routes";
import projectRoutes from "./routes/project.routes";
import { setupLogStreamSocket } from "./socket/logStream";
import { prisma } from "@netlaunch/database";

const app: express.Application = express();
const server = http.createServer(app);

// Initialize Socket.IO WebSocket Server with strict CORS
const io = new Server(server, {
  cors: {
    origin: [env.CLIENT_URL, "http://localhost:3000"],
    credentials: true,
  },
});

// Setup Real-time Log Streaming over Socket.IO
setupLogStreamSocket(io);

// ==========================================
// Express Security & Parsing Middleware
// ==========================================
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled locally for GraphQL/Swagger or dev tools
  })
);

app.use(
  cors({
    origin: [env.CLIENT_URL, "http://localhost:3000"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(apiLimiter);

// Request logging middleware
app.use((req: Request, _res: Response, next) => {
  if (req.url !== "/health") {
    console.log(`➡️ [${req.method}] ${req.url}`);
  }
  next();
});

// ==========================================
// API Routes Layer
// ==========================================
app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      redis: "connected",
    });
  } catch (error: any) {
    return res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/github", githubRoutes);
app.use("/api/v1/projects", projectRoutes);

// Global Error Handler
app.use(errorHandler);

// Start HTTP & WebSocket Server
server.listen(env.PORT, () => {
  console.log(`
╔═════════════════════════════════════════════════════════════╗
║   🚀 NetLaunch API Control Plane Running                     ║
║   🌐 HTTP API Server:   http://localhost:${env.PORT}/api/v1       ║
║   🔌 Socket.IO Hub:     ws://localhost:${env.PORT}                ║
║   🛡️ Environment:       ${env.NODE_ENV.padEnd(36)}║
╚═════════════════════════════════════════════════════════════╝
  `);
});

export { app, server, io };
