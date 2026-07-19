import dotenv from "dotenv";
import path from "path";

// Load root .env from workspace root whether running from src/config or dist/config
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PROXY_PORT: parseInt(process.env.PROXY_PORT || "8080", 10),
  BASE_DOMAIN: process.env.PROXY_BASE_DOMAIN || "netlaunch.localhost",

  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: parseInt(process.env.REDIS_PORT || "6379", 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || "netlaunch_redis_pass_2026",

  // MinIO / S3 Object Storage credentials for artifact fetching
  S3_ENDPOINT: process.env.STORAGE_ENDPOINT || process.env.S3_ENDPOINT || "http://localhost:9000",
  S3_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY || process.env.S3_ACCESS_KEY || "netlaunch_minio_admin",
  S3_SECRET_KEY: process.env.STORAGE_SECRET_KEY || process.env.S3_SECRET_KEY || "netlaunch_minio_secret_2026",
  S3_BUCKET: process.env.STORAGE_BUCKET_ARTIFACTS || process.env.S3_BUCKET || "netlaunch-artifacts",
  S3_REGION: process.env.STORAGE_REGION || process.env.S3_REGION || "us-east-1",

  // Local edge extraction directory
  PROXY_CACHE_DIR: process.env.PROXY_CACHE_DIR || path.resolve(__dirname, "../../../tmp/proxy-cache"),
};
