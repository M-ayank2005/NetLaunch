import { deploymentWorker } from "./services/queue";
import { workerLogger } from "./services/logger";

async function main() {
  console.log("==========================================");
  console.log("⚡ NetLaunch Build Engine & BullMQ Worker");
  console.log("==========================================");

  // Handle graceful shutdown on SIGINT / SIGTERM
  const shutdown = async () => {
    console.log("\n🛑 Shutting down NetLaunch Worker gracefully...");
    await deploymentWorker.close();
    await workerLogger.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("❌ Fatal error during Worker startup:", err);
  process.exit(1);
});
