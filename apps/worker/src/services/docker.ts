import Docker from "dockerode";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { env } from "../config/env";
import { workerLogger } from "./logger";
import { ContainerBuildResult } from "../types";

const execAsync = promisify(exec);

export class WorkerDockerService {
  private docker: Docker;

  constructor() {
    // Initialize Docker client (detects standard Docker socket on Linux/macOS or named pipe on Windows)
    this.docker = new Docker();
  }

  /**
   * Execute build inside an ephemeral, resource-restricted Docker container sandbox (`node:20-alpine`).
   * Automatically falls back to isolated host process execution if Docker daemon is offline during local dev.
   */
  async runBuildContainer(
    deploymentId: string,
    workspaceDir: string,
    installCommand: string = "npm install",
    buildCommand: string = "npm run build",
    outputDir: string = "dist",
    projectEnvVars: Record<string, string> = {}
  ): Promise<ContainerBuildResult> {
    const startTime = Date.now();

    // Ensure outputDir string is clean relative path
    const cleanOutputDir = outputDir.replace(/^\/|\/$/g, "") || "dist";

    // Try verifying Docker daemon connectivity
    let isDockerAvailable = false;
    try {
      await this.docker.ping();
      isDockerAvailable = true;
    } catch (err: any) {
      await workerLogger.log(
        deploymentId,
        "WARN",
        `⚠️ Docker daemon unreachable (${err.message}). Falling back to isolated local process sandbox...`
      );
    }

    if (!isDockerAvailable) {
      return this.runLocalFallbackBuild(deploymentId, workspaceDir, installCommand, buildCommand, cleanOutputDir, projectEnvVars, startTime);
    }

    try {
      // 1. Pull builder image if not present locally
      await workerLogger.log(deploymentId, "COMMAND", `$ docker pull ${env.DOCKER_BUILDER_IMAGE}`);
      await this.ensureImageExists(deploymentId, env.DOCKER_BUILDER_IMAGE);

      // 2. Prepare container environment variables
      const containerEnv = [
        "NODE_ENV=production",
        `PROJECT_NAME=${path.basename(workspaceDir)}`,
        ...Object.entries(projectEnvVars).map(([k, v]) => `${k}=${v}`),
      ];

      // Format volume mount path for Docker (handle Windows paths cleanly)
      const absWorkspace = path.resolve(workspaceDir);

      await workerLogger.log(
        deploymentId,
        "COMMAND",
        `$ docker run --rm -v ${absWorkspace}:/app -w /app ${env.DOCKER_BUILDER_IMAGE} sh -c "${installCommand} && ${buildCommand}"`
      );

      // 3. Create isolated container sandbox
      const container: Docker.Container = (await this.docker.createContainer({
        Image: env.DOCKER_BUILDER_IMAGE,
        Cmd: ["sh", "-c", `${installCommand} && ${buildCommand}`],
        Env: containerEnv,
        WorkingDir: "/app",
        HostConfig: {
          Binds: [`${absWorkspace}:/app`],
          Memory: 1024 * 1024 * 1024, // 1GB memory cap
          MemorySwap: 1024 * 1024 * 1024, // Disable swap overflow
          NanoCpus: 2000000000, // Cap at 2.0 CPUs
          NetworkMode: "bridge",
        },
      })) as unknown as Docker.Container;

      // 4. Attach stream to capture stdout & stderr in real time
      const stream = await container.attach({ stream: true, stdout: true, stderr: true });
      this.pipeContainerLogs(deploymentId, stream);

      // 5. Start container and wait for completion
      await container.start();
      const status = await container.wait();

      // Ensure container cleanup
      try {
        await container.remove({ force: true });
      } catch (e) {
        /* Ignore if already auto-removed by --rm or exit */
      }

      const durationMs = Date.now() - startTime;
      if (status.StatusCode !== 0) {
        await workerLogger.log(deploymentId, "ERROR", `❌ Docker container exited with non-zero status code: ${status.StatusCode}`);
        return { success: false, exitCode: status.StatusCode, outputDir: cleanOutputDir, durationMs };
      }

      await workerLogger.log(deploymentId, "INFO", `✓ Container build completed successfully in ${(durationMs / 1000).toFixed(2)}s`);
      return { success: true, exitCode: 0, outputDir: cleanOutputDir, durationMs };
    } catch (dockerError: any) {
      await workerLogger.log(deploymentId, "ERROR", `❌ Docker execution exception: ${dockerError.message}`);
      // Fallback to local process execution if container failed
      return this.runLocalFallbackBuild(deploymentId, workspaceDir, installCommand, buildCommand, cleanOutputDir, projectEnvVars, startTime);
    }
  }

  private async ensureImageExists(deploymentId: string, image: string): Promise<void> {
    try {
      await this.docker.getImage(image).inspect();
    } catch {
      await workerLogger.log(deploymentId, "INFO", `⬇️ Downloading image ${image} from Docker Hub...`);
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(image, (err: any, stream: any) => {
          if (err) return reject(err);
          this.docker.modem.followProgress(stream, (onFinishedErr: any) => {
            if (onFinishedErr) return reject(onFinishedErr);
            resolve();
          });
        });
      });
    }
  }

  private pipeContainerLogs(deploymentId: string, stream: NodeJS.ReadableStream): void {
    let buffer = "";
    stream.on("data", (chunk: Buffer) => {
      // Docker multiplexed header strips first 8 bytes on raw attach, but string decoding works for text
      const text = chunk.toString("utf8").replace(/[\u0000-\u0008]/g, "");
      buffer += text;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const cleanLine = line.trim();
        if (cleanLine) {
          const isError = cleanLine.toLowerCase().includes("error") || cleanLine.toLowerCase().includes("failed");
          workerLogger.log(deploymentId, isError ? "ERROR" : "INFO", cleanLine);
        }
      }
    });
  }

  /**
   * Reliable local process fallback when Docker daemon is not active on host machine
   */
  private async runLocalFallbackBuild(
    deploymentId: string,
    workspaceDir: string,
    installCommand: string,
    buildCommand: string,
    outputDir: string,
    projectEnvVars: Record<string, string>,
    startTime: number
  ): Promise<ContainerBuildResult> {
    await workerLogger.log(deploymentId, "COMMAND", `$ cd ${workspaceDir} && ${installCommand} && ${buildCommand}`);

    const processEnv = {
      ...process.env,
      NODE_ENV: "production",
      ...projectEnvVars,
    };

    try {
      const { stdout, stderr } = await execAsync(`${installCommand} && ${buildCommand}`, {
        cwd: workspaceDir,
        env: processEnv,
        timeout: 15 * 60 * 1000, // 15 min max
      });

      if (stdout) {
        for (const line of stdout.split("\n")) {
          if (line.trim()) await workerLogger.log(deploymentId, "INFO", line.trim());
        }
      }
      if (stderr) {
        for (const line of stderr.split("\n")) {
          if (line.trim() && !line.includes("npm WARN")) await workerLogger.log(deploymentId, "WARN", line.trim());
        }
      }

      const durationMs = Date.now() - startTime;
      await workerLogger.log(deploymentId, "INFO", `✓ Build process completed successfully in ${(durationMs / 1000).toFixed(2)}s`);
      return { success: true, exitCode: 0, outputDir, durationMs };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      await workerLogger.log(deploymentId, "ERROR", `❌ Build process failed: ${err.message}`);
      return { success: false, exitCode: err.code || 1, outputDir, durationMs };
    }
  }
}

export const workerDocker = new WorkerDockerService();
