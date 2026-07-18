import jwt from "jsonwebtoken";
import axios from "axios";
import { env } from "../config/env";

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  language: string | null;
  updated_at: string;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

export class GitHubAppService {
  public static getAppInstallationUrl(): string {
    return `https://github.com/apps/netlaunch-app/installations/new`;
  }

  public static generateAppJwt(): string {
    if (env.GITHUB_APP_PRIVATE_KEY.includes("mockPrivateKey") || !env.GITHUB_APP_PRIVATE_KEY) {
      return "mock_app_jwt_token";
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iat: now - 60, // Issued 60 seconds ago to account for clock drift
      exp: now + 10 * 60, // Expires in 10 minutes (maximum allowed by GitHub)
      iss: env.GITHUB_APP_ID,
    };

    return jwt.sign(payload, env.GITHUB_APP_PRIVATE_KEY, { algorithm: "RS256" });
  }

  public static async getInstallationAccessToken(installationId: bigint | number): Promise<string> {
    if (env.GITHUB_APP_CLIENT_ID.startsWith("mock_")) {
      return `mock_installation_token_${installationId}`;
    }

    const appJwt = this.generateAppJwt();
    const response = await axios.post(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {},
      {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    return response.data.token;
  }

  public static async fetchAccessibleRepositories(installationId: bigint | number): Promise<GitHubRepo[]> {
    if (env.GITHUB_APP_CLIENT_ID.startsWith("mock_")) {
      // Return realistic mock repositories for local testing when no live GitHub credentials exist
      return [
        {
          id: 10101010,
          name: "next-portfolio",
          full_name: "alexrivera/next-portfolio",
          private: false,
          html_url: "https://github.com/alexrivera/next-portfolio",
          description: "Stunning developer portfolio built with Next.js 15 and Tailwind CSS",
          default_branch: "main",
          language: "TypeScript",
          updated_at: new Date().toISOString(),
        },
        {
          id: 20202020,
          name: "cyber-analytics",
          full_name: "alexrivera/cyber-analytics",
          private: true,
          html_url: "https://github.com/alexrivera/cyber-analytics",
          description: "Enterprise threat intelligence analytics platform with Vite + React 19",
          default_branch: "main",
          language: "TypeScript",
          updated_at: new Date().toISOString(),
        },
        {
          id: 30303030,
          name: "ai-prompt-studio",
          full_name: "alexrivera/ai-prompt-studio",
          private: false,
          html_url: "https://github.com/alexrivera/ai-prompt-studio",
          description: "Generative AI prompt engineering workspace and testing harness",
          default_branch: "main",
          language: "JavaScript",
          updated_at: new Date().toISOString(),
        },
        {
          id: 40404040,
          name: "static-docs-hub",
          full_name: "alexrivera/static-docs-hub",
          private: false,
          html_url: "https://github.com/alexrivera/static-docs-hub",
          description: "Clean HTML/CSS static documentation portal for cloud APIs",
          default_branch: "master",
          language: "HTML",
          updated_at: new Date().toISOString(),
        },
      ];
    }

    const token = await this.getInstallationAccessToken(installationId);
    const response = await axios.get("https://api.github.com/installation/repositories", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    return response.data.repositories.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      html_url: repo.html_url,
      description: repo.description,
      default_branch: repo.default_branch,
      language: repo.language,
      updated_at: repo.updated_at,
    }));
  }

  public static async fetchRepositoryBranches(installationId: bigint | number, owner: string, repo: string): Promise<GitHubBranch[]> {
    if (env.GITHUB_APP_CLIENT_ID.startsWith("mock_")) {
      return [
        { name: "main", commit: { sha: "e4f9b2d8a1c78e90123456789abcdef012345678", url: "" } },
        { name: "dev", commit: { sha: "f5e8c1b9d2a3456789abcdef0123456789012345", url: "" } },
        { name: "feature/glass-ui", commit: { sha: "a1b2c3d4e5f67890123456789abcdef012345678", url: "" } },
      ];
    }

    const token = await this.getInstallationAccessToken(installationId);
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/branches`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    return response.data.map((b: any) => ({
      name: b.name,
      commit: {
        sha: b.commit.sha,
        url: b.commit.url,
      },
    }));
  }
}
