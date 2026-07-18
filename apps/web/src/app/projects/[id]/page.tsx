"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal,
  Layers,
  Globe,
  Settings,
  Key,
  RefreshCw,
  ExternalLink,
  ArrowLeft,
  GitBranch,
  Clock,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { GlassCard, StatusBadge, AnimatedLogViewer, Button, LogEntry } from "@netlaunch/ui";

interface ProjectDetail {
  id: string;
  name: string;
  repoFullName: string;
  defaultBranch: string;
  framework: string;
  buildCommand: string;
  outputDirectory: string;
  installCommand: string;
  rootDirectory: string;
  domains: { id: string; name: string; isPrimary: boolean; isVerified: boolean }[];
  envVars: { id: string; key: string; value: string; target: string[] }[];
  deployments: {
    id: string;
    status: string;
    commitHash: string;
    commitMessage: string;
    commitAuthor: string;
    branch: string;
    url: string | null;
    createdAt: string;
    durationMs?: number;
  }[];
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"pipeline" | "domains" | "env" | "settings">("pipeline");
  const [activeDeployId, setActiveDeployId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deployStatus, setDeployStatus] = useState<string>("QUEUED");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [redeploying, setRedeploying] = useState<boolean>(false);

  // Fetch Project details
  const fetchProjectDetails = async () => {
    try {
      const res = await axios.get(`http://localhost:4000/api/v1/projects/${projectId}`, {
        withCredentials: true,
      });
      if (res.data.success) {
        setProject(res.data.data);
        const latest = res.data.data.deployments[0];
        if (latest && !activeDeployId) {
          setActiveDeployId(latest.id);
          setDeployStatus(latest.status);
        }
      }
    } catch (err) {
      // Fallback mock data if server offline
      const mockDeployId = "deploy-live-test";
      setProject({
        id: projectId,
        name: "alex-next-portfolio",
        repoFullName: "alexrivera/next-portfolio",
        defaultBranch: "main",
        framework: "NEXT",
        buildCommand: "npm run build",
        outputDirectory: ".next",
        installCommand: "npm install",
        rootDirectory: "./",
        domains: [
          { id: "d1", name: "alex-portfolio.netlaunch.app", isPrimary: true, isVerified: true },
          { id: "d2", name: "portfolio.alexrivera.dev", isPrimary: false, isVerified: true },
        ],
        envVars: [
          { id: "e1", key: "NEXT_PUBLIC_API_URL", value: "https://api.netlaunch.app/v1", target: ["PRODUCTION"] },
          { id: "e2", key: "DATABASE_URL", value: "postgresql://prod:secret@db.internal:5432/db", target: ["PRODUCTION"] },
        ],
        deployments: [
          {
            id: mockDeployId,
            status: "BUILDING",
            commitHash: "e4f9b2d8a1c78e90123456789abcdef012345678",
            commitMessage: "feat: add glassmorphism hero section & animated metrics",
            commitAuthor: "Alex Rivera",
            branch: "main",
            url: "alex-portfolio.netlaunch.app",
            createdAt: new Date().toISOString(),
          },
        ],
      });
      if (!activeDeployId) {
        setActiveDeployId(mockDeployId);
        setDeployStatus("BUILDING");
      }
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  // Connect to Socket.IO real-time log stream
  useEffect(() => {
    if (!activeDeployId) return;

    // Clear existing logs when switching deployment selection
    setLogs([]);

    const socketInstance = io("http://localhost:4000", {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {
      console.log(`🔌 Connected to Socket.IO. Subscribing to deployment ${activeDeployId}`);
      socketInstance.emit("subscribe:deployment:logs", { deploymentId: activeDeployId });
    });

    socketInstance.on("deployment:log:history", (history: LogEntry[]) => {
      setLogs(history);
    });

    socketInstance.on("deployment:log:new", (newLog: LogEntry) => {
      setLogs((prev) => [...prev, newLog]);
    });

    socketInstance.on("deployment:status:update", (updatedDeploy: any) => {
      setDeployStatus(updatedDeploy.status);
      setProject((prev) =>
        prev
          ? {
              ...prev,
              deployments: prev.deployments.map((d) =>
                d.id === updatedDeploy.id ? { ...d, status: updatedDeploy.status } : d
              ),
            }
          : null
      );
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.emit("unsubscribe:deployment:logs", { deploymentId: activeDeployId });
      socketInstance.disconnect();
    };
  }, [activeDeployId]);

  // Handle Trigger Manual Re-Deploy
  const handleTriggerRedeploy = async () => {
    if (!project) return;
    setRedeploying(true);

    try {
      const res = await axios.post(
        `http://localhost:4000/api/v1/projects/${project.id}/deploy`,
        { branch: project.defaultBranch },
        { withCredentials: true }
      );

      if (res.data.success) {
        const newDeploy = res.data.data;
        setProject((prev) => (prev ? { ...prev, deployments: [newDeploy, ...prev.deployments] } : null));
        setActiveDeployId(newDeploy.id);
        setDeployStatus(newDeploy.status);
        setLogs([]);
      }
    } catch (err) {
      // Simulate live redeploy locally if server not booted
      const mockNewId = `deploy-${Date.now()}`;
      const newDeploy = {
        id: mockNewId,
        status: "BUILDING",
        commitHash: "a9f8b7c6d5e43210987654321abcdef012345678",
        commitMessage: "manual: trigger pipeline rebuild from control plane",
        commitAuthor: "Alex Rivera",
        branch: project.defaultBranch,
        url: `${project.name}.netlaunch.app`,
        createdAt: new Date().toISOString(),
      };
      setProject((prev) => (prev ? { ...prev, deployments: [newDeploy, ...prev.deployments] } : null));
      setActiveDeployId(mockNewId);
      setDeployStatus("BUILDING");
      setLogs([]);
    } finally {
      setRedeploying(false);
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 font-mono">
        Loading project architecture & real-time socket connections...
      </div>
    );
  }

  const activeDeploymentObj = project.deployments.find((d) => d.id === activeDeployId) || project.deployments[0];
  const primaryDomain = project.domains.find((d) => d.isPrimary) || project.domains[0];

  return (
    <div className="space-y-8">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <Link href="/dashboard" className="inline-flex items-center space-x-2 text-xs text-zinc-400 hover:text-white transition-colors mb-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">{project.name}</h1>
            {activeDeploymentObj && <StatusBadge status={activeDeploymentObj.status} />}
          </div>
          <div className="flex items-center space-x-3 text-xs text-zinc-400 mt-1">
            <span className="flex items-center">
              <GitBranch className="w-3.5 h-3.5 mr-1 text-zinc-500" />
              {project.repoFullName}
            </span>
            <span>•</span>
            <span className="font-mono bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700/60">{project.framework}</span>
            <span>•</span>
            {primaryDomain && (
              <a
                href={`https://${primaryDomain.name}`}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:underline flex items-center"
              >
                {primaryDomain.name}
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="primary"
            size="sm"
            onClick={handleTriggerRedeploy}
            isLoading={redeploying}
            className="space-x-2 font-bold"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Trigger Re-Deploy</span>
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-2 border-b border-zinc-800/80">
        <button
          onClick={() => setActiveTab("pipeline")}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "pipeline" ? "border-emerald-400 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Build Pipeline & Live Logs</span>
        </button>
        <button
          onClick={() => setActiveTab("domains")}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "domains" ? "border-emerald-400 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Domains ({project.domains.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("env")}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "env" ? "border-emerald-400 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Environment Variables ({project.envVars.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === "settings" ? "border-emerald-400 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Project Settings</span>
        </button>
      </div>

      {/* Tab Contents */}
      <AnimatePresence mode="wait">
        {activeTab === "pipeline" && (
          <motion.div
            key="pipeline"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left/Main Column: Real-Time Animated Terminal Viewer */}
            <div className="lg:col-span-2 space-y-4">
              <AnimatedLogViewer
                logs={logs}
                status={deployStatus}
                title={activeDeploymentObj ? `Build Stream: ${activeDeploymentObj.commitHash.substring(0, 7)}` : "Container Build Output"}
              />
            </div>

            {/* Right Column: Deployment History List */}
            <div className="space-y-4">
              <GlassCard className="space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Deployment History</h3>
                <div className="space-y-3">
                  {project.deployments.map((deploy) => (
                    <div
                      key={deploy.id}
                      onClick={() => {
                        setActiveDeployId(deploy.id);
                        setDeployStatus(deploy.status);
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        activeDeployId === deploy.id
                          ? "border-zinc-500 bg-zinc-800/80 shadow-lg"
                          : "border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700/80"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <StatusBadge status={deploy.status} />
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(deploy.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-200 font-medium truncate" title={deploy.commitMessage}>
                        {deploy.commitMessage}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-[11px] font-mono text-zinc-500">
                        <span>commit: {deploy.commitHash.substring(0, 7)}</span>
                        <span>{deploy.durationMs ? `${(deploy.durationMs / 1000).toFixed(1)}s` : "live"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </motion.div>
        )}

        {activeTab === "domains" && (
          <motion.div
            key="domains"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 max-w-3xl"
          >
            <GlassCard className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Production Ingress Domains</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Custom subdomains and automated HTTPS endpoints routed by Nginx/Proxy.</p>
                </div>
                <Button variant="secondary" size="sm" className="space-x-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Domain</span>
                </Button>
              </div>

              <div className="space-y-3 pt-2">
                {project.domains.map((dom) => (
                  <div key={dom.id} className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
                    <div className="flex items-center space-x-3">
                      <Globe className="w-5 h-5 text-emerald-400" />
                      <div>
                        <a
                          href={`https://${dom.name}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-white hover:underline flex items-center space-x-1 text-sm"
                        >
                          <span>{dom.name}</span>
                          <ExternalLink className="w-3 h-3 text-zinc-500" />
                        </a>
                        <div className="flex items-center space-x-2 mt-1">
                          {dom.isPrimary && (
                            <span className="text-[10px] font-mono border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded">
                              Primary
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-zinc-500">HTTPS (TLS v1.3 Auto-Renewed)</span>
                        </div>
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {activeTab === "env" && (
          <motion.div
            key="env"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 max-w-3xl"
          >
            <GlassCard className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white">Environment Variables</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Encrypted at rest inside PostgreSQL. Injected automatically during Docker builds.</p>
              </div>

              <div className="space-y-3 pt-2">
                {project.envVars.map((env) => (
                  <div key={env.id} className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 font-mono text-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-emerald-400">{env.key}</span>
                      <div className="flex items-center space-x-2 text-[10px] text-zinc-500">
                        {env.target.map((t) => (
                          <span key={t} className="bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-zinc-500 select-none">••••••••••••••••••••</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {activeTab === "settings" && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 max-w-3xl"
          >
            <GlassCard className="space-y-4">
              <h3 className="text-lg font-bold text-white">Build Engine Configuration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60">
                  <span className="text-zinc-500 block mb-1">Framework Preset</span>
                  <span className="font-bold text-white text-sm">{project.framework}</span>
                </div>
                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60">
                  <span className="text-zinc-500 block mb-1">Install Command</span>
                  <span className="font-bold text-white text-sm">{project.installCommand || "npm install"}</span>
                </div>
                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60">
                  <span className="text-zinc-500 block mb-1">Build Command</span>
                  <span className="font-bold text-white text-sm">{project.buildCommand || "npm run build"}</span>
                </div>
                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60">
                  <span className="text-zinc-500 block mb-1">Output Directory</span>
                  <span className="font-bold text-white text-sm">{project.outputDirectory || ".next"}</span>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
