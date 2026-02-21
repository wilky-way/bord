import { onMount } from "solid-js";
import TopBar from "./components/layout/TopBar";
import Sidebar from "./components/layout/Sidebar";
import TilingLayout from "./components/layout/TilingLayout";
import { addTerminal, activateAdjacentTerminal } from "./store/terminals";
import { state } from "./store/core";
import { toggleGitPanel } from "./store/git";

export default function App() {
  onMount(() => {
    window.addEventListener("keydown", (e) => {
      // Ctrl+N: New terminal in active workspace
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        const activePath = state.workspaces.find((w) => w.id === state.activeWorkspaceId)?.path;
        addTerminal(activePath);
      }
      // Cmd+Arrow: Navigate between terminals
      if ((e.metaKey || e.ctrlKey) && e.key === "ArrowLeft") {
        e.preventDefault();
        activateAdjacentTerminal("prev");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "ArrowRight") {
        e.preventDefault();
        activateAdjacentTerminal("next");
      }
      // Cmd+G / Ctrl+G: Toggle git panel on active terminal
      if ((e.metaKey || e.ctrlKey) && e.key === "g") {
        e.preventDefault();
        toggleGitPanel(state.activeTerminalId);
      }
    });
  });

  return (
    <div class="flex flex-col h-screen w-screen overflow-hidden">
      <TopBar />
      <div class="flex flex-1 min-h-0">
        <Sidebar />
        <TilingLayout />
      </div>
    </div>
  );
}
