import { createProxyApp } from "./server";
import { env } from "./config/env";
import { proxyResolver } from "./services/resolver";

async function main() {
  console.log("==================================================");
  console.log("🌐 NetLaunch Edge Reverse Proxy & Routing Engine");
  console.log("==================================================");

  const app = createProxyApp();

  const server = app.listen(env.PROXY_PORT, () => {
    console.log(`🚀 [Edge Proxy] Listening on HTTP port ${env.PROXY_PORT}`);
    console.log(`🔗 Wildcard Base Domain: *.${env.BASE_DOMAIN}`);
  });

  const shutdown = async () => {
    console.log("\n🛑 Shutting down NetLaunch Edge Proxy gracefully...");
    server.close();
    await proxyResolver.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("❌ Fatal error starting Edge Proxy:", err);
  process.exit(1);
});
