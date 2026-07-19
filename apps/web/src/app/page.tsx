"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Terminal, Github, Shield, Cpu, Database, Layers, ArrowRight, CheckCircle2 } from "lucide-react";
import { GlassCard } from "@netlaunch/ui";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center space-y-16 py-12">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-4xl space-y-6"
      >
        <div className="inline-flex items-center space-x-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>Distributed Build Architecture v2.0 • Container Pipeline & Edge Router Live</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Next-Generation Cloud <br />
          <span className="text-zinc-400">Deployment Control Plane</span>
        </h1>

        <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Enterprise cloud deployment and edge routing engine built on first principles. Decoupled across isolated Docker build sandboxes (`node:20-alpine`), BullMQ Redis asynchronous queues, MinIO S3 immutable artifact storage, and an in-memory LRU caching edge reverse proxy.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <a
            href="http://localhost:4000/api/v1/auth/github"
            className="inline-flex items-center space-x-3 rounded-2xl bg-white px-8 py-4 font-semibold text-zinc-950 shadow-xl shadow-white/10 transition-all hover:bg-zinc-200 active:scale-95"
          >
            <Github className="h-5 w-5" />
            <span>Continue with GitHub</span>
            <ArrowRight className="h-4 w-4 ml-1" />
          </a>

          <Link
            href="/dashboard"
            className="inline-flex items-center space-x-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-8 py-4 font-semibold text-zinc-200 backdrop-blur-xl transition-all hover:bg-zinc-800/80 hover:border-zinc-700 active:scale-95"
          >
            <Layers className="h-5 w-5 text-zinc-400" />
            <span>Explore Dashboard</span>
          </Link>
        </div>
      </motion.div>

      {/* Architecture Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-8">
        <GlassCard hoverEffect className="space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-emerald-400">
            <Cpu className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Isolated Docker Sandboxes</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Every build executes inside ephemeral Docker containers (`node:20-alpine`) guaranteeing complete filesystem isolation and eliminating noisy-neighbor resource interference across tenants.
          </p>
        </GlassCard>

        <GlassCard hoverEffect className="space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-blue-400">
            <Database className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">BullMQ & MinIO S3 Archiver</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Asynchronous build queue orchestration (`deployment-build-queue`) backed by Redis. Production static output (`dist/`, `.next/`) is packaged into immutable `.tar.gz` bundles stored inside MinIO object storage.
          </p>
        </GlassCard>

        <GlassCard hoverEffect className="space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-amber-400">
            <Shield className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Edge Ingress Proxy Router</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Dedicated reverse proxy (`apps/proxy`) listening on port `8080` resolving wildcard domains (`*.netlaunch.localhost`). Stream-extracts S3 tarballs on-the-fly into an in-memory LRU asset cache.
          </p>
        </GlassCard>
      </div>

      {/* Architectural Flow Showcase */}
      <GlassCard className="w-full space-y-6 border-zinc-800/90 bg-zinc-900/60">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
          <div className="flex items-center space-x-3">
            <Terminal className="h-5 w-5 text-emerald-400" />
            <span className="font-bold text-white tracking-wide">NetLaunch Distributed Request & Pipeline Flow</span>
          </div>
          <span className="text-xs font-mono text-zinc-500">Queue Broker + Edge Ingress</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 text-center font-mono text-xs">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-2">
            <div className="text-zinc-500">1. Developer</div>
            <div className="font-bold text-white">Git Push / Trigger</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-2">
            <div className="text-zinc-500">2. Control Plane</div>
            <div className="font-bold text-white">Express / BullMQ</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-2">
            <div className="text-zinc-500">3. Worker Sandbox</div>
            <div className="font-bold text-emerald-400">Docker (`node:20`)</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-2">
            <div className="text-zinc-500">4. Object Store</div>
            <div className="font-bold text-blue-400">MinIO S3 Tarball</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-2">
            <div className="text-zinc-500">5. Edge Proxy</div>
            <div className="font-bold text-white">*.localhost:8080</div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
