import { Worker, Job } from "bullmq";
import { prisma, DeploymentStatus } from "@netlaunch/database";
import { env } from "../config/env";
import { DeploymentJobPayload } from "../types";
import { workerLogger } from "./logger";
import { workerGit } from "./git";
import { workerDocker } from "./docker";
import { workerMinio } from "./minio";

const QUEUE_NAME = "deployment-build-queue";

export class DeploymentWorkerService {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(
      QUEUE_NAME,
      async (job: Job<DeploymentJobPayload>) => {
        await this.processDeploymentJob(job.data);
      },
      {
        connection: {
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          password: env.REDIS_PASSWORD || undefined,
        },
        concurrency: 2, // Process up to 2 concurrent builds per worker node
      }
    );

    this.worker.on("ready", () => {
      console.log(`👷 [BullMQ Worker] Listening on queue '${QUEUE_NAME}' (Concurrency: 2)`);
    });

    this.worker.on("completed", (job) => {
      console.log(`✓ [BullMQ Worker] Job ${job.id} completed successfully`);
    });

    this.worker.on("failed", (job, err) => {
      console.error(`❌ [BullMQ Worker] Job ${job?.id} failed with error:`, err.message);
    });
  }

  private async processDeploymentJob(payload: DeploymentJobPayload): Promise<void> {
    const { deploymentId, projectId, userId } = payload;

    // 1. Fetch deployment & project details
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        project: {
          include: {
            envVars: true,
          },
        },
      },
    });

    if (!deployment || !deployment.project) {
      console.error(`❌ Deployment or project not found for ID: ${deploymentId}`);
      return;
    }

    const project = deployment.project;

    // Mark deployment as BUILDING
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: DeploymentStatus.BUILDING,
        startedAt: new Date(),
      },
    });

    await workerLogger.log(
      deploymentId,
      "COMMAND",
      `⚡ NetLaunch Worker #01 popped job from BullMQ queue ('${QUEUE_NAME}'). Initializing build...`
    );

    try {
      // 2. Clone repository into local workspace
      const branch = deployment.branch || project.defaultBranch;
      const workspaceDir = await workerGit.cloneRepository(
        deploymentId,
        project.id,
        project.repoFullName,
        branch,
        project.installationId
      );

      // 3. Prepare environment variables map
      const envVarsMap: Record<string, string> = {};
      for (const ev of project.envVars) {
        // Include env var if target matches PRODUCTION or PREVIEW
        envVarsMap[ev.key] = ev.value;
      }

      // 4. Run build inside isolated container sandbox
      const installCmd = project.installCommand || "npm install";
      const buildCmd = project.buildCommand || "npm run build";
      const outputDir = project.outputDirectory || "dist";

      const buildResult = await workerDocker.runBuildContainer(
        deploymentId,
        workspaceDir,
        installCmd,
        buildCmd,
        outputDir,
        envVarsMap
      );

      if (!buildResult.success) {
        throw new Error(`Build step returned non-zero exit code: ${buildResult.exitCode}`);
      }

      // 5. Package and upload artifacts to MinIO/S3
      await workerMinio.packageAndUploadArtifact(
        deploymentId,
        project.id,
        workspaceDir,
        buildResult.outputDir,
        buildResult.durationMs
      );
    } catch (error: any) {
      // Mark deployment FAILED and clean up gracefully
      await workerLogger.log(deploymentId, "ERROR", `❌ Deployment terminated with fatal error: ${error.message}`);
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: DeploymentStatus.FAILED,
          finishedAt: new Date(),
        },
      });
    }
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}

export const deploymentWorker = new DeploymentWorkerService();
