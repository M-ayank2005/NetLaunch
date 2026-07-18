import { Request, Response, NextFunction } from "express";
import { AuthSessionUser } from "@netlaunch/shared";
import { JwtService } from "../services/jwt";
import { env } from "../config/env";
import { prisma } from "@netlaunch/database";

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthSessionUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.[env.SESSION_COOKIE_NAME];

    // Fallback to Authorization Bearer header
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing authentication token" });
    }

    const decoded = JwtService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, error: "Unauthorized: Invalid or expired session token" });
    }

    // Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, avatarUrl: true, githubId: true, githubUsername: true },
    });

    if (!user) {
      JwtService.clearSessionCookie(res);
      return res.status(401).json({ success: false, error: "Unauthorized: User account no longer exists" });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, error: "Internal authentication verification error" });
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.[env.SESSION_COOKIE_NAME];
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (token) {
      const decoded = JwtService.verifyToken(token);
      if (decoded) req.user = decoded;
    }
    return next();
  } catch {
    return next();
  }
}
