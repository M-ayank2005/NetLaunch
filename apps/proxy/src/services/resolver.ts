import Redis from "ioredis";
import { prisma, DeploymentStatus } from "@netlaunch/database";
import { env } from "../config/env";
import { ResolvedDeployment } from "../types";

export class ProxyResolverService {
  private redis: Redis;
  private readonly CACHE_TTL_SECONDS = 60; // 1 minute local edge resolution cache

  constructor() {
    this.redis = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
    });
  }

  /**
   * Resolve an incoming HTTP Host header (subdomain or custom domain) to its active deployment artifact
   */
  async resolveHost(hostHeader?: string): Promise<ResolvedDeployment | null> {
    if (!hostHeader) return null;

    // Remove port if present (e.g., portfolio.netlaunch.localhost:8080 -> portfolio.netlaunch.localhost)
    const cleanHost = hostHeader.split(":")[0].toLowerCase().trim();

    // Check Redis LRU cache
    const cacheKey = `proxy:host:${cleanHost}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as ResolvedDeployment;
      }
    } catch (err) {
      console.warn(`⚠️ [ProxyResolver] Redis cache read error for host '${cleanHost}':`, err);
    }

    // 1. Try matching verified custom Domain record exactly
    const domainRecord = await prisma.domain.findUnique({
      where: { name: cleanHost },
      include: {
        project: {
          include: {
            deployments: {
              where: { status: DeploymentStatus.READY },
              orderBy: { finishedAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (domainRecord && domainRecord.project && domainRecord.project.deployments.length > 0) {
      const latestDeployment = domainRecord.project.deployments[0];
      if (latestDeployment.artifactPath) {
        const resolved: ResolvedDeployment = {
          deploymentId: latestDeployment.id,
          projectId: domainRecord.project.id,
          projectName: domainRecord.project.name,
          artifactPath: latestDeployment.artifactPath,
          isCustomDomain: true,
        };
        await this.cacheResolution(cacheKey, resolved);
        return resolved;
      }
    }

    // 2. Try matching automatic wildcard subdomain
    // E.g. next-portfolio.netlaunch.localhost -> next-portfolio
    let subdomain = cleanHost;
    if (cleanHost.endsWith(`.${env.BASE_DOMAIN}`)) {
      subdomain = cleanHost.slice(0, -(env.BASE_DOMAIN.length + 1));
    } else if (cleanHost.endsWith(".netlaunch.app")) {
      subdomain = cleanHost.slice(0, -".netlaunch.app".length);
    } else if (cleanHost.endsWith(".localhost")) {
      subdomain = cleanHost.slice(0, -".localhost".length);
    }

    // Look up project by name
    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { name: subdomain },
          { id: subdomain },
        ],
      },
      include: {
        deployments: {
          where: { status: DeploymentStatus.READY },
          orderBy: { finishedAt: "desc" },
          take: 1,
        },
      },
    });

    if (project && project.deployments.length > 0) {
      const latestDeployment = project.deployments[0];
      if (latestDeployment.artifactPath) {
        const resolved: ResolvedDeployment = {
          deploymentId: latestDeployment.id,
          projectId: project.id,
          projectName: project.name,
          artifactPath: latestDeployment.artifactPath,
          isCustomDomain: false,
        };
        await this.cacheResolution(cacheKey, resolved);
        return resolved;
      }
    }

    return null;
  }

  private async cacheResolution(key: string, data: ResolvedDeployment): Promise<void> {
    try {
      await this.redis.setex(key, this.CACHE_TTL_SECONDS, JSON.stringify(data));
    } catch (err) {
      console.warn(`⚠️ [ProxyResolver] Failed to write cache key '${key}':`, err);
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export const proxyResolver = new ProxyResolverService();
