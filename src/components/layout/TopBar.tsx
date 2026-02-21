import { state, setState } from "../../store/core";
import { addTerminal } from "../../store/terminals";
import {
  scrollSyncEnabled,
  setScrollSyncEnabled,
} from "../terminal/ParallelScroll";
import TerminalMinimap from "./TerminalMinimap";

export default function TopBar() {
  return (
    <div class="grid grid-cols-[1fr_auto_1fr] items-center h-9 px-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] select-none shrink-0">
      {/* Left: App name + terminal count badge */}
      <div class="flex items-center gap-2.5">
        <span class="text-sm font-semibold text-[var(--text-primary)]">bord</span>
        <span
          class="text-[10px] px-1.5 py-0.5 rounded-[var(--btn-radius)] text-[var(--text-secondary)]"
          style={{ background: "color-mix(in srgb, var(--accent) 15%, var(--bg-tertiary))" }}
        >
          {state.terminals.length} terminal{state.terminals.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Center: Terminal minimap */}
      <TerminalMinimap />

      {/* Right: Actions */}
      <div class="flex items-center gap-1.5 justify-end">
        {/* Layout density buttons */}
        <div class="flex items-center rounded-[var(--btn-radius)] overflow-hidden border border-[var(--border)]">
          {[1, 2, 3, 4].map((n) => (
            <button
              class="px-1.5 py-0.5 text-[10px] font-medium transition-colors"
              classList={{
                "bg-[var(--accent)] text-[var(--bg-primary)]": state.layoutColumns === n,
                "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]": state.layoutColumns !== n,
              }}
              onClick={() => setState("layoutColumns", state.layoutColumns === n ? 0 : n)}
              title={`${n} terminal${n > 1 ? "s" : ""} per view`}
            >
              {n}x
            </button>
          ))}
        </div>
        <button
          class={`px-2 py-1 text-xs rounded-[var(--btn-radius)] transition-colors ${
            scrollSyncEnabled()
              ? "bg-[var(--accent)] text-[var(--bg-primary)] font-medium"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          }`}
          onClick={() => setScrollSyncEnabled(!scrollSyncEnabled())}
          title="Sync scroll across terminals"
        >
          Scroll Sync
        </button>
        <button
          class="px-2 py-1 text-xs rounded-[var(--btn-radius)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-colors"
          style={{ "--tw-bg-opacity": "1" } as any}
          classList={{
            "hover:bg-[color-mix(in_srgb,var(--accent)_15%,var(--bg-tertiary))]": true,
          }}
          onClick={() => setState("sidebarOpen", (v) => !v)}
        >
          {state.sidebarOpen ? "Hide" : "Show"} Sidebar
        </button>
        <button
          class="px-2.5 py-1 text-xs rounded-[var(--btn-radius)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-primary)] font-medium transition-colors"
          onClick={() => addTerminal()}
        >
          + Terminal
        </button>
      </div>
    </div>
  );
}
