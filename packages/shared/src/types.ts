// ==========================================
// NetLaunch Shared Types & Constants
// ==========================================

export enum ProjectFramework {
  NEXT = "NEXT",
  VITE = "VITE",
  REACT = "REACT",
  STATIC = "STATIC",
  NODE = "NODE",
}

export enum DeploymentStatus {
  QUEUED = "QUEUED",
  BUILDING = "BUILDING",
  READY = "READY",
  FAILED = "FAILED",
  CANCELED = "CANCELED",
}

export enum BuildLogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  COMMAND = "COMMAND",
}

export interface AuthSessionUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  githubId: string;
  githubUsername: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface FrameworkPresets {
  label: string;
  buildCommand: string;
  outputDirectory: string;
  installCommand: string;
}

export const FRAMEWORK_DEFAULT_PRESETS: Record<ProjectFramework, FrameworkPresets> = {
  [ProjectFramework.NEXT]: {
    label: "Next.js",
    buildCommand: "npm run build",
    outputDirectory: ".next",
    installCommand: "npm install",
  },
  [ProjectFramework.VITE]: {
    label: "Vite / React",
    buildCommand: "npm run build",
    outputDirectory: "dist",
    installCommand: "npm install",
  },
  [ProjectFramework.REACT]: {
    label: "Create React App",
    buildCommand: "npm run build",
    outputDirectory: "build",
    installCommand: "npm install",
  },
  [ProjectFramework.STATIC]: {
    label: "Static HTML/CSS/JS",
    buildCommand: "",
    outputDirectory: ".",
    installCommand: "",
  },
  [ProjectFramework.NODE]: {
    label: "Node.js Server",
    buildCommand: "npm run build",
    outputDirectory: "dist",
    installCommand: "npm install",
  },
};
