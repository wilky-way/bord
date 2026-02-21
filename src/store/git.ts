import { createSignal } from "solid-js";
import { state, setState } from "./core";
import { api } from "../lib/api";
import type { GitStatus } from "./types";

const [gitStatus, setGitStatus] = createSignal<GitStatus | null>(null);
const [gitLoading, setGitLoading] = createSignal(false);

export { gitStatus, gitLoading };

export async function refreshGitStatus(cwd: string) {
  setGitLoading(true);
  try {
    const status = await api.gitStatus(cwd);
    setGitStatus(status);
  } catch {
    setGitStatus(null);
  } finally {
    setGitLoading(false);
  }
}

export function toggleGitPanel(terminalId: string | null) {
  if (!terminalId) return;
  setState("gitPanelTerminalId", state.gitPanelTerminalId === terminalId ? null : terminalId);
}

export function closeGitPanel() {
  setState("gitPanelTerminalId", null);
}
