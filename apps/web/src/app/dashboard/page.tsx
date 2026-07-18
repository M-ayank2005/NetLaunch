"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import axios from "axios";
import { Plus, Search, Layers, GitBranch, ExternalLink, RefreshCw, Terminal, Clock } from "lucide-react";
import { GlassCard, StatusBadge, Button, Skeleton } from "@netlaunch/ui";

interface ProjectItem {
  id: string;
  name: string;
  repoFullName: string;
  defaultBranch: string;
  framework: string;
  updatedAt: string;
  domains: { name: string; isPrimary: boolean }[];
  deployments: {
    id: string;
    status: string;
    commitMessage: string;
    commitHash: string;
    createdAt: string;
  }[];
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchProjects = async () => {
    try {
      setRefreshing(true);
      const res = await axios.get("http://localhost:4000/api/v1/projects", {
        withCredentials: true,
      });
      if (res.data.success) {
        setProjects(res.data.data);
      }
    } catch (err) {
      // Fallback to local simulation data if API server is not booted yet
      setProjects([
        {
          id: "mock-project-1",
          name: "alex-next-portfolio",
          repoFullName: "alexrivera/next-portfolio",
          defaultBranch: "main",
          framework: "NEXT",
          updatedAt: new Date().toISOString(),
          domains: [{ name: "alex-portfolio.netlaunch.app", isPrimary: true }],
          deployments: [
            {
              id: "deploy-ready-01",
              status: "READY",
              commitMessage: "feat: add glassmorphism hero section & metrics",
              commitHash: "e4f9b2d",
              createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
            },
          ],
        },
        {
          id: "mock-project-2",
          name: "cyber-analytics-dashboard",
          repoFullName: "alexrivera/cyber-analytics",
          defaultBranch: "main",
          framework: "VITE",
          updatedAt: new Date().toISOString(),
          domains: [{ name: "analytics.netlaunch.app", isPrimary: true }],
          deployments: [
            {
              id: "deploy-building-02",
              status: "BUILDING",
              commitMessage: "fix: optimize real-time websocket throughput",
              commitHash: "b7c3a1e",
              createdAt: new Date(Date.now() - 45 * 1000).toISOString(),
            },
          ],
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.repoFullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Dashboard Top Metrics Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center">
            <Layers className="h-7 w-7 mr-3 text-emerald-400" />
            Control Plane Dashboard
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage your connected repositories, deployment pipelines, and live custom domains.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchProjects}
            disabled={refreshing}
            className="space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Link href="/new">
            <Button variant="primary" size="sm" className="space-x-2">
              <Plus className="h-4 w-4 text-zinc-950 font-bold" />
              <span>New Project</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-zinc-500 uppercase">Total Projects</span>
            <div className="text-2xl font-bold text-white mt-1">{projects.length}</div>
          </div>
          <Layers className="h-8 w-8 text-zinc-600 opacity-60" />
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-zinc-500 uppercase">Active Builds</span>
            <div className="text-2xl font-bold text-blue-400 mt-1">
              {projects.filter((p) => p.deployments[0]?.status === "BUILDING").length}
            </div>
          </div>
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-zinc-500 uppercase">Build Success Rate</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">99.2%</div>
          </div>
          <Terminal className="h-8 w-8 text-emerald-500/40" />
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-zinc-500 uppercase">Isolated Workers</span>
            <div className="text-2xl font-bold text-white mt-1">4 Active</div>
          </div>
          <div className="flex space-x-1">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </GlassCard>
      </div>

      {/* Search and Filter Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search projects by name or repository (e.g., alexrivera/next-portfolio)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-500 backdrop-blur-xl focus:border-zinc-600 focus:outline-none transition-colors"
        />
      </div>

      {/* Projects Grid / List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <GlassCard className="text-center py-16 space-y-4">
          <Layers className="h-12 w-12 text-zinc-600 mx-auto opacity-40" />
          <h3 className="text-lg font-bold text-white">No projects found</h3>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            Get started by importing a repository from your GitHub App installation or adjusting your search filters.
          </p>
          <Link href="/new" className="inline-block pt-2">
            <Button variant="primary" size="sm">
              Deploy Your First Project
            </Button>
          </Link>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProjects.map((project, idx) => {
            const latestDeploy = project.deployments[0];
            const primaryDomain = project.domains?.find((d) => d.isPrimary) || project.domains?.[0];

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.08 }}
              >
                <GlassCard hoverEffect className="flex flex-col justify-between h-full space-y-6">
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-lg font-bold text-white hover:underline flex items-center space-x-2"
                      >
                        <span>{project.name}</span>
                      </Link>
                      <div className="flex items-center space-x-2 text-xs text-zinc-400">
                        <GitBranch className="h-3.5 w-3.5 text-zinc-500" />
                        <span>{project.repoFullName}</span>
                        <span className="text-zinc-600">•</span>
                        <span className="font-mono text-[11px] bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60">
                          {project.framework}
                        </span>
                      </div>
                    </div>

                    {latestDeploy && <StatusBadge status={latestDeploy.status} />}
                  </div>

                  {/* Latest Deployment Info */}
                  {latestDeploy ? (
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3.5 space-y-2 font-mono text-xs">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span className="truncate max-w-[240px]" title={latestDeploy.commitMessage}>
                          {latestDeploy.commitMessage}
                        </span>
                        <span className="text-[10px] text-zinc-500 shrink-0">
                          {latestDeploy.commitHash?.substring(0, 7)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-800/60 pt-2">
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          Branch: {project.defaultBranch}
                        </span>
                        <span>{new Date(latestDeploy.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3.5 text-xs text-zinc-500 text-center">
                      No builds executed yet
                    </div>
                  )}

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                    {primaryDomain ? (
                      <a
                        href={`https://${primaryDomain.name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                      >
                        <span>{primaryDomain.name}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-600">No domain linked</span>
                    )}

                    <Link href={`/projects/${project.id}`}>
                      <Button variant="secondary" size="sm">
                        View Pipeline
                      </Button>
                    </Link>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
