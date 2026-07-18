import { prisma, DeploymentStatus } from "./index";

async function main() {
  console.log("🌱 Starting NetLaunch Database Seed...");

  // 1. Clean existing records (for idempotent re-seeding)
  await prisma.buildLog.deleteMany();
  await prisma.deployment.deleteMany();
  await prisma.environmentVariable.deleteMany();
  await prisma.domain.deleteMany();
  await prisma.project.deleteMany();
  await prisma.gitHubInstallation.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Mock Developer User
  const user = await prisma.user.create({
    data: {
      email: "alex@netlaunch.app",
      name: "Alex Rivera (Lead Engineer)",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
      githubId: "99887766",
      githubUsername: "alexrivera",
    },
  });
  console.log(`👤 Created Mock User: ${user.githubUsername} (${user.email})`);

  // 3. Create Mock GitHub Installation
  const installation = await prisma.gitHubInstallation.create({
    data: {
      installationId: BigInt(55443322),
      accountLogin: "alexrivera",
      accountType: "User",
      accountAvatar: user.avatarUrl,
      userId: user.id,
    },
  });
  console.log(`🔗 Created GitHub Installation: ID ${installation.installationId}`);

  // 4. Create Sample Projects
  const portfolioProject = await prisma.project.create({
    data: {
      name: "alex-next-portfolio",
      repoFullName: "alexrivera/next-portfolio",
      repoId: BigInt(10101010),
      defaultBranch: "main",
      framework: "NEXT",
      buildCommand: "npm run build",
      outputDirectory: ".next",
      installCommand: "npm install",
      rootDirectory: "./",
      userId: user.id,
      installationId: installation.id,
    },
  });

  const apiProject = await prisma.project.create({
    data: {
      name: "cyber-analytics-dashboard",
      repoFullName: "alexrivera/cyber-analytics",
      repoId: BigInt(20202020),
      defaultBranch: "main",
      framework: "VITE",
      buildCommand: "npm run build",
      outputDirectory: "dist",
      installCommand: "npm install",
      rootDirectory: "./",
      userId: user.id,
      installationId: installation.id,
    },
  });

  console.log(`🚀 Created Projects: ${portfolioProject.name}, ${apiProject.name}`);

  // 5. Create Sample Environment Variables
  await prisma.environmentVariable.createMany({
    data: [
      {
        key: "NEXT_PUBLIC_API_URL",
        value: "https://api.netlaunch.app/v1",
        target: ["PRODUCTION", "PREVIEW"],
        projectId: portfolioProject.id,
      },
      {
        key: "DATABASE_URL",
        value: "postgresql://user:secret@prod-db.internal:5432/portfolio",
        target: ["PRODUCTION"],
        projectId: portfolioProject.id,
      },
      {
        key: "VITE_APP_TITLE",
        value: "Cyber Analytics Platform v2.4",
        target: ["PRODUCTION", "PREVIEW"],
        projectId: apiProject.id,
      },
    ],
  });

  // 6. Create Domains
  await prisma.domain.createMany({
    data: [
      {
        name: "alex-portfolio.netlaunch.app",
        projectId: portfolioProject.id,
        isVerified: true,
        isPrimary: true,
      },
      {
        name: "portfolio.alexrivera.dev",
        projectId: portfolioProject.id,
        isVerified: true,
        isPrimary: false,
      },
      {
        name: "analytics.netlaunch.app",
        projectId: apiProject.id,
        isVerified: true,
        isPrimary: true,
      },
    ],
  });

  // 7. Create Sample Deployments with Logs
  const readyDeployment = await prisma.deployment.create({
    data: {
      projectId: portfolioProject.id,
      userId: user.id,
      status: DeploymentStatus.READY,
      commitHash: "e4f9b2d8a1c78e90123456789abcdef012345678",
      commitMessage: "feat: add glassmorphism hero section & animated metrics",
      commitAuthor: "Alex Rivera",
      branch: "main",
      url: "alex-portfolio.netlaunch.app",
      durationMs: 45200,
      startedAt: new Date(Date.now() - 3600 * 1000),
      finishedAt: new Date(Date.now() - 3600 * 1000 + 45200),
    },
  });

  await prisma.buildLog.createMany({
    data: [
      { deploymentId: readyDeployment.id, level: "COMMAND", message: "⚡ NetLaunch Worker #04 initializing container build environment..." },
      { deploymentId: readyDeployment.id, level: "INFO", message: "📥 Cloning repository alexrivera/next-portfolio @ commit e4f9b2d..." },
      { deploymentId: readyDeployment.id, level: "INFO", message: "📦 Framework detected: Next.js 15 (App Router)" },
      { deploymentId: readyDeployment.id, level: "COMMAND", message: "$ npm install" },
      { deploymentId: readyDeployment.id, level: "INFO", message: "added 342 packages in 14.2s" },
      { deploymentId: readyDeployment.id, level: "COMMAND", message: "$ npm run build" },
      { deploymentId: readyDeployment.id, level: "INFO", message: "▲ Next.js 15.0.2 - Creating an optimized production build..." },
      { deploymentId: readyDeployment.id, level: "INFO", message: "✓ Compiled successfully across 24 static pages and 8 API routes." },
      { deploymentId: readyDeployment.id, level: "INFO", message: "🚀 Uploading 14.8 MB build bundle to MinIO Object Storage (netlaunch-artifacts)..." },
      { deploymentId: readyDeployment.id, level: "INFO", message: "✨ Deployment complete! Domain active at https://alex-portfolio.netlaunch.app" },
    ],
  });

  const buildingDeployment = await prisma.deployment.create({
    data: {
      projectId: apiProject.id,
      userId: user.id,
      status: DeploymentStatus.BUILDING,
      commitHash: "b7c3a1e0987654321fedcba0987654321abcdef0",
      commitMessage: "fix: optimize real-time websocket packet throughput",
      commitAuthor: "Alex Rivera",
      branch: "main",
      url: "analytics-building-xyz.netlaunch.app",
      startedAt: new Date(Date.now() - 30 * 1000),
    },
  });

  await prisma.buildLog.createMany({
    data: [
      { deploymentId: buildingDeployment.id, level: "COMMAND", message: "⚡ NetLaunch Worker #02 assigning build job..." },
      { deploymentId: buildingDeployment.id, level: "INFO", message: "📥 Cloning repository alexrivera/cyber-analytics @ commit b7c3a1e..." },
      { deploymentId: buildingDeployment.id, level: "INFO", message: "📦 Framework detected: Vite + React 19" },
      { deploymentId: buildingDeployment.id, level: "COMMAND", message: "$ npm install" },
      { deploymentId: buildingDeployment.id, level: "INFO", message: "added 184 packages in 8.4s" },
      { deploymentId: buildingDeployment.id, level: "COMMAND", message: "$ npm run build" },
      { deploymentId: buildingDeployment.id, level: "INFO", message: "vite v5.4.1 building for production..." },
    ],
  });

  console.log("✅ Seed successfully finished! Database populated with realistic mock data.");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
