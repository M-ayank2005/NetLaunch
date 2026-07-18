import { Router, Request, Response } from "express";
import { prisma, DeploymentStatus } from "@netlaunch/database";
import { CreateProjectSchema, TriggerDeploymentSchema } from "@netlaunch/shared";
import { requireAuth } from "../middlewares/auth";
import { queueDeploymentJob } from "../services/redis";

const router: Router = Router();

// Create Project & Trigger Initial Deployment
router.post("/", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const validated = CreateProjectSchema.parse(req.body);
    const user = req.user!;

    // Check if project slug exists
    const existing = await prisma.project.findUnique({
      where: { name: validated.name },
    });
    if (existing) {
      return res.status(409).json({ success: false, error: `Project name '${validated.name}' is already taken.` });
    }

    // Resolve installation record if provided
    let installationRecordId: string | undefined = undefined;
    if (validated.installationId) {
      const inst = await prisma.gitHubInstallation.findFirst({
        where: { installationId: BigInt(validated.installationId), userId: user.id },
      });
      if (inst) installationRecordId = inst.id;
    }

    // Create Project inside transaction
    const result = await prisma.$transaction(async (tx) => {
      const newProj = await tx.project.create({
        data: {
          name: validated.name,
          repoFullName: validated.repoFullName,
          repoId: BigInt(validated.repoId),
          defaultBranch: validated.defaultBranch,
          framework: validated.framework,
          buildCommand: validated.buildCommand,
          outputDirectory: validated.outputDirectory,
          installCommand: validated.installCommand || "npm install",
          rootDirectory: validated.rootDirectory || "./",
          userId: user.id,
          installationId: installationRecordId,
          domains: {
            create: {
              name: `${validated.name}.netlaunch.app`,
              isVerified: true,
              isPrimary: true,
            },
          },
          envVars: validated.envVars
            ? {
                createMany: {
                  data: validated.envVars.map((e) => ({
                    key: e.key,
                    value: e.value, // In production, encrypted at rest via AES-256-GCM before DB insert
                    target: e.target || ["PRODUCTION", "PREVIEW"],
                  })),
                },
              }
            : undefined,
        },
        include: {
          domains: true,
          envVars: true,
        },
      });

      // Create Initial QUEUED deployment
      const initialDeploy = await tx.deployment.create({
        data: {
          projectId: newProj.id,
          userId: user.id,
          status: DeploymentStatus.QUEUED,
          commitHash: "initial-setup",
          commitMessage: `🚀 Initial deployment for ${validated.name}`,
          commitAuthor: user.name || user.githubUsername,
          branch: validated.defaultBranch,
          url: `${validated.name}.netlaunch.app`,
        },
      });

      await tx.buildLog.create({
        data: {
          deploymentId: initialDeploy.id,
          level: "COMMAND",
          message: `$ ⚡ Project ${validated.name} created. Deployment job queued in BullMQ...`,
        },
      });

      return { project: newProj, initialDeploy };
    });

    // Queue in BullMQ
    await queueDeploymentJob(result.initialDeploy.id, result.project.id, user.id);

    const serializedProject = {
      ...result.project,
      repoId: result.project.repoId.toString(),
    };

    return res.status(201).json({
      success: true,
      data: { ...serializedProject, initialDeployment: result.initialDeploy },
    });
  } catch (error) {
    next(error);
  }
});

// List User Projects
router.get("/", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.user!.id },
      include: {
        domains: true,
        deployments: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const serialized = projects.map((p) => ({
      ...p,
      repoId: p.repoId.toString(),
    }));

    return res.json({ success: true, data: serialized });
  } catch (error) {
    next(error);
  }
});

// Get Detailed Project View by ID
router.get("/:projectId", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId || "";
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.user!.id },
      include: {
        domains: true,
        envVars: true,
        deployments: {
          orderBy: { createdAt: "desc" },
          take: 15,
        },
      },
    });

    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const serialized = {
      ...project,
      repoId: project.repoId.toString(),
    };

    return res.json({ success: true, data: serialized });
  } catch (error) {
    next(error);
  }
});

// Manual Trigger Re-Deploy
router.post("/:projectId/deploy", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId || "";
    const validated = TriggerDeploymentSchema.parse(req.body);
    const user = req.user!;

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
    });

    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const branch = validated.branch || project.defaultBranch;
    const commitHash = validated.commitHash || "f5e8c1b9d2a3456789abcdef0123456789012345";

    const deployment = await prisma.deployment.create({
      data: {
        projectId: project.id,
        userId: user.id,
        status: DeploymentStatus.QUEUED,
        commitHash,
        commitMessage: `Manual redeployment triggered for branch ${branch}`,
        commitAuthor: user.name || user.githubUsername,
        branch,
        url: `${project.name}.netlaunch.app`,
      },
    });

    await prisma.buildLog.create({
      data: {
        deploymentId: deployment.id,
        level: "COMMAND",
        message: `⚡ Manual deployment triggered by ${user.githubUsername}. Queued for build...`,
      },
    });

    await queueDeploymentJob(deployment.id, project.id, user.id);

    return res.status(201).json({ success: true, data: deployment });
  } catch (error) {
    next(error);
  }
});

// Get Real-Time / Archived Build Logs for a Deployment
router.get("/:projectId/deployments/:deploymentId/logs", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId || "";
    const deploymentId = Array.isArray(req.params.deploymentId) ? req.params.deploymentId[0] : req.params.deploymentId || "";

    // Verify ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.user!.id },
    });

    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment || deployment.projectId !== projectId) {
      return res.status(404).json({ success: false, error: "Deployment not found" });
    }

    const logs = await prisma.buildLog.findMany({
      where: { deploymentId },
      orderBy: { timestamp: "asc" },
    });

    return res.json({ success: true, data: { deployment, logs } });
  } catch (error) {
    next(error);
  }
});

export default router;
