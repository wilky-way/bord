import { setState } from "./core";

export function toggleSidebar() {
  setState("sidebarOpen", (v) => !v);
}
