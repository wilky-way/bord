import type { ServerWebSocket } from "bun";
import { attachWs, detachWs, writeToPty, resizePty, configurePty } from "../services/pty-manager";

interface WsData {
  path: string;
  query: string;
}

export function handleWsUpgrade(ws: ServerWebSocket<WsData>) {
  const { path, query } = ws.data;

  // /ws/pty/:id - attach to existing PTY session
  const ptyMatch = path.match(/^\/ws\/pty\/(.+)$/);
  if (ptyMatch) {
    const ptyId = ptyMatch[1];

    // Parse cursor from query string for replay
    const params = new URLSearchParams(query);
    const clientCursor = parseInt(params.get("cursor") ?? "0", 10) || 0;

    const attached = attachWs(ptyId, ws as ServerWebSocket<{ path: string }>, clientCursor);
    if (!attached) {
      ws.close(4004, `PTY session ${ptyId} not found`);
    }
    return;
  }

  ws.close(4000, "Unknown WebSocket path");
}

export function handleWsMessage(ws: ServerWebSocket<WsData>, message: string | Buffer) {
  const path = ws.data.path;
  const ptyMatch = path.match(/^\/ws\/pty\/(.+)$/);
  if (!ptyMatch) return;

  const ptyId = ptyMatch[1];

  // Binary data = raw terminal input
  if (message instanceof Buffer || message instanceof Uint8Array) {
    writeToPty(ptyId, message as Uint8Array);
    return;
  }

  // String data = could be JSON control frame or raw text input
  if (typeof message === "string") {
    try {
      const ctrl = JSON.parse(message);
      if (ctrl.type === "resize" && typeof ctrl.cols === "number" && typeof ctrl.rows === "number") {
        const cols = Math.max(2, Math.min(1000, Math.floor(ctrl.cols)));
        const rows = Math.max(1, Math.min(500, Math.floor(ctrl.rows)));
        resizePty(ptyId, cols, rows);
        return;
      }
      if (ctrl.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }
      if (ctrl.type === "configure" && typeof ctrl.idleThresholdMs === "number") {
        configurePty(ptyId, ctrl.idleThresholdMs);
        return;
      }
    } catch {
      // Not JSON, treat as raw input
    }
    writeToPty(ptyId, message);
  }
}

export function handleWsClose(ws: ServerWebSocket<WsData>) {
  const path = ws.data.path;
  const ptyMatch = path.match(/^\/ws\/pty\/(.+)$/);
  if (ptyMatch) {
    detachWs(ptyMatch[1], ws as ServerWebSocket<{ path: string }>);
  }
}
