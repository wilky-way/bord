import { createSignal } from "solid-js";
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
