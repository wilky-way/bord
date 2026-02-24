import { setState } from "./core";

export function toggleSidebar() {
  setState("sidebarOpen", (v) => !v);
}

export function toggleSidebarMode() {
  setState("sidebarMode", (v) => (v === "sessions" ? "git" : "sessions"));
}

export function setSidebarMode(mode: "sessions" | "git") {
  setState("sidebarMode", mode);
}

export function setSidebarWidth(width: number) {
  setState("sidebarWidth", Math.max(200, Math.min(600, width)));
}
