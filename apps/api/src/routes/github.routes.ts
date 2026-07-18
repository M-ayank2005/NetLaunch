import { Router, Request, Response } from "express";
import { prisma } from "@netlaunch/database";
import { GitHubAppService } from "../services/githubApp";
import { requireAuth } from "../middlewares/auth";
import { env } from "../config/env";

const router: Router = Router();

// Redirect to GitHub App Installation Page
router.get("/install", requireAuth, (req: Request, res: Response) => {
  const url = GitHubAppService.getAppInstallationUrl();
  return res.redirect(url);
});

// GitHub App Installation Callback
router.get("/setup-callback", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const installationIdStr = req.query.installation_id as string;
    if (!installationIdStr) {
      return res.status(400).redirect(`${env.CLIENT_URL}/new?error=missing_installation_id`);
    }

    const installationId = BigInt(installationIdStr);
    const user = req.user!;

    // Save or update GitHub Installation record
    await prisma.gitHubInstallation.upsert({
      where: { installationId },
      update: {
        userId: user.id,
        accountLogin: user.githubUsername,
        accountType: "User",
        accountAvatar: user.avatarUrl,
      },
      create: {
        installationId,
        userId: user.id,
        accountLogin: user.githubUsername,
        accountType: "User",
        accountAvatar: user.avatarUrl,
      },
    });

    console.log(`🔗 [GitHub App] Registered installation ${installationId} for user ${user.githubUsername}`);
    return res.redirect(`${env.CLIENT_URL}/new?installationId=${installationIdStr}`);
  } catch (error) {
    next(error);
  }
});

// List Connected GitHub App Installations for Current User
router.get("/installations", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const installations = await prisma.gitHubInstallation.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });

    // Convert BigInt IDs to string for clean JSON serialization
    const serialized = installations.map((inst) => ({
      ...inst,
      installationId: inst.installationId.toString(),
    }));

    return res.json({ success: true, data: serialized });
  } catch (error) {
    next(error);
  }
});

// List Repositories Accessible by a Specific Installation
router.get("/repositories", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const installationIdStr = req.query.installationId as string;
    if (!installationIdStr) {
      return res.status(400).json({ success: false, error: "installationId query parameter required" });
    }

    const installationId = BigInt(installationIdStr);
    
    // Verify user owns this installation
    const installation = await prisma.gitHubInstallation.findFirst({
      where: { installationId, userId: req.user!.id },
    });

    if (!installation && !env.GITHUB_APP_CLIENT_ID.startsWith("mock_")) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have access to this GitHub installation" });
    }

    const repos = await GitHubAppService.fetchAccessibleRepositories(installationId);
    return res.json({ success: true, data: repos });
  } catch (error) {
    next(error);
  }
});

// List Branches for a Repository
router.get("/branches", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const installationIdStr = req.query.installationId as string;
    const owner = req.query.owner as string;
    const repo = req.query.repo as string;

    if (!installationIdStr || !owner || !repo) {
      return res.status(400).json({ success: false, error: "Missing required query params: installationId, owner, repo" });
    }

    const branches = await GitHubAppService.fetchRepositoryBranches(BigInt(installationIdStr), owner, repo);
    return res.json({ success: true, data: branches });
  } catch (error) {
    next(error);
  }
});

export default router;
