# 01. Monorepo Architecture & Local Infrastructure Guide

## 1. Overview & Architectural Vision
NetLaunch is built as an enterprise-grade cloud deployment engine. To maintain high engineering velocity, strict type safety, and clear boundaries across services, we utilize a **Turborepo + pnpm monorepo**.

Instead of spreading code across multiple disparate repositories or dumping everything into an unstructured monolith, our monorepo divides responsibilities into specific **Applications (`apps/*`)** and **Packages (`packages/*`)**.

---

## 2. Monorepo Structure & Responsibilities

```text
netlaunch/
├── apps/
│   ├── web/                 # Next.js 15 Control Plane UI (Glassmorphism dark theme)
│   ├── api/                 # Express + TypeScript REST/WebSocket API Server
│   └── worker/              # Node.js + BullMQ Consumer & Docker Build Runner
├── packages/
│   ├── config/              # Shared base configurations (TypeScript tsconfigs)
│   ├── shared/              # Zod validation schemas, common DTOs, constants, enums
│   ├── database/            # Prisma ORM, PostgreSQL schema, migrations, DB client
│   └── ui/                  # Shared Glassmorphism design system primitives
└── infrastructure/
    └── docker-compose.yml   # Local environment (PostgreSQL 16, Redis 7, MinIO)
```

### Why pnpm Workspaces + Turborepo?
1. **Single Source of Truth for Types**: When the database schema changes in `packages/database` or an API validation schema changes in `packages/shared`, the frontend (`apps/web`) and API (`apps/api`) get instant TypeScript type verification without publishing npm packages.
2. **Aggressive Build Caching**: `turbo.json` caches build artifacts (`dist`, `.next`) based on git content hashes. If `packages/shared` hasn't changed, Turborepo skips rebuilding it and restores outputs instantly from cache.
3. **Strict Dependency Isolation**: `pnpm` uses content-addressable storage and hard symlinks (`node_modules/.pnpm`). A package cannot accidentally import a dependency unless it is explicitly declared in its own `package.json`.

---

## 3. Local Infrastructure Stack (`infrastructure/docker-compose.yml`)

When running NetLaunch locally, we emulate the production cloud stack using three core containers:

### A. PostgreSQL 16 (`netlaunch-postgres`)
* **Role**: Primary relational data store.
* **Why**: Stores metadata ONLY (`Users`, `Projects`, `Deployments`, `GitHubInstallations`, `EnvironmentVariables`, `Domains`). We never store raw build logs, git repository files, or compiled web assets in PostgreSQL to keep queries fast and index sizes minimal.
* **Connection String**: `postgresql://netlaunch:netlaunch_secret_2026@localhost:5432/netlaunch_db?schema=public`

### B. Redis 7 (`netlaunch-redis`)
* **Role**: High-speed in-memory broker.
* **Responsibilities**:
  1. **BullMQ Job Queue**: Holds queued build jobs (`deploy-job`) with retry policies, backoff timers, and worker assignment.
  2. **WebSocket / PubSub Hub**: Streams live Docker build stdout/stderr from `worker` instances directly to the `api` and connected browser clients.
  3. **Rate Limiting & Session Storage**: Protects GitHub webhook ingestion endpoints against DDoS attacks.
* **Connection String**: `redis://localhost:6379` with password authentication.

### C. MinIO Object Storage (`netlaunch-minio`)
* **Role**: Local emulator for AWS S3 / Cloudflare R2 object storage.
* **Responsibilities**:
  1. **`netlaunch-artifacts` Bucket**: Stores finalized deployment bundles (static `.html`, `.css`, `.js`, assets) uploaded by `worker` containers.
  2. **`netlaunch-logs` Bucket**: Archives complete multi-gigabyte historical build logs once a deployment completes (`READY` or `FAILED`).
* **Buckets Auto-Initialization**: The `minio-createbuckets` helper container boots right after MinIO, creating both required buckets and setting read/download policies automatically.

---

## 4. How to Operate & Verify

```bash
# 1. Start persistent local infrastructure (Postgres, Redis, MinIO)
docker compose -f infrastructure/docker-compose.yml up -d

# 2. Check container health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 3. Build all packages and applications using Turborepo
pnpm turbo run build

# 4. Run local development servers with hot-reload
pnpm turbo run dev
```
