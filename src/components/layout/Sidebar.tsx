import { Show, type JSX } from "solid-js";
import { state, setState } from "../../store/core";
import WorkspaceList from "../workspace/WorkspaceList";
import SessionList from "../session/SessionList";
import DockerPanel from "../docker/DockerPanel";

function SectionHeader(props: {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  actions?: JSX.Element;
}) {
  return (
    <div class="flex items-center w-full px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider hover:bg-[var(--bg-tertiary)] transition-colors">
      <button
        class="flex items-center gap-1 flex-1 min-w-0"
        onClick={props.onToggle}
      >
        <span>{props.label}</span>
        <svg
          class="w-3 h-3 transition-transform shrink-0"
          classList={{ "rotate-[-90deg]": props.collapsed }}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>
      <Show when={props.actions}>
        <div class="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {props.actions}
        </div>
      </Show>
    </div>
  );
}

export default function Sidebar() {
  return (
    <Show when={state.sidebarOpen}>
      <div class="flex flex-col w-72 h-full bg-[var(--bg-secondary)] border-r border-[var(--border)] shrink-0">
        {/* Workspaces */}
        <div class="shrink-0">
          <SectionHeader
            label="Workspaces"
            collapsed={state.sidebarCollapsed.workspaces}
            onToggle={() => setState("sidebarCollapsed", "workspaces", (v) => !v)}
          />
          <Show when={!state.sidebarCollapsed.workspaces}>
            <WorkspaceList />
          </Show>
        </div>

        <div class="border-t border-[var(--border)]" />

        {/* Sessions */}
        <div class="flex-1 min-h-0 flex flex-col">
          <SectionHeader
            label="Sessions"
            collapsed={state.sidebarCollapsed.sessions}
            onToggle={() => setState("sidebarCollapsed", "sessions", (v) => !v)}
          />
          <Show when={!state.sidebarCollapsed.sessions}>
            <div class="flex-1 min-h-0 overflow-y-auto">
              <SessionList />
            </div>
          </Show>
        </div>

        <div class="border-t border-[var(--border)]" />

        {/* Docker */}
        <div class="shrink-0">
          <SectionHeader
            label="Docker"
            collapsed={state.sidebarCollapsed.docker}
            onToggle={() => setState("sidebarCollapsed", "docker", (v) => !v)}
          />
          <Show when={!state.sidebarCollapsed.docker}>
            <DockerPanel />
          </Show>
        </div>
      </div>
    </Show>
  );
}
