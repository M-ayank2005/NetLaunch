"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Github, Plus, Trash2, Check, ArrowLeft, Layers, Terminal, Sparkles } from "lucide-react";
import { GlassCard, Button } from "@netlaunch/ui";
import { FRAMEWORK_DEFAULT_PRESETS, ProjectFramework } from "@netlaunch/shared";

interface GitHubInstallation {
  id: string;
  installationId: string;
  accountLogin: string;
  accountType: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  description: string | null;
}

interface EnvVarRow {
  key: string;
  value: string;
}

export default function NewProjectWizard() {
  const router = useRouter();

  // Step state: 'PICK_REPO' | 'CONFIGURE_BUILD'
  const [step, setStep] = useState<"PICK_REPO" | "CONFIGURE_BUILD">("PICK_REPO");

  // GitHub Data
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [selectedInstId, setSelectedInstId] = useState<string>("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [repoSearch, setRepoSearch] = useState<string>("");

  // Build Configuration State
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [framework, setFramework] = useState<ProjectFramework>(ProjectFramework.NEXT);
  const [buildCommand, setBuildCommand] = useState<string>(FRAMEWORK_DEFAULT_PRESETS.NEXT.buildCommand);
  const [outputDir, setOutputDir] = useState<string>(FRAMEWORK_DEFAULT_PRESETS.NEXT.outputDirectory);
  const [installCommand, setInstallCommand] = useState<string>(FRAMEWORK_DEFAULT_PRESETS.NEXT.installCommand);
  const [rootDirectory, setRootDirectory] = useState<string>("./");
  const [envVars, setEnvVars] = useState<EnvVarRow[]>([{ key: "", value: "" }]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch Installations & Repos on Mount
  useEffect(() => {
    const fetchGithubData = async () => {
      try {
        setLoadingRepos(true);
        // Fetch mock/live installations
        const instRes = await axios.get("http://localhost:4000/api/v1/github/installations", { withCredentials: true });
        let instList = instRes.data?.data || [];
        
        if (instList.length === 0) {
          instList = [{ id: "inst-1", installationId: "55443322", accountLogin: "alexrivera", accountType: "User" }];
        }
        setInstallations(instList);
        const firstId = instList[0].installationId;
        setSelectedInstId(firstId);

        // Fetch repositories for this installation
        const reposRes = await axios.get(`http://localhost:4000/api/v1/github/repositories?installationId=${firstId}`, {
          withCredentials: true,
        });
        setRepos(reposRes.data?.data || []);
      } catch (err) {
        // Fallback mock repositories if offline
        setRepos([
          { id: 10101010, name: "next-portfolio", full_name: "alexrivera/next-portfolio", private: false, default_branch: "main", description: "Next.js 15 developer portfolio" },
          { id: 20202020, name: "cyber-analytics", full_name: "alexrivera/cyber-analytics", private: true, default_branch: "main", description: "Vite + React 19 threat dashboard" },
          { id: 30303030, name: "ai-prompt-studio", full_name: "alexrivera/ai-prompt-studio", private: false, default_branch: "main", description: "Generative AI prompt workspace" },
        ]);
      } finally {
        setLoadingRepos(false);
      }
    };
    fetchGithubData();
  }, []);

  // Handle Framework preset change auto-filling commands
  const handleFrameworkChange = (fw: ProjectFramework) => {
    setFramework(fw);
    const preset = FRAMEWORK_DEFAULT_PRESETS[fw];
    if (preset) {
      setBuildCommand(preset.buildCommand);
      setOutputDir(preset.outputDirectory);
      setInstallCommand(preset.installCommand);
    }
  };

  // Handle choosing a repository
  const handleSelectRepository = (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setProjectName(repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
    
    // Auto-detect framework based on name or defaults
    if (repo.name.includes("next") || repo.name.includes("portfolio")) {
      handleFrameworkChange(ProjectFramework.NEXT);
    } else if (repo.name.includes("vite") || repo.name.includes("analytics")) {
      handleFrameworkChange(ProjectFramework.VITE);
    } else {
      handleFrameworkChange(ProjectFramework.NODE);
    }

    setStep("CONFIGURE_BUILD");
  };

  // Add / Remove Env Vars
  const addEnvRow = () => setEnvVars([...envVars, { key: "", value: "" }]);
  const removeEnvRow = (idx: number) => setEnvVars(envVars.filter((_, i) => i !== idx));
  const updateEnvRow = (idx: number, field: "key" | "value", val: string) => {
    const next = [...envVars];
    next[idx][field] = val;
    setEnvVars(next);
  };

  // Handle Submit & Trigger Deploy
  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepo) return;

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const validEnvVars = envVars
        .filter((row) => row.key.trim() !== "")
        .map((row) => ({ key: row.key.trim(), value: row.value.trim(), target: ["PRODUCTION", "PREVIEW"] }));

      const payload = {
        name: projectName,
        repoFullName: selectedRepo.full_name,
        repoId: selectedRepo.id,
        defaultBranch: selectedRepo.default_branch || "main",
        framework,
        buildCommand,
        outputDirectory: outputDir,
        installCommand,
        rootDirectory,
        installationId: selectedInstId,
        envVars: validEnvVars,
      };

      const res = await axios.post("http://localhost:4000/api/v1/projects", payload, {
        withCredentials: true,
      });

      if (res.data?.success) {
        // Redirect to project detail view where live terminal will stream!
        router.push(`/projects/${res.data.data.id}`);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Failed to trigger project deployment. Please check configurations.");
      setSubmitting(false);
    }
  };

  const filteredRepos = repos.filter((r) => r.full_name.toLowerCase().includes(repoSearch.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header & Step Indicator */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-6">
        <div>
          <button
            onClick={() => (step === "CONFIGURE_BUILD" ? setStep("PICK_REPO") : router.push("/dashboard"))}
            className="inline-flex items-center space-x-2 text-xs text-zinc-400 hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{step === "CONFIGURE_BUILD" ? "Back to Repository Selection" : "Back to Dashboard"}</span>
          </button>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Import Git Repository</h1>
          <p className="text-sm text-zinc-400 mt-1">Select a repository from your GitHub App installation and configure your isolated build pipeline.</p>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-xs font-mono">
          <span className={`px-2.5 py-1 rounded-full border ${step === "PICK_REPO" ? "border-white/40 bg-white/10 text-white font-bold" : "border-zinc-800 bg-zinc-900 text-zinc-500"}`}>
            1. Select Repo
          </span>
          <span className="text-zinc-600">→</span>
          <span className={`px-2.5 py-1 rounded-full border ${step === "CONFIGURE_BUILD" ? "border-white/40 bg-white/10 text-white font-bold" : "border-zinc-800 bg-zinc-900 text-zinc-500"}`}>
            2. Configure Build
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === "PICK_REPO" ? (
          <motion.div
            key="pick-repo"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
            {/* GitHub App Installation Selector */}
            <GlassCard className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-zinc-800/90 bg-zinc-900/60">
              <div className="flex items-center space-x-3">
                <Github className="h-6 w-6 text-white" />
                <div>
                  <span className="text-xs text-zinc-400 block font-mono">Connected GitHub Account / Org</span>
                  <span className="font-semibold text-white">{installations[0]?.accountLogin || "alexrivera"} (Installation ID: {selectedInstId || "55443322"})</span>
                </div>
              </div>

              <a
                href="http://localhost:4000/api/v1/github/install"
                className="inline-flex items-center space-x-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-400" />
                <span>Configure GitHub App Access</span>
              </a>
            </GlassCard>

            {/* Repository Search Filter */}
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Search repositories authorized under your GitHub App installation..."
                value={repoSearch}
                onChange={(e) => setRepoSearch(e.target.value)}
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 py-3.5 px-4 text-sm text-white placeholder-zinc-500 backdrop-blur-xl focus:border-zinc-600 focus:outline-none transition-colors"
              />

              <div className="space-y-3">
                {loadingRepos ? (
                  <div className="space-y-3">
                    <div className="h-16 rounded-2xl bg-zinc-900/60 animate-pulse border border-zinc-800" />
                    <div className="h-16 rounded-2xl bg-zinc-900/60 animate-pulse border border-zinc-800" />
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <GlassCard className="text-center py-12 text-zinc-500">
                    No repositories found matching query. Make sure the GitHub App is installed on this repository.
                  </GlassCard>
                ) : (
                  filteredRepos.map((repo) => (
                    <GlassCard
                      key={repo.id}
                      hoverEffect
                      onClick={() => handleSelectRepository(repo)}
                      className="flex items-center justify-between p-5 cursor-pointer group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white group-hover:text-emerald-400 transition-colors text-base">{repo.full_name}</span>
                          {repo.private && (
                            <span className="text-[10px] font-mono border border-zinc-700 bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">
                              Private
                            </span>
                          )}
                        </div>
                        {repo.description && <p className="text-xs text-zinc-400 line-clamp-1">{repo.description}</p>}
                      </div>

                      <div className="flex items-center space-x-4">
                        <span className="text-xs font-mono text-zinc-500 hidden sm:inline-block">branch: {repo.default_branch}</span>
                        <Button variant="secondary" size="sm" className="group-hover:border-zinc-500 group-hover:bg-zinc-800">
                          Import
                        </Button>
                      </div>
                    </GlassCard>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="configure-build"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            onSubmit={handleDeploy}
            className="space-y-8"
          >
            {errorMsg && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
                ❌ {errorMsg}
              </div>
            )}

            {/* Selected Repo Header Card */}
            <GlassCard className="flex items-center justify-between border-emerald-500/30 bg-emerald-500/[0.03] p-5">
              <div className="flex items-center space-x-3">
                <Github className="h-6 w-6 text-emerald-400" />
                <div>
                  <span className="text-xs text-zinc-400 block font-mono">Selected Repository</span>
                  <span className="font-bold text-white text-base">{selectedRepo?.full_name}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep("PICK_REPO")}
                className="text-xs text-zinc-400 hover:text-white underline"
              >
                Change Repository
              </button>
            </GlassCard>

            {/* Build Settings & Framework Auto-Detection */}
            <GlassCard className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center">
                  <Terminal className="h-5 w-5 mr-2.5 text-blue-400" />
                  Build & Output Settings
                </h3>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Auto-Detected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300 block">Project Name (Subdomain Slug)</label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 py-2.5 px-3.5 text-sm text-white focus:border-zinc-600 focus:outline-none"
                  />
                  <span className="text-[11px] font-mono text-zinc-500 block">URL: {projectName || "project"}.netlaunch.app</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300 block">Framework Preset</label>
                  <select
                    value={framework}
                    onChange={(e) => handleFrameworkChange(e.target.value as ProjectFramework)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 py-2.5 px-3.5 text-sm text-white focus:border-zinc-600 focus:outline-none"
                  >
                    {Object.entries(FRAMEWORK_DEFAULT_PRESETS).map(([key, val]) => (
                      <option key={key} value={key}>
                        {val.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300 block font-mono">Install Command</label>
                  <input
                    type="text"
                    value={installCommand}
                    onChange={(e) => setInstallCommand(e.target.value)}
                    placeholder="npm install"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 py-2.5 px-3.5 text-sm font-mono text-zinc-200 focus:border-zinc-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300 block font-mono">Build Command</label>
                  <input
                    type="text"
                    value={buildCommand}
                    onChange={(e) => setBuildCommand(e.target.value)}
                    placeholder="npm run build"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 py-2.5 px-3.5 text-sm font-mono text-zinc-200 focus:border-zinc-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300 block font-mono">Output Directory</label>
                  <input
                    type="text"
                    value={outputDir}
                    onChange={(e) => setOutputDir(e.target.value)}
                    placeholder=".next or dist"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 py-2.5 px-3.5 text-sm font-mono text-zinc-200 focus:border-zinc-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-300 block font-mono">Root Directory</label>
                  <input
                    type="text"
                    value={rootDirectory}
                    onChange={(e) => setRootDirectory(e.target.value)}
                    placeholder="./"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/80 py-2.5 px-3.5 text-sm font-mono text-zinc-200 focus:border-zinc-600 focus:outline-none"
                  />
                </div>
              </div>
            </GlassCard>

            {/* Environment Variables Builder */}
            <GlassCard className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Environment Variables</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Encrypted secrets injected into Docker worker build containers.</p>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={addEnvRow} className="space-x-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Variable</span>
                </Button>
              </div>

              <div className="space-y-3">
                {envVars.map((row, idx) => (
                  <div key={idx} className="flex items-center space-x-3">
                    <input
                      type="text"
                      placeholder="KEY (e.g., API_SECRET)"
                      value={row.key}
                      onChange={(e) => updateEnvRow(idx, "key", e.target.value)}
                      className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950/80 py-2 px-3 text-sm font-mono text-white placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="VALUE"
                      value={row.value}
                      onChange={(e) => updateEnvRow(idx, "value", e.target.value)}
                      className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950/80 py-2 px-3 text-sm font-mono text-white placeholder-zinc-600 focus:border-zinc-600 focus:outline-none"
                    />
                    {envVars.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEnvRow(idx)}
                        className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Submit Action Bar */}
            <div className="flex items-center justify-end space-x-4 pt-4">
              <Button type="button" variant="ghost" onClick={() => setStep("PICK_REPO")}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="lg" isLoading={submitting} className="font-bold tracking-wide">
                Deploy Project
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
