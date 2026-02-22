import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./workspace-picker";

let httpBase = "";
let wsBase = "";
let initialized = false;

export async function initServerUrl() {
  if (initialized) return;
  initialized = true;

  if (isTauriRuntime()) {
    try {
      const port = await invoke<number>("get_server_port");
      console.log("[bord] Tauri sidecar port:", port);
      if (port > 0) {
        httpBase = `http://localhost:${port}`;
        wsBase = `ws://localhost:${port}`;
      }
    } catch (err) {
      console.warn("[bord] failed to get server port from Tauri:", err);
    }
  }

  // Fallback: in Tauri production the origin is tauri://localhost which
  // isn't fetchable, so only use origin when it's http(s)
  if (!httpBase) {
    const origin = window.location.origin;
    if (origin.startsWith("http")) {
      httpBase = origin;
    } else {
      // Last resort: assume dev server
      httpBase = "http://localhost:4200";
    }
  }
  if (!wsBase) {
    const loc = window.location;
    if (loc.protocol === "http:" || loc.protocol === "https:") {
      const proto = loc.protocol === "https:" ? "wss:" : "ws:";
      wsBase = `${proto}//${loc.host}`;
    } else {
      wsBase = "ws://localhost:4200";
    }
  }

  console.log("[bord] server urls:", { httpBase, wsBase });
}

export function getHttpBase(): string {
  return httpBase;
}

export function getWsBase(): string {
  return wsBase;
}
