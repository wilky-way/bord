import { Show } from "solid-js";
import { state, setState } from "../../store/core";
import { addTerminal } from "../../store/terminals";
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

      {/* Center: layout density + minimap + add terminal */}
      <div class="flex items-center gap-3 justify-center">
        <div class="flex items-center rounded-[var(--btn-radius)] overflow-hidden border border-[var(--border)]">
          {[1, 2, 3, 4].map((n) => (
            <button
              class="px-1.5 py-0.5 text-[10px] font-medium transition-colors"
              classList={{
                "bg-[var(--accent)] text-[var(--bg-primary)]": state.layoutColumns === n,
                "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]": state.layoutColumns !== n,
              }}
              onClick={() => {
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
        <TerminalMinimap />
        <button
          class="px-1.5 py-0.5 rounded-[var(--btn-radius)] border border-[var(--border)] transition-colors flex items-center justify-center"
          classList={{
            "text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] cursor-pointer": !!state.activeWorkspaceId,
            "text-[var(--text-secondary)] opacity-30 cursor-not-allowed": !state.activeWorkspaceId,
          }}
          onClick={() => { if (state.activeWorkspaceId) addTerminal(); }}
          disabled={!state.activeWorkspaceId}
          title={state.activeWorkspaceId ? "Add terminal" : "Select a workspace first"}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M8 3v10" />
            <path d="M3 8h10" />
          </svg>
        </button>
        <button
          class="px-1.5 py-0.5 rounded-[var(--btn-radius)] border border-[var(--border)] transition-colors flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] cursor-pointer"
          onClick={() => setState("bellMuted", !state.bellMuted)}
          title={state.bellMuted ? "Unmute notifications" : "Mute notifications"}
        >
          <Show when={!state.bellMuted} fallback={
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M8 2C6 2 4.5 3.5 4.5 5v3L3 10.5V12h10v-1.5L11.5 8V5c0-1.5-1.5-3-3.5-3z" />
              <path d="M6.5 12a1.5 1.5 0 003 0" />
              <path d="M2 2l12 12" stroke-width="2" />
            </svg>
          }>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <path d="M8 2C6 2 4.5 3.5 4.5 5v3L3 10.5V12h10v-1.5L11.5 8V5c0-1.5-1.5-3-3.5-3z" />
              <path d="M6.5 12a1.5 1.5 0 003 0" />
            </svg>
          </Show>
        </button>
      </div>

      {/* Right: reserved */}
      <div class="flex items-center justify-end" />
    </div>
  );
}
