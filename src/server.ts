import * as fs from "fs";
import * as http from "http";
import * as path from "path";

import { generateSVG, Options } from "./svg";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const GITHUB_TOKEN =
  process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN || "";

const PUBLIC_DIR = path.join(__dirname, "..", "public");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function sendJson(
  res: http.ServerResponse,
  status: number,
  payload: Record<string, unknown>,
) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
) {
  const username = url.searchParams.get("username");
  const theme = url.searchParams.get("theme") || "github_light";
  const enableGhostBricks = url.searchParams.get("ghost") !== "false";
  const paddleColor = url.searchParams.get("paddle") || "#1F6FEB";
  const ballColor = url.searchParams.get("ball") || "#1F6FEB";
  const rawBricks = url.searchParams.get("bricks");

  if (!username) {
    sendJson(res, 400, { error: "Missing 'username' query parameter" });
    return;
  }

  if (!GITHUB_TOKEN) {
    sendJson(res, 500, { error: "GitHub token not configured on server" });
    return;
  }

  const options: Options = {
    enableGhostBricks,
    paddleColor,
    ballColor,
  };

  if (theme === "github_dark") {
    options.bricksColors = "github_dark";
  } else if (theme === "github_light") {
    options.bricksColors = "github_light";
  } else if (rawBricks) {
    const colors = rawBricks.split(",").map((c) => c.trim());
    if (colors.length === 5) {
      options.bricksColors = colors as [string, string, string, string, string];
    }
  }

  try {
    const svg = await generateSVG(username, GITHUB_TOKEN, options);
    res.writeHead(200, {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(svg);
  } catch (err) {
    sendJson(res, 502, {
      error: "Failed to generate SVG",
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

function serveStatic(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
) {
  let filePath = path.join(
    PUBLIC_DIR,
    url.pathname === "/" ? "index.html" : url.pathname,
  );

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 500, { error: "Failed to read file" });
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    });
    res.end();
    return;
  }

  if (url.pathname === "/api/breakout") {
    handleApi(req, res, url).catch((err) => {
      sendJson(res, 500, { error: "Unexpected error", details: String(err) });
    });
    return;
  }

  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`GitHub Breakout demo running on http://localhost:${PORT}`);
});
