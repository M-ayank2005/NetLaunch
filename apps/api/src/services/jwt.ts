import jwt from "jsonwebtoken";
import { Response } from "express";
import { AuthSessionUser } from "@netlaunch/shared";
import { env } from "../config/env";

export class JwtService {
  public static generateToken(user: AuthSessionUser): string {
    return jwt.sign(user, env.JWT_SECRET, {
      expiresIn: "7d",
    });
  }

  public static verifyToken(token: string): AuthSessionUser | null {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthSessionUser;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  public static setSessionCookie(res: Response, token: string): void {
    res.cookie(env.SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });
  }

  public static clearSessionCookie(res: Response): void {
    res.clearCookie(env.SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
  }
}
