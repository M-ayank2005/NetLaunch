import axios from "axios";
import { env } from "../config/env";

export interface GitHubUserProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

export class GitHubOAuthService {
  public static getAuthorizationUrl(): string {
    const scopes = ["read:user", "user:email"].join(" ");
    return `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(env.GITHUB_CALLBACK_URL)}&scope=${scopes}`;
  }

  public static async exchangeCodeForToken(code: string): Promise<string> {
    if (env.GITHUB_CLIENT_ID.startsWith("mock_")) {
      // Return mock access token during local development without live app credentials
      return "mock_github_access_token_2026";
    }

    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: env.GITHUB_CALLBACK_URL,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (response.data.error) {
      throw new Error(`GitHub OAuth Error: ${response.data.error_description || response.data.error}`);
    }

    return response.data.access_token;
  }

  public static async fetchUserProfile(accessToken: string): Promise<GitHubUserProfile> {
    if (accessToken.startsWith("mock_")) {
      return {
        id: 99887766,
        login: "alexrivera",
        name: "Alex Rivera (Lead Engineer)",
        avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
        email: "alex@netlaunch.app",
      };
    }

    const [userRes, emailRes] = await Promise.all([
      axios.get("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      axios.get("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    const primaryEmailObj = emailRes.data.find((e: any) => e.primary && e.verified) || emailRes.data[0];
    const email = primaryEmailObj ? primaryEmailObj.email : userRes.data.email;

    return {
      id: userRes.data.id,
      login: userRes.data.login,
      name: userRes.data.name,
      avatar_url: userRes.data.avatar_url,
      email: email || `${userRes.data.login}@users.noreply.github.com`,
    };
  }
}
