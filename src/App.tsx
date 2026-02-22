import { onCleanup, onMount } from "solid-js";
import TopBar from "./components/layout/TopBar";
import Sidebar from "./components/layout/Sidebar";
import TilingLayout from "./components/layout/TilingLayout";
import UpdateBanner from "./components/UpdateBanner";
import { addTerminal, removeTerminal, activateAdjacentTerminal } from "./store/terminals";
import { state, setState } from "./store/core";
import { toggleGitPanel } from "./store/git";
import { setSettingsOpen } from "./store/settings";
import { initUpdater } from "./lib/updater";

export default function App() {
  onMount(() => {
    initUpdater();

    const onKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N: New terminal in active workspace
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        if (!state.activeWorkspaceId) return;
        const activePath = state.workspaces.find((w) => w.id === state.activeWorkspaceId)?.path;
        addTerminal(activePath);
      }
      // Cmd+T: New terminal (alias for Cmd+N)
      if ((e.ctrlKey || e.metaKey) && e.key === "t" && !e.shiftKey) {
        e.preventDefault();
        if (!state.activeWorkspaceId) return;
        const activePath = state.workspaces.find((w) => w.id === state.activeWorkspaceId)?.path;
        addTerminal(activePath);
      }
      // Cmd+W: Close active terminal
      if ((e.ctrlKey || e.metaKey) && e.key === "w" && !e.shiftKey) {
        e.preventDefault();
        const id = state.activeTerminalId;
        if (!id) return;
        const visible = state.terminals.filter((t) => !t.stashed && t.workspaceId === state.activeWorkspaceId);
        if (visible.length <= 1) return; // Don't close last terminal
        removeTerminal(id);
      }
      // Cmd+,: Open settings
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
      // Cmd+Shift+Arrow: Navigate between terminals (explicit)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "ArrowLeft") {
        e.preventDefault();
        activateAdjacentTerminal("prev");
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "ArrowRight") {
        e.preventDefault();
        activateAdjacentTerminal("next");
      }
      // Cmd+Arrow: Navigate between terminals (fallback when no terminal intercepts)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "ArrowLeft" && !e.defaultPrevented) {
        e.preventDefault();
        activateAdjacentTerminal("prev");
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "ArrowRight" && !e.defaultPrevented) {
        e.preventDefault();
        activateAdjacentTerminal("next");
      }
      // Cmd+G / Ctrl+G: Toggle git panel on active terminal
      if ((e.metaKey || e.ctrlKey) && e.key === "g") {
        e.preventDefault();
        toggleGitPanel(state.activeTerminalId);
      }
      // Cmd+B / Ctrl+B: Toggle sidebar expanded/collapsed
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setState("sidebarOpen", (v) => !v);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  return (
    <div class="flex flex-col h-screen w-screen overflow-hidden">
      <UpdateBanner />
      <TopBar />
      <div class="flex flex-1 min-h-0">
        <Sidebar />
        <TilingLayout />
      </div>
    </div>
  );
}
