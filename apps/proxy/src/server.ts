import express, { Application, Request, Response } from "express";
import fs from "fs";
import path from "path";
import mime from "mime-types";
import httpProxy from "http-proxy";
import { proxyResolver } from "./services/resolver";
import { proxyCache } from "./services/cache";

export function createProxyApp(): Application {
  const app = express();
  const proxy = httpProxy.createProxyServer({});

  proxy.on("error", (err, _req, res) => {
    console.error("❌ [HttpProxy] Forwarding error:", err.message);
    if ("writeHead" in res && !res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/html" });
      res.end("<h1>502 Bad Gateway</h1><p>NetLaunch Edge Proxy encountered an error forwarding to target runtime.</p>");
    } else if ("destroy" in res) {
      res.destroy();
    }
  });

  // Main edge request handler
  app.use(async (req: Request, res: Response) => {
    const hostHeader = req.headers.host;

    // 1. Resolve host to active deployment
    const resolved = await proxyResolver.resolveHost(hostHeader);
    if (!resolved) {
      return sendNotFoundPage(res, hostHeader || "unknown");
    }

    try {
      // 2. Ensure artifact bundle is downloaded and extracted
      const extractedDir = await proxyCache.getExtractedPath(resolved);

      // Clean request path
      const reqPath = decodeURIComponent(req.path);
      let targetFile = path.join(extractedDir, reqPath);

      // Prevent directory traversal attacks out of extractedDir
      if (!targetFile.startsWith(path.resolve(extractedDir))) {
        return res.status(403).send("403 Forbidden");
      }

      // Check if exact file exists
      if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
        return serveStaticFile(res, targetFile, reqPath);
      }

      // Check if Next.js static route exists (e.g. /about -> /about.html or /about/index.html)
      const htmlFile = `${targetFile}.html`;
      if (fs.existsSync(htmlFile) && fs.statSync(htmlFile).isFile()) {
        return serveStaticFile(res, htmlFile, reqPath);
      }

      const indexFile = path.join(targetFile, "index.html");
      if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
        return serveStaticFile(res, indexFile, reqPath);
      }

      // Fallback: Check root index.html for Single Page Applications (SPA / React / Vite routing)
      const rootIndex = path.join(extractedDir, "index.html");
      if (fs.existsSync(rootIndex) && fs.statSync(rootIndex).isFile()) {
        return serveStaticFile(res, rootIndex, reqPath);
      }

      // Check 404.html
      const custom404 = path.join(extractedDir, "404.html");
      if (fs.existsSync(custom404) && fs.statSync(custom404).isFile()) {
        res.status(404);
        return serveStaticFile(res, custom404, reqPath);
      }

      return res.status(404).send("404 Not Found inside static artifact bundle.");
    } catch (err: any) {
      console.error(`❌ [ProxyServer] Error serving deployment ${resolved.deploymentId}:`, err);
      return res.status(500).send("<h1>500 Internal Server Error</h1><p>NetLaunch Edge Proxy failed to extract or read deployment artifact.</p>");
    }
  });

  return app;
}

function serveStaticFile(res: Response, filePath: string, reqPath: string): void {
  const contentType = mime.lookup(filePath) || "application/octet-stream";
  res.setHeader("Content-Type", contentType);

  // Set aggressive edge caching headers for hashed static assets
  if (reqPath.startsWith("/assets/") || reqPath.startsWith("/_next/static/") || reqPath.includes("-")) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else if (filePath.endsWith(".html") || reqPath === "/") {
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  } else {
    res.setHeader("Cache-Control", "public, max-age=86400");
  }

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
}

function sendNotFoundPage(res: Response, host: string): void {
  res.status(404).setHeader("Content-Type", "text/html");
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Deployment Not Found | NetLaunch</title>
  <style>
    body {
      background-color: #09090b;
      color: #e4e4e7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      text-align: center;
    }
    .card {
      background: rgba(24, 24, 27, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 3rem;
      max-width: 480px;
      backdrop-filter: blur(12px);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }
    h1 { font-size: 1.75rem; margin-bottom: 0.75rem; color: #fff; }
    p { color: #a1a1aa; line-height: 1.6; margin-bottom: 1.5rem; font-size: 0.95rem; }
    code {
      background: rgba(255, 255, 255, 0.08);
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      color: #38bdf8;
      font-size: 0.85rem;
    }
    .brand {
      margin-top: 2rem;
      font-size: 0.8rem;
      color: #71717a;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 Deployment Not Found</h1>
    <p>The hostname <code>${host}</code> is not currently mapped to an active or verified NetLaunch project deployment.</p>
    <p>If you recently deployed this project, ensure the build completed successfully in your NetLaunch dashboard.</p>
    <div class="brand">⚡ Powered by NetLaunch Edge Engine</div>
  </div>
</body>
</html>
  `);
}
