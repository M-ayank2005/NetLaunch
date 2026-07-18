# 04. GitHub App Integration & Project Management APIs Guide

## 1. Why GitHub Apps over Personal Access Tokens?
In legacy platforms, users granted complete read/write access to **every single repository** in their account via OAuth scopes (`repo`). This violates the **Principle of Least Privilege**.

Modern deployment platforms (Vercel, Railway, Netlify) use **GitHub Apps**.
* **Repository-Level Granularity**: When installing the NetLaunch GitHub App, the user chooses specific repositories (`alexrivera/next-portfolio` only) rather than their whole account.
* **Rotating Installation Access Tokens**: Instead of a permanent token that never expires, our backend generates short-lived (1 hour) tokens specifically for the installation when cloning or fetching branches.
* **Webhooks Out-of-the-Box**: GitHub Apps automatically deliver signed webhook events (`push`, `pull_request`) whenever code changes, triggering automatic background rebuilds.

---

## 2. GitHub App Authentication Mechanics (Internal Working)

How does NetLaunch authenticate to GitHub on behalf of an installation without a permanent user password?

```
NetLaunch API Server                    GitHub App API Layer
       │                                         │
       │── 1. Sign RS256 JWT using Private Key ──>│
       │      (Valid for 10 minutes maximum)     │
       │                                         │
       │── 2. POST /app/installations/:id/access_tokens ──>│
       │      Authorization: Bearer <App-JWT>              │
       │<── 3. Returns `ghs_InstallationToken...` (1 hr) ──│
       │                                         │
       │── 4. GET /installation/repositories ───>│
       │      Authorization: Bearer <InstallationToken>    │
       │<── 5. Returns Filtered Repositories List ─────────│
```

### Step-by-Step Implementation (`src/services/githubApp.ts`)
1. **`generateAppJwt()`**: Reads our RSA 256 private key (`GITHUB_APP_PRIVATE_KEY`) and signs a JSON payload containing our `GITHUB_APP_ID` with an expiration window of 10 minutes (`iat: now - 60, exp: now + 600`).
2. **`getInstallationAccessToken(installationId)`**: Sends the signed App JWT to GitHub's `/app/installations/:id/access_tokens` endpoint. GitHub verifies our RSA signature and returns an installation token (`ghs_...`) scoped strictly to the repositories chosen during installation.
3. **Repository Discovery (`/api/v1/github/repositories`)**: Uses that installation token to list repositories (`fetchAccessibleRepositories`). If the user hasn't granted access to private repo X, it will never appear in the list!

---

## 3. Project Creation & Deployment Trigger Pipeline (`src/routes/project.routes.ts`)

When a user clicks **"Deploy"** in the repository picker (`POST /api/v1/projects`), the backend executes a coordinated multi-table orchestration:

```json
{
  "name": "my-portfolio",
  "repoFullName": "alexrivera/next-portfolio",
  "repoId": 10101010,
  "defaultBranch": "main",
  "framework": "NEXT",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "envVars": [
    { "key": "NEXT_PUBLIC_API_URL", "value": "https://api.netlaunch.app/v1", "target": ["PRODUCTION"] }
  ]
}
```

### Execution Steps inside `POST /api/v1/projects`:
1. **Validation & Conflict Check**: Validates the payload using Zod (`CreateProjectSchema`) and ensures the slug (`my-portfolio`) isn't taken.
2. **Transaction Persistence (`prisma.project.create`)**:
   * Creates the `Project` record.
   * Automatically cascades creation of the initial default subdomain (`my-portfolio.netlaunch.app`) in the `Domain` table (`domains: { create: { ... } }`).
   * Saves any encrypted/target-scoped environment variables in the `EnvironmentVariable` table (`envVars: { createMany: { ... } }`).
3. **Create Initial `Deployment`**: Generates a `Deployment` snapshot with status `QUEUED`.
4. **Initial `BuildLog` Entry**: Writes `$ ⚡ Deployment job queued in BullMQ...` into the logs table.
5. **Push to Redis BullMQ (`queueDeploymentJob`)**: Pushes a job payload onto the `"deployment-build-queue"` in Redis (`deployQueue.add("build-project", { deploymentId, projectId, userId })`), where background workers wait to consume and build it!

---

## 4. Real-Time Log Streaming via Socket.IO & Redis PubSub (`src/socket/logStream.ts`)
When the browser opens the live build console:
* It connects via WebSocket (`ws://localhost:4000`) and emits `subscribe:deployment:logs` for `deploymentId`.
* Our Socket server joins that client socket to the room `"deployment:<deploymentId>"`.
* First, it emits all past logs (`deployment:log:history`) directly from PostgreSQL so the user immediately sees what has happened so far.
* Next, as background workers execute terminal commands inside Docker containers, they publish stdout lines to Redis PubSub (`deployment:logs:<deploymentId>`). Our Socket subscriber captures these messages and broadcasts them instantaneously (`deployment:log:new`) to all clients inside that room, triggering smooth glowing step animations in the frontend UI!
