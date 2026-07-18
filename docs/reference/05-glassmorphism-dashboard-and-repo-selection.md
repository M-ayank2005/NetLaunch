# 05. Glassmorphism Control Plane UI & Real-Time Animations Guide

## 1. Architectural Role of `apps/web` (Control Plane vs Build Engine)
The frontend in NetLaunch (`apps/web`) never compiles code, runs Docker containers, or directly manipulates object storage buckets. It is purely a **Control Plane** and visualization interface built with **Next.js 15 (App Router) + TypeScript + Tailwind CSS**.

### Strict Aesthetic Principles:
* **Zero AI Gradients Rule**: We strictly avoid cliché radial gradients, glowing colorful washes, or neon rainbow text. Instead, NetLaunch uses pure obsidian canvas (`#09090b`), high-contrast monochrome tokens, subtle 1px crisp borders (`border-zinc-800/80`), and curated functional colors (emerald for ready, blue for building, amber for queued).
* **Glassmorphism Layering**: Panels use `bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/80 shadow-2xl`. When elevated over our subtle ambient grid, it gives an ultra-clean, premium depth without visual clutter.

---

## 2. Component Design System (`packages/ui`)

To share visual primitives across our entire platform, we built `@netlaunch/ui`:
1. **`GlassCard`**: High-end container with hover micro-animations (`hover:-translate-y-0.5`) and an ultra-fine 1px top highlight (`bg-white/[0.07]`) simulating natural overhead light reflection on glass.
2. **`StatusBadge`**: Displays deployment status (`READY`, `BUILDING`, `QUEUED`, `FAILED`). When a build is `BUILDING`, it renders an animated pulsing radar ring (`animate-ping`) so developers can instantly spot running builds across large grids.
3. **`AnimatedLogViewer`**: A custom terminal component powered by **Framer Motion (`framer-motion`)**. Instead of static text blocks, each incoming log entry (`deployment:log:new`) smoothly slides and fades into view (`initial: { opacity: 0, y: 6 }`), auto-scrolling the scrollbar smoothly while rendering crisp command indicators (`$` chevron) and timestamps.

---

## 3. Core User Flows & UI Architecture

```
Landing Page (`/`)
   │
   ├── [Continue with GitHub] ──> OAuth API (`/api/v1/auth/github`) ──> Dashboard (`/dashboard`)
   │                                                                           │
   └───────────────────────────────────────────────────────────────────────────┤
                                                                               ▼
                                                                  Dashboard Project Grid
                                                                  (Live Status Bar & Search)
                                                                               │
                                                                       [New Project]
                                                                               │
                                                                               ▼
                                                                  Wizard (`/new`)
                                                                  1. Pick GitHub Installation
                                                                  2. Filter Authorized Repos
                                                                  3. Auto-Detect Framework
                                                                  4. Configure Environment Vars
                                                                               │
                                                                      [Deploy Project]
                                                                               │
                                                                               ▼
                                                                  Project Detail (`/projects/[id]`)
                                                                  Socket.IO WebSocket Connection
                                                                  (`subscribe:deployment:logs`)
                                                                  Live Animated Terminal Stream!
```

---

## 4. Deep Dive into the Live Terminal Stream (`src/app/projects/[id]/page.tsx`)

When a developer clicks into a project or triggers a manual redeploy (`POST /api/v1/projects/:id/deploy`):
1. **WebSocket Handshake**: The client connects to `ws://localhost:4000` via `socket.io-client` and emits `subscribe:deployment:logs` with the active deployment ID.
2. **History Hydration**: The server instantly returns past log lines (`deployment:log:history`) from PostgreSQL so the terminal window displays past execution steps without delay.
3. **Real-Time Step Animation**: As background workers run terminal commands inside isolated Docker containers (`$ pnpm install`, `vite building for production...`), they publish lines to Redis PubSub. Our API broadcasts these over the socket (`deployment:log:new`).
4. **Framer Motion Rendering**: The `AnimatedLogViewer` receives each line and animates it into the terminal console, automatically updating the deployment status badge to `READY` when the final bundle upload completes!
