import { Router, Request, Response } from "express";
import { prisma } from "@netlaunch/database";
import { GitHubOAuthService } from "../services/githubOAuth";
import { JwtService } from "../services/jwt";
import { requireAuth } from "../middlewares/auth";
import { authLimiter } from "../middlewares/rateLimiter";
import { env } from "../config/env";

const router: Router = Router();

// Initiate GitHub OAuth Login
router.get("/github", authLimiter, (req: Request, res: Response) => {
  const authUrl = GitHubOAuthService.getAuthorizationUrl();
  return res.redirect(authUrl);
});

// GitHub OAuth Callback
router.get("/github/callback", authLimiter, async (req: Request, res: Response, next) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      return res.status(400).redirect(`${env.CLIENT_URL}/login?error=missing_code`);
    }

    // Exchange authorization code for GitHub access token
    const accessToken = await GitHubOAuthService.exchangeCodeForToken(code);
    const profile = await GitHubOAuthService.fetchUserProfile(accessToken);

    // Upsert user in database
    const user = await prisma.user.upsert({
      where: { githubId: String(profile.id) },
      update: {
        email: profile.email || `${profile.login}@users.noreply.github.com`,
        name: profile.name || profile.login,
        avatarUrl: profile.avatar_url,
        githubUsername: profile.login,
      },
      create: {
        githubId: String(profile.id),
        email: profile.email || `${profile.login}@users.noreply.github.com`,
        name: profile.name || profile.login,
        avatarUrl: profile.avatar_url,
        githubUsername: profile.login,
      },
    });

    // Generate JWT Session Token
    const sessionToken = JwtService.generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      githubId: user.githubId,
      githubUsername: user.githubUsername,
    });

    // Set secure HTTP-Only Cookie
    JwtService.setSessionCookie(res, sessionToken);

    console.log(`🔐 [Auth] User logged in: ${user.githubUsername} (${user.id})`);
    return res.redirect(`${env.CLIENT_URL}/dashboard`);
  } catch (error: any) {
    console.error("❌ [OAuth Callback Error]:", error.message);
    return res.redirect(`${env.CLIENT_URL}/login?error=oauth_failed`);
  }
});

// Get Current Authenticated User Session
router.get("/me", requireAuth, (req: Request, res: Response) => {
  return res.json({
    success: true,
    data: req.user,
  });
});

// Logout
router.post("/logout", (req: Request, res: Response) => {
  JwtService.clearSessionCookie(res);
  return res.json({
    success: true,
    message: "Logged out successfully",
  });
});

export default router;
