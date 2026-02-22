import { createSignal } from "solid-js";

export type UpdateStatus = "idle" | "checking" | "downloading" | "installing";

const [updateAvailable, setUpdateAvailable] = createSignal(false);
const [updateVersion, setUpdateVersion] = createSignal("");
const [updateStatus, setUpdateStatus] = createSignal<UpdateStatus>("idle");
const [dismissed, setDismissed] = createSignal(false);

export { updateAvailable, updateVersion, updateStatus, dismissed };

function isTauri(): boolean {
  return typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
}

export async function checkForUpdates(): Promise<boolean> {
  if (!isTauri()) return false;

  setUpdateStatus("checking");
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (update) {
      setUpdateAvailable(true);
      setUpdateVersion(update.version);
      setDismissed(false);
      setUpdateStatus("idle");
      return true;
    }
    setUpdateStatus("idle");
    return false;
  } catch (e) {
    console.warn("Update check failed:", e);
    setUpdateStatus("idle");
    return false;
  }
}

export async function installUpdate(): Promise<void> {
  if (!isTauri()) return;

  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const { relaunch } = await import("@tauri-apps/plugin-process");

    const update = await check();
    if (!update) return;

    setUpdateStatus("downloading");
    await update.download();

    setUpdateStatus("installing");
    await update.install();

    await relaunch();
  } catch (e) {
    console.error("Update install failed:", e);
    setUpdateStatus("idle");
  }
}

export function dismissUpdate(): void {
  setDismissed(true);
}

export function initUpdater(): void {
  if (!isTauri()) return;
  // Check for updates 3 seconds after app launch
  setTimeout(() => checkForUpdates(), 3000);
}
