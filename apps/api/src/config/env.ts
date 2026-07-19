import dotenv from "dotenv";
import path from "path";

// Load root .env from workspace root whether running from src/config or dist/config
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "4000", 10),
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",
  
  REDIS_HOST: process.env.REDIS_HOST || "localhost",
  REDIS_PORT: parseInt(process.env.REDIS_PORT || "6379", 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || "netlaunch_redis_pass_2026",

  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || "",
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || "",
  GITHUB_CALLBACK_URL: process.env.GITHUB_CALLBACK_URL || "http://localhost:4000/api/v1/auth/github/callback",

  GITHUB_APP_ID: process.env.GITHUB_APP_ID || "",
  GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID || "",
  GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET || "",
  GITHUB_APP_PRIVATE_KEY: (process.env.GITHUB_APP_PRIVATE_KEY || "").replace(/\\n/g, "\n"),

  JWT_SECRET: process.env.JWT_SECRET || "super_secret_netlaunch_jwt_key_2026",
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME || "netlaunch_session",
};
