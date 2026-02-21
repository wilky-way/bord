import { Show } from "solid-js";
import { state } from "../../store/core";
import WorkspaceList from "../workspace/WorkspaceList";
import SessionList from "../session/SessionList";

export default function Sidebar() {
  return (
    <Show when={state.sidebarOpen}>
      <div class="flex flex-col w-72 h-full bg-[var(--bg-secondary)] border-r border-[var(--border)] shrink-0">
        {/* Top: Workspaces (fixed height) */}
        <div class="shrink-0">
          <WorkspaceList />
        </div>

        {/* Divider */}
        <div class="border-t border-[var(--border)]" />

        {/* Bottom: Sessions (scrollable, fills remaining) */}
        <div class="flex-1 min-h-0 overflow-y-auto">
          <SessionList />
        </div>
      </div>
    </Show>
  );
}
