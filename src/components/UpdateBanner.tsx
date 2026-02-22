import { Show } from "solid-js";
import {
  updateAvailable,
  updateVersion,
  updateStatus,
  dismissed,
  installUpdate,
  dismissUpdate,
} from "../lib/updater";

export default function UpdateBanner() {
  const visible = () => updateAvailable() && !dismissed();

  return (
    <Show when={visible()}>
      <div class="flex items-center justify-between px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-medium gap-3 shrink-0">
        <div class="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M8 3v7M5 7l3 3 3-3" />
            <path d="M3 13h10" />
          </svg>
          <span>
            {updateStatus() === "downloading"
              ? "Downloading update..."
              : updateStatus() === "installing"
              ? "Installing update..."
              : `Bord v${updateVersion()} is available`}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <Show when={updateStatus() === "idle"}>
            <button
              class="px-2.5 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors cursor-pointer"
              onClick={installUpdate}
            >
              Update now
            </button>
            <button
              class="px-1 py-0.5 rounded hover:bg-white/20 transition-colors cursor-pointer"
              onClick={dismissUpdate}
              title="Dismiss"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </Show>
          <Show when={updateStatus() === "downloading" || updateStatus() === "installing"}>
            <div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </Show>
        </div>
      </div>
    </Show>
  );
}
