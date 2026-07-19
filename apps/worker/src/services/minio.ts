import fs from "fs";
import path from "path";
import zlib from "zlib";
import tar from "tar-fs";
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { prisma, DeploymentStatus } from "@netlaunch/database";
import { env } from "../config/env";
import { workerLogger } from "./logger";

export class WorkerMinioService {
  private s3: S3Client;

  constructor() {
    this.s3 = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: true, // Required for MinIO S3 compatibility
    });
  }

  /**
   * Compress build output folder into .tar.gz bundle and upload to MinIO/S3 object storage
   */
  async packageAndUploadArtifact(
    deploymentId: string,
    projectId: string,
    workspaceDir: string,
    outputDirName: string,
    buildDurationMs: number
  ): Promise<string> {
    let sourcePath = path.join(workspaceDir, outputDirName);

    // If output dir doesn't exist directly (e.g. user set wrong dir or static root index.html), find valid asset folder
    if (!fs.existsSync(sourcePath)) {
      if (fs.existsSync(path.join(workspaceDir, "index.html"))) {
        sourcePath = workspaceDir;
      } else if (fs.existsSync(path.join(workspaceDir, ".next"))) {
        sourcePath = path.join(workspaceDir, ".next");
      } else if (fs.existsSync(path.join(workspaceDir, "dist"))) {
        sourcePath = path.join(workspaceDir, "dist");
      } else if (fs.existsSync(path.join(workspaceDir, "build"))) {
        sourcePath = path.join(workspaceDir, "build");
      } else if (fs.existsSync(path.join(workspaceDir, "out"))) {
        sourcePath = path.join(workspaceDir, "out");
      } else {
        throw new Error(`Build output directory '${outputDirName}' not found inside ${workspaceDir}`);
      }
    }

    await workerLogger.log(deploymentId, "INFO", `📦 Compressing build output folder (${sourcePath}) into .tar.gz bundle...`);

    // Create temporary bundle path
    const archiveDir = path.resolve(__dirname, "../../../tmp/artifacts");
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
    const tarFilePath = path.join(archiveDir, `${deploymentId}.tar.gz`);

    // Pack into tar.gz stream
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(tarFilePath);
      const pack = tar.pack(sourcePath);
      const gzip = zlib.createGzip();

      pack.pipe(gzip).pipe(output);
      output.on("finish", () => resolve());
      output.on("error", (err) => reject(err));
      gzip.on("error", (err) => reject(err));
    });

    const stats = fs.statSync(tarFilePath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    await workerLogger.log(deploymentId, "INFO", `✓ Artifact bundle created (${sizeKB} KB). Uploading to MinIO bucket '${env.S3_BUCKET}'...`);

    const objectKey = `${projectId}/${deploymentId}.tar.gz`;
    let uploadedPath = `s3://${env.S3_BUCKET}/${objectKey}`;

    try {
      // Ensure bucket exists
      await this.ensureBucketExists();

      const fileStream = fs.createReadStream(tarFilePath);
      await this.s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: objectKey,
          Body: fileStream,
          ContentType: "application/gzip",
        })
      );

      await workerLogger.log(deploymentId, "INFO", `🚀 Artifact uploaded to MinIO successfully (${uploadedPath})`);
    } catch (s3Error: any) {
      await workerLogger.log(
        deploymentId,
        "WARN",
        `⚠️ MinIO S3 upload error (${s3Error.message}). Saving artifact bundle directly to persistent local disk...`
      );
      uploadedPath = `file://${tarFilePath}`;
    }

    // Clean up temporary workspace directory
    try {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    } catch (e) {
      /* ignore cleanup error */
    }

    // Update Deployment record status in database to READY
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: DeploymentStatus.READY,
        artifactPath: uploadedPath,
        durationMs: buildDurationMs,
        finishedAt: new Date(),
      },
    });

    await workerLogger.log(deploymentId, "INFO", `✨ Deployment job finished! Status marked as READY.`);
    return uploadedPath;
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
      } catch (err: any) {
        // Bucket creation might conflict if already being created simultaneously
        if (err.name !== "BucketAlreadyOwnedByYou" && err.name !== "BucketAlreadyExists") {
          throw err;
        }
      }
    }
  }
}

export const workerMinio = new WorkerMinioService();
