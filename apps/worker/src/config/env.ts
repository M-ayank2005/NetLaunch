import dotenv from "dotenv";
import path from "path";

// Load root .env from workspace root whether running from src/config or dist/config
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: parseInt(process.env.REDIS_PORT || "6379", 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || "netlaunch_redis_pass_2026",

  // MinIO / S3 Object Storage
  S3_ENDPOINT: process.env.STORAGE_ENDPOINT || process.env.S3_ENDPOINT || "http://localhost:9000",
  S3_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY || process.env.S3_ACCESS_KEY || "netlaunch_minio_admin",
  S3_SECRET_KEY: process.env.STORAGE_SECRET_KEY || process.env.S3_SECRET_KEY || "netlaunch_minio_secret_2026",
  S3_BUCKET: process.env.STORAGE_BUCKET_ARTIFACTS || process.env.S3_BUCKET || "netlaunch-artifacts",
  S3_REGION: process.env.STORAGE_REGION || process.env.S3_REGION || "us-east-1",

  // Local build sandbox directory
  BUILD_WORKSPACE_DIR: process.env.BUILD_WORKSPACE_DIR || path.resolve(__dirname, "../../../tmp/builds"),

  // Docker socket / builder image
  DOCKER_BUILDER_IMAGE: process.env.DOCKER_BUILDER_IMAGE || "node:20-alpine",

  // GitHub App credentials for Installation Access Tokens
  GITHUB_APP_ID: process.env.GITHUB_APP_ID || "",
  GITHUB_APP_PRIVATE_KEY: (process.env.GITHUB_APP_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
};
