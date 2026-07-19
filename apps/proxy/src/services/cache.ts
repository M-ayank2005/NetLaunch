import fs from "fs";
import path from "path";
import zlib from "zlib";
import tar from "tar-fs";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { env } from "../config/env";
import { ResolvedDeployment, ExtractedArtifactCacheEntry } from "../types";

export class ProxyCacheService {
  private s3: S3Client;
  private cacheMap: Map<string, ExtractedArtifactCacheEntry> = new Map();
  private pendingExtractions: Map<string, Promise<string>> = new Map();
  private readonly MAX_CACHE_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB limit before LRU eviction

  constructor() {
    this.s3 = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });

    // Ensure cache base dir exists
    if (!fs.existsSync(env.PROXY_CACHE_DIR)) {
      fs.mkdirSync(env.PROXY_CACHE_DIR, { recursive: true });
    }
  }

  /**
   * Get the absolute local directory path where the deployment artifact is extracted ready for serving.
   * If not already extracted, downloads from MinIO S3 and extracts on the fly!
   */
  async getExtractedPath(deployment: ResolvedDeployment): Promise<string> {
    const { deploymentId, artifactPath } = deployment;
    const targetDir = path.join(env.PROXY_CACHE_DIR, deploymentId);

    // 1. Check if already extracted on disk and tracked in memory
    if (fs.existsSync(targetDir) && this.cacheMap.has(deploymentId)) {
      const entry = this.cacheMap.get(deploymentId)!;
      entry.lastAccessedAt = Date.now();
      return targetDir;
    }

    // If directory exists on disk from a previous run but not in map, re-index it
    if (fs.existsSync(targetDir)) {
      const size = this.getDirectorySize(targetDir);
      this.cacheMap.set(deploymentId, {
        deploymentId,
        extractedPath: targetDir,
        lastAccessedAt: Date.now(),
        sizeBytes: size,
      });
      return targetDir;
    }

    // 2. De-duplicate concurrent extraction attempts for the exact same deploymentId
    if (this.pendingExtractions.has(deploymentId)) {
      return this.pendingExtractions.get(deploymentId)!;
    }

    const extractionPromise = this.extractFromStorage(deploymentId, artifactPath, targetDir);
    this.pendingExtractions.set(deploymentId, extractionPromise);

    try {
      const finalPath = await extractionPromise;
      return finalPath;
    } finally {
      this.pendingExtractions.delete(deploymentId);
    }
  }

  private async extractFromStorage(deploymentId: string, artifactPath: string, targetDir: string): Promise<string> {
    console.log(`⬇️ [ProxyCache] Downloading artifact bundle for deployment ${deploymentId} (${artifactPath})...`);

    const tempDir = `${targetDir}_staging_${Date.now()}`;
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      let readStream: NodeJS.ReadableStream;

      if (artifactPath.startsWith("s3://")) {
        // e.g. s3://netlaunch-artifacts/projId/deployId.tar.gz
        const parts = artifactPath.replace("s3://", "").split("/");
        const bucket = parts.shift()!;
        const key = parts.join("/");

        const s3Response = await this.s3.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          })
        );

        if (!s3Response.Body) {
          throw new Error(`Empty response body received from S3 object ${artifactPath}`);
        }
        readStream = s3Response.Body as unknown as NodeJS.ReadableStream;
      } else if (artifactPath.startsWith("file://")) {
        const localFile = artifactPath.replace("file://", "");
        if (!fs.existsSync(localFile)) {
          throw new Error(`Local artifact archive file not found: ${localFile}`);
        }
        readStream = fs.createReadStream(localFile);
      } else {
        throw new Error(`Unsupported artifact storage protocol: ${artifactPath}`);
      }

      // Pipe Gunzip -> tar.extract
      await new Promise<void>((resolve, reject) => {
        const gunzip = zlib.createGunzip();
        const extract = tar.extract(tempDir);

        readStream.pipe(gunzip).pipe(extract);

        extract.on("finish", () => resolve());
        extract.on("error", (err) => reject(err));
        gunzip.on("error", (err) => reject(err));
      });

      // Atomic rename of staging folder to target directory
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
      fs.renameSync(tempDir, targetDir);

      const size = this.getDirectorySize(targetDir);
      this.cacheMap.set(deploymentId, {
        deploymentId,
        extractedPath: targetDir,
        lastAccessedAt: Date.now(),
        sizeBytes: size,
      });

      console.log(`✓ [ProxyCache] Extraction completed for ${deploymentId} (${(size / 1024 / 1024).toFixed(2)} MB)`);
      this.enforceLruEvictionPolicy();

      return targetDir;
    } catch (err) {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      throw err;
    }
  }

  private getDirectorySize(dirPath: string): number {
    let totalSize = 0;
    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          totalSize += this.getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (e) {
      /* ignore stat errors */
    }
    return totalSize;
  }

  private enforceLruEvictionPolicy(): void {
    let totalCacheBytes = Array.from(this.cacheMap.values()).reduce((acc, entry) => acc + entry.sizeBytes, 0);

    if (totalCacheBytes <= this.MAX_CACHE_SIZE_BYTES) return;

    console.log(`🧹 [ProxyCache] Cache size (${(totalCacheBytes / 1024 / 1024).toFixed(2)} MB) exceeds 5GB threshold. Evicting LRU entries...`);

    // Sort entries by least recently accessed
    const sortedEntries = Array.from(this.cacheMap.values()).sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

    for (const entry of sortedEntries) {
      if (totalCacheBytes <= this.MAX_CACHE_SIZE_BYTES * 0.8) break; // Prune down to 80% capacity

      try {
        if (fs.existsSync(entry.extractedPath)) {
          fs.rmSync(entry.extractedPath, { recursive: true, force: true });
        }
        this.cacheMap.delete(entry.deploymentId);
        totalCacheBytes -= entry.sizeBytes;
        console.log(`🗑️ Evicted cached deployment ${entry.deploymentId} (${(entry.sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
      } catch (err) {
        console.error(`❌ Failed to evict directory ${entry.extractedPath}:`, err);
      }
    }
  }
}

export const proxyCache = new ProxyCacheService();
