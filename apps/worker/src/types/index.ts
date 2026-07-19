export interface DeploymentJobPayload {
  deploymentId: string;
  projectId: string;
  userId: string;
}

export interface BuildLogEntry {
  deploymentId: string;
  level: "INFO" | "WARN" | "ERROR" | "COMMAND";
  message: string;
  timestamp: Date;
}

export interface ContainerBuildResult {
  success: boolean;
  exitCode: number;
  outputDir: string;
  durationMs: number;
}
