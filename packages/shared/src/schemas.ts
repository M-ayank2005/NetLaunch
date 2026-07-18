import { z } from "zod";
import { ProjectFramework } from "./types";

export const CreateProjectSchema = z.object({
  name: z
    .string()
    .min(3, "Project name must be at least 3 characters")
    .max(40, "Project name cannot exceed 40 characters")
    .regex(/^[a-z0-9-]+$/, "Project name can only contain lowercase letters, numbers, and hyphens"),
  repoFullName: z.string().min(3, "Repository full name is required (e.g., owner/repo)"),
  repoId: z.union([z.number(), z.string(), z.bigint()]).transform((val) => BigInt(val)),
  defaultBranch: z.string().default("main"),
  framework: z.nativeEnum(ProjectFramework).default(ProjectFramework.NEXT),
  buildCommand: z.string().optional(),
  outputDirectory: z.string().optional(),
  installCommand: z.string().optional(),
  rootDirectory: z.string().default("./"),
  installationId: z.string().optional(),
  envVars: z
    .array(
      z.object({
        key: z.string().min(1, "Variable key required"),
        value: z.string(),
        target: z.array(z.string()).default(["PRODUCTION", "PREVIEW"]),
      })
    )
    .optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateEnvVarSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  target: z.array(z.string()).default(["PRODUCTION", "PREVIEW"]),
});

export type UpdateEnvVarInput = z.infer<typeof UpdateEnvVarSchema>;

export const TriggerDeploymentSchema = z.object({
  branch: z.string().optional(),
  commitHash: z.string().optional(),
});

export type TriggerDeploymentInput = z.infer<typeof TriggerDeploymentSchema>;
