export interface ResolvedDeployment {
  deploymentId: string;
  projectId: string;
  projectName: string;
  artifactPath: string;
  isCustomDomain: boolean;
}

export interface ExtractedArtifactCacheEntry {
  deploymentId: string;
  extractedPath: string;
  lastAccessedAt: number;
  sizeBytes: number;
}
