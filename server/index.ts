import { handleWsUpgrade, handleWsMessage, handleWsClose } from "./ws/handler";
import { healthRoute } from "./routes/health";
import { ptyRoutes } from "./routes/pty";
import { workspaceRoutes } from "./routes/workspace";
import { sessionRoutes } from "./routes/session";
import { gitRoutes } from "./routes/git";
import { fsRoutes } from "./routes/fs";
import { editorRoutes } from "./routes/editor";
import { initDb } from "./services/db";

const PORT = parseInt(process.env.BORD_PORT ?? "4200");
const ALLOWED_ORIGIN = process.env.BORD_CORS_ORIGIN ?? "http://localhost:1420";

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

    // CORS headers - restrict to known origin
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
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
