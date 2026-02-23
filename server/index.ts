import { handleWsUpgrade, handleWsMessage, handleWsClose } from "./ws/handler";
import { healthRoute } from "./routes/health";
import { ptyRoutes } from "./routes/pty";
import { workspaceRoutes } from "./routes/workspace";
import { sessionRoutes } from "./routes/session";
import { gitRoutes } from "./routes/git";
import { fsRoutes } from "./routes/fs";
import { editorRoutes } from "./routes/editor";
import { dockerRoutes } from "./routes/docker";
import { clipboardRoutes } from "./routes/clipboard";
import { featureRoutes } from "./routes/features";
import { initDb } from "./services/db";
import { isFeatureEnabled } from "./services/feature-flags";

const PORT = parseInt(process.env.BORD_PORT ?? "4200");
const ALLOWED_ORIGINS = [
  process.env.BORD_CORS_ORIGIN ?? "http://localhost:1420",
  "tauri://localhost",
  "https://tauri.localhost",
];

// Initialize database
initDb();

const server = Bun.serve({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade for terminal connections
    if (url.pathname.startsWith("/ws/")) {
      const upgraded = server.upgrade(req, {
        data: { path: url.pathname, query: url.search.slice(1) },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // CORS headers - restrict to known origins
    const origin = req.headers.get("origin") ?? "";
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    const corsHeaders = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Feature flag gating
    if (url.pathname.startsWith("/api/git") && !isFeatureEnabled("git")) {
      return Response.json({ error: "Git integration is disabled" }, { status: 404, headers: corsHeaders });
    }
    if (url.pathname.startsWith("/api/docker") && !isFeatureEnabled("docker")) {
      return Response.json({ error: "Docker integration is disabled" }, { status: 404, headers: corsHeaders });
    }
    if (url.pathname.startsWith("/api/sessions") && !isFeatureEnabled("sessions")) {
      return Response.json({ error: "Session history is disabled" }, { status: 404, headers: corsHeaders });
    }

    // Route matching
    let response: Response | null = null;

    if (url.pathname === "/api/health") {
      response = healthRoute(req);
    } else if (url.pathname.startsWith("/api/pty")) {
      response = await ptyRoutes(req, url);
    } else if (url.pathname.startsWith("/api/workspaces")) {
      response = await workspaceRoutes(req, url);
    } else if (url.pathname.startsWith("/api/sessions")) {
      response = await sessionRoutes(req, url);
    } else if (url.pathname.startsWith("/api/git")) {
      response = await gitRoutes(req, url);
    } else if (url.pathname.startsWith("/api/fs")) {
      response = await fsRoutes(req, url);
    } else if (url.pathname.startsWith("/api/editor")) {
      response = await editorRoutes(req, url);
    } else if (url.pathname.startsWith("/api/docker")) {
      response = await dockerRoutes(req, url);
    } else if (url.pathname.startsWith("/api/clipboard")) {
      response = await clipboardRoutes(req, url);
    } else if (url.pathname.startsWith("/api/features")) {
      response = await featureRoutes(req, url);
    }

    if (response) {
      // Add CORS headers to all responses
      for (const [key, value] of Object.entries(corsHeaders)) {
        response.headers.set(key, value);
      }
      return response;
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
  websocket: {
    open(ws) {
      handleWsUpgrade(ws);
    },
    message(ws, message) {
      handleWsMessage(ws, message);
    },
    close(ws) {
      handleWsClose(ws);
    },
  },
});

console.log(`[bord] server running on http://localhost:${server.port}`);
