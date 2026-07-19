# NetLaunch — Enterprise Cloud Deployment Platform

[![Monorepo](https://img.shields.io/badge/Monorepo-Turborepo%20%2B%20pnpm-blue.svg)](https://turbo.build)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6%2B-3178C6.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15%20App%20Router-black.svg)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7%20BullMQ-DC382D.svg)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Isolated%20Builds-2496ED.svg)](https://www.docker.com/)

**NetLaunch** is a production-grade, distributed cloud deployment engine designed from first principles. Modeled after the architectural core of **Vercel, Railway, and GitHub Actions**, NetLaunch provides transparent, highly scalable, containerized deployments with a stunning Glassmorphism control plane.

Unlike simple minimum viable clones, NetLaunch is engineered with the rigor, fault tolerance, and security primitives of an enterprise platform: multi-tenant PostgreSQL schemas, least-privilege GitHub Apps, asynchronous Redis/BullMQ job orchestration, real-time WebSocket log streaming, and isolated Docker container build pipelines.

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Control_Plane ["Control Plane (apps/web + apps/api)"]
        UI["Next.js 15 UI (apps/web)\nGlassmorphism + Framer Motion"]
        API["Express 5 + TypeScript API (apps/api)\nSecurity + Route Handlers + Socket.IO"]
    end

    subgraph Persistence_Layer ["Data & State Persistence"]
        PG[(PostgreSQL 16\nPrisma Multi-Tenant Schema)]
        Redis[(Redis 7\nBullMQ Queues + PubSub)]
        MinIO[(MinIO S3\nBuild Artifact Bundle Storage)]
    end

    subgraph Build_Engine ["Worker Execution Engine (apps/worker)"]
        Worker1["NetLaunch Worker #01\nIsolated Docker Engine (`node:20-alpine`)"]
        Worker2["NetLaunch Worker #02\nIsolated Docker Engine (`node:20-alpine`)"]
    end

    UI <== "HTTP / REST API (withCredentials Cookie)" ==> API
    UI <== "Socket.IO WebSocket (Live Log Stream)" ==> API
    API <== "Prisma ORM Queries & Transactions" ==> PG
    API == "Push Build Jobs (`BullMQ`)" ==> Redis
    Worker1 <== "Pop Job & Publish Terminal Output to PubSub" ==> Redis
    Worker2 <== "Pop Job & Publish Terminal Output to PubSub" ==> Redis
    Worker1 == "Upload Compressed Build Bundle (`dist/`)" ==> MinIO
    Worker2 == "Upload Compressed Build Bundle (`dist/`)" ==> MinIO
```

---

## 🚀 Key Features (Milestone 1 — Completed & Verified)

### 1. High-Contrast Glassmorphism Control Plane (`apps/web`)
- **Tailored Dark Mode (Zero AI Gradients)**: Built with deep `#09090b` obsidian backgrounds, `backdrop-blur-md` glass panels, crisp 1px borders (`border-zinc-800/80`), and instantaneous micro-animations via Framer Motion.
- **Repository Import Wizard (`/new`)**: Step-by-step repository picker integrated with GitHub App access tokens, automatic framework detection (`NEXT`, `VITE`, `REACT`, `STATIC`, `NODE`), and secure environment variable configuration (`PRODUCTION`, `PREVIEW`).
- **Interactive Terminal Console (`AnimatedLogViewer`)**: Real-time terminal log viewer powered by Framer Motion, color-coded level badges (`INFO`, `WARN`, `ERROR`, `COMMAND`), and auto-scrolling execution steps.

### 2. Dual-Mode GitHub Security & Authentication (`apps/api`)
- **GitHub OAuth 2.0 Flow (`/auth/github`)**: Seamless user authentication issuing signed, HTTP-Only `Strict` JWT cookies.
- **Least-Privilege GitHub Apps (`/github/install`)**: Fine-grained repository access control via GitHub Apps using RSA private keys and temporary Installation Access Tokens (`IAT`). Users only expose repositories they explicitly authorize.

### 3. Enterprise Database Schema (`@netlaunch/database`)
- **Multi-Tenant PostgreSQL Architecture**: Cleanly modeled `User`, `GitHubInstallation`, `Project`, `Deployment`, `BuildLog`, `Domain`, and `EnvironmentVariable` entities.
- **Atomic Transactions**: Project initialization and deployment triggers run within strict database transactions (`prisma.$transaction`) to guarantee zero orphan records.
- **Optimized Indexing**: Composite indexes (`@@index([deploymentId, timestamp])`) ensure sub-millisecond build log retrieval even under high logging volumes.

### 4. Real-Time Distributed Log Streaming (`Socket.IO + BullMQ`)
- **BullMQ Background Jobs**: Non-blocking build queueing (`queueDeploymentJob`) offloading build tasks to Redis.
- **WebSocket Log Broadcasting**: Live emission of build commands and terminal output to connected web clients over Socket.IO rooms (`project:{projectId}:logs`).

---

## 📦 Monorepo Structure

NetLaunch uses **Turborepo** and **pnpm workspaces** for strict encapsulation and zero-config build caching across applications and packages:

```
netlaunch/
├── apps/
│   ├── web/                 # Next.js 15 (App Router) Control Plane Dashboard
│   ├── api/                 # Express 5 + TypeScript + Socket.IO Control Plane API
│   └── worker/              # [Phase 2] Node.js/Docker BullMQ Build Engine Worker
├── packages/
│   ├── database/            # Prisma Schema, Migrations, Seeders & Client Singleton
│   ├── shared/              # Shared Zod Validation Schemas, DTOs & Enums
│   ├── ui/                  # Glass Card, Status Badges, Skeleton & Terminal UI Primitives
│   └── config/              # Shared TSConfig & ESLint base definitions
├── docs/
│   └── reference/           # Deep-dive 10-part architectural reference guides
├── infrastructure/
│   └── docker-compose.yml   # PostgreSQL 16, Redis 7 & MinIO local dev stack
└── turbo.json               # Turborepo task pipeline and cache definitions
```

---

## 📚 Encyclopedic Reference Guides

Every milestone built inside NetLaunch includes a comprehensive **10-part technical deep-dive** (*Theory, Internal Working, Architecture, Database Design, APIs, Code, Security, Scaling, Interview Discussion, and Production Improvements*):

1. **[Monorepo Architecture & Infrastructure](file:///C:/Projects/NetLaunch/docs/reference/01-monorepo-and-infrastructure.md)** — Workspace boundaries, Turborepo pipelines, and Dockerized core services.
2. **[Database Design & Prisma ORM Schema](file:///C:/Projects/NetLaunch/docs/reference/02-database-and-prisma-schema.md)** — Multi-tenancy, relational integrity, and index optimization.
3. **[GitHub OAuth & JWT Cookie Authentication](file:///C:/Projects/NetLaunch/docs/reference/03-github-oauth-and-jwt-authentication.md)** — Stateless authentication, CSRF defense, and HTTP-Only cookie security.
4. **[GitHub App Integration & Project APIs](file:///C:/Projects/NetLaunch/docs/reference/04-github-app-and-project-apis.md)** — RSA/JWT installation token exchange, repository filtering, and atomic project creation.
5. **[Glassmorphism Dashboard & Repository Picker](file:///C:/Projects/NetLaunch/docs/reference/05-glassmorphism-dashboard-and-repo-selection.md)** — Design system tokens, Framer Motion animations, and real-time terminal UI.

---

## 🛠️ Quickstart & Local Development

### Prerequisites
- **Node.js**: `v20.x` or higher
- **pnpm**: `v9.x` (`npm install -g pnpm`)
- **Docker & Docker Compose**: For local PostgreSQL, Redis, and MinIO instances

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/M-ayank2005/NetLaunch.git
cd NetLaunch
pnpm install
```

### 2. Boot Local Infrastructure Services
Start PostgreSQL 16, Redis 7, and MinIO object storage in the background:
```bash
cd infrastructure
docker compose up -d
cd ..
```

### 3. Setup Environment Variables
Copy `.env.example` to `.env` in the root directory (or ensure default values match `docker-compose.yml`):
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/netlaunch?schema=public"
REDIS_URL="redis://:postgres@localhost:6379/0"
JWT_SECRET="super-secret-development-jwt-key-minimum-32-chars"
CLIENT_URL="http://localhost:3000"
API_URL="http://localhost:4000"
```

### 4. Push Database Schema & Seed Data
Push the Prisma schema to your local PostgreSQL database and seed sample projects:
```bash
pnpm --filter @netlaunch/database db:push
pnpm --filter @netlaunch/database db:seed
```

### 5. Verify Build Pipeline across Monorepo
Ensure all packages (`@netlaunch/shared`, `@netlaunch/database`, `@netlaunch/ui`, `@netlaunch/api`, `@netlaunch/web`) compile with zero errors:
```bash
pnpm turbo run build
```

### 6. Launch Development Servers
Start the full control plane (both `apps/api` and `apps/web` concurrently):
```bash
pnpm turbo run dev
```

- **Control Plane UI**: Open [http://localhost:3000](http://localhost:3000)
- **Control Plane API**: Open [http://localhost:4000](http://localhost:4000)

---

## 🗺️ Roadmap & Upcoming Milestones

- [x] **Milestone 1**: Monorepo Foundation, Database Schema, GitHub OAuth & App Auth, Project Management APIs, Socket.IO Log Streaming, Glassmorphism UI Dashboard.
- [ ] **Milestone 2 (In Progress)**: Isolated Docker Build Engine (`apps/worker`), BullMQ Job Consumer, Git Repository Cloning, Container Build Sandbox (`node:20-alpine`), and MinIO Artifact Bundling.
- [ ] **Milestone 3**: Edge Proxy / Reverse Proxy Ingress Router (`apps/proxy`), Wildcard Subdomain Routing (`*.netlaunch.app`), and Zero-Downtime Blue/Green Deployments.
- [ ] **Milestone 4**: Custom Domains, Automatic TLS/SSL Provisioning via Let's Encrypt, and Distributed Rate Limiting.
- [ ] **Milestone 5**: Advanced Observability, CPU/Memory Metrics Collector, and Webhook Notifications.

---

## 📝 License
MIT License © 2026 NetLaunch Engineering Team.
