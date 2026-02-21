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
              onClick={() => {
                // Reset all panel sizes to equal when switching layout
                state.terminals.forEach((_, i) => {
                  setState("terminals", i, "panelSize", 1);
                });
                setState("layoutColumns", state.layoutColumns === n ? 0 : n);
              }}
              title={`${n} terminal${n > 1 ? "s" : ""} per view`}
            >
              {n}x
            </button>
          ))}
        </div>
        {/* Bell mute toggle */}
        <button
          class="px-1.5 py-0.5 transition-colors rounded-[var(--btn-radius)]"
          classList={{
            "text-[var(--warning)]": !state.bellMuted,
            "text-[var(--text-secondary)] hover:text-[var(--text-primary)]": state.bellMuted,
          }}
          onClick={() => setState("bellMuted", (v) => !v)}
          title={state.bellMuted ? "Unmute all notifications" : "Mute all notifications"}
        >
          {state.bellMuted ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M8 2C6 2 4.5 3.5 4.5 5v3L3 10.5V12h10v-1.5L11.5 8V5c0-1.5-1.5-3-3.5-3z" />
              <path d="M6.5 12a1.5 1.5 0 003 0" />
              <path d="M2 2l12 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M8 2C6 2 4.5 3.5 4.5 5v3L3 10.5V12h10v-1.5L11.5 8V5c0-1.5-1.5-3-3.5-3z" />
              <path d="M6.5 12a1.5 1.5 0 003 0" />
            </svg>
          )}
        </button>
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
