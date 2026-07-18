# 02. Relational Database Design & Prisma ORM Guide

## 1. Why PostgreSQL for Metadata?
In a distributed deployment engine like NetLaunch, data is divided into two strict categories:
1. **Unstructured Binary / Bulk Files**: Source code tarballs, compiled `node_modules`, static `.html/.js/.css` assets, and historical multi-gigabyte build logs. (These go into **MinIO / AWS S3** object storage).
2. **Structured Transactional Metadata**: Users, GitHub identities, project configurations, deployment state machine transitions (`QUEUED -> BUILDING -> READY`), environment variables, and domains. (These go into **PostgreSQL**).

We choose **PostgreSQL 16** with **Prisma ORM** because relational integrity, ACID compliance, and foreign-key cascades (`onDelete: Cascade`) are mandatory to ensure that deleting a user or project instantly and cleanly cleans up all associated deployments, logs, and domain bindings without orphaned records.

---

## 2. Deep Dive into the Entity-Relationship Schema

```
User (1) ───< Project (N) ───< Deployment (N) ───< BuildLog (N)
 │               │                 │
 │               ├───< Domain (N)  └───> (Artifacts in Object Storage)
 │               └───< EnvironmentVariable (N)
 │
 └───< GitHubInstallation (N) ───> Project (1)
```

### Key Models & Design Decisions

#### A. `User` & `GitHubInstallation` (Least-Privilege Git Access)
* **`User`**: Represents an authenticated developer logged into the control plane via GitHub OAuth (`githubId`, `githubUsername`).
* **`GitHubInstallation`**: Represents a fine-grained GitHub App installation on either a personal account or a corporate GitHub Organization (`accountLogin`, `accountType: "User" | "Organization"`).
* **Why separate them?** A single developer might install the NetLaunch GitHub App on their personal account AND on three different company orgs (`acme-corp`, `startup-labs`). By decoupling `User` from `GitHubInstallation`, our control plane lets the user switch between orgs effortlessly, querying only the repositories authorized under that specific installation token.

#### B. `Project` (The Core Abstraction)
* Stores the build blueprint (`framework: NEXT | VITE | REACT | STATIC | NODE`, `buildCommand`, `outputDirectory`, `installCommand`).
* Connects the GitHub repository (`repoFullName`, `repoId`, `defaultBranch`) with both the owner (`userId`) and the authorization credential (`installationId`).
* **Indices (`@@index([userId])`, `@@index([repoFullName])`)**: Ensures ultra-fast lookups when rendering the dashboard grid or processing incoming GitHub webhooks.

#### C. `Deployment` & `DeploymentStatus` State Machine
* Each time code is pushed or manually triggered, a `Deployment` snapshot is created.
* **State Machine**:
  1. `QUEUED`: Job pushed to Redis BullMQ, waiting for a free worker.
  2. `BUILDING`: Worker picked up the job, spawned the isolated Docker build container.
  3. `READY`: Container finished successfully, artifacts uploaded to MinIO (`artifactPath`), live URL generated (`url`).
  4. `FAILED`: Build script threw an error, or timeout exceeded.
  5. `CANCELED`: User clicked cancel or superseded by a newer commit on the same branch.
* **`buildLogsUrl` vs `BuildLog` Table**: While active or recent deployments store log rows in the `BuildLog` table for real-time streaming, once a deployment completes, workers compress the full log stream and upload it to MinIO (`STORAGE_BUCKET_LOGS`), saving the URL in `buildLogsUrl` to keep the database small and fast.

#### D. `EnvironmentVariable` (Targeted Scoping)
* Stores key-value configuration strings per project (`NEXT_PUBLIC_API_URL`, `DATABASE_URL`).
* **`target: String[]`**: Allows scoping secrets to specific deployment environments (`["PRODUCTION"]`, `["PREVIEW"]`, or `["PRODUCTION", "PREVIEW"]`). When a worker starts a Docker build, it queries only the environment variables matching the target of the current branch (`main` = `PRODUCTION`, feature branch = `PREVIEW`).

#### E. `Domain` (Dynamic Ingress Routing)
* Stores custom domains (`portfolio.alexrivera.dev`) and NetLaunch subdomains (`alex-portfolio.netlaunch.app`).
* When our reverse proxy (`Nginx` / `proxy service`) receives an HTTP request for `alex-portfolio.netlaunch.app`, it checks this table to resolve which project and deployment artifact path to serve.

---

## 3. Prisma Client Singleton (`src/index.ts`)
To prevent connection pool exhaustion during Next.js hot-reloading in development (`Too many clients already`), we export a global singleton (`globalThis.prisma`). In development, query logging is enabled (`["query", "error", "warn"]`) so engineers can inspect exact SQL execution times and spot N+1 query bottlenecks immediately.

---

## 4. Seeding & Mock Data (`src/seed.ts`)
We created an automated seed tool (`pnpm --filter @netlaunch/database db:seed`) that populates local environments with:
* Mock User (`alex@netlaunch.app` / `alexrivera`)
* Mock GitHub Installation (`ID: 55443322`)
* Two Projects (`alex-next-portfolio` and `cyber-analytics-dashboard`)
* Custom and NetLaunch Subdomains
* A completed `READY` deployment with 10 realistic build log entries (`$ npm install`, `▲ Next.js 15.0.2 build...`)
* A currently `BUILDING` deployment for Vite/React to test animated live log streams in the UI.
