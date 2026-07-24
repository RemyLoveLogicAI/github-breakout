"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const http = __importStar(require("http"));
const path = __importStar(require("path"));
const svg_1 = require("./svg");
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN || "";
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const MIME_TYPES = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
};
function sendJson(res, status, payload) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
}
function handleApi(req, res, url) {
    return __awaiter(this, void 0, void 0, function* () {
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
        const options = {
            enableGhostBricks,
            paddleColor,
            ballColor,
        };
        if (theme === "github_dark") {
            options.bricksColors = "github_dark";
        }
        else if (theme === "github_light") {
            options.bricksColors = "github_light";
        }
        else if (rawBricks) {
            const colors = rawBricks.split(",").map((c) => c.trim());
            if (colors.length === 5) {
                options.bricksColors = colors;
            }
        }
        try {
            const svg = yield (0, svg_1.generateSVG)(username, GITHUB_TOKEN, options);
            res.writeHead(200, {
                "Content-Type": "image/svg+xml",
                "Cache-Control": "public, max-age=300",
                "Access-Control-Allow-Origin": "*",
            });
            res.end(svg);
        }
        catch (err) {
            sendJson(res, 502, {
                error: "Failed to generate SVG",
                details: err instanceof Error ? err.message : String(err),
            });
        }
    });
}
function serveStatic(req, res, url) {
    let filePath = path.join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname);
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
