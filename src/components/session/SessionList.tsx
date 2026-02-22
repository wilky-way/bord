import { createSignal, createEffect, For, Show } from "solid-js";
import { state, setState } from "../../store/core";
import { api } from "../../lib/api";
import { addTerminal } from "../../store/terminals";
import { buildNewSessionCommand, PROVIDER_LABELS } from "../../lib/providers";
import SessionCard from "./SessionCard";
import type { SessionInfo } from "../../store/types";

const DEFAULT_VISIBLE = 5;
const LOAD_MORE_COUNT = 10;

interface Props {
  workspaceId?: string | null;
}

export default function SessionList(props: Props) {
  const [sessions, setSessions] = createSignal<SessionInfo[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [visibleCount, setVisibleCount] = createSignal(DEFAULT_VISIBLE);
  let requestId = 0;

  const selectedWorkspaceId = () => props.workspaceId ?? state.activeWorkspaceId;
  const activeWorkspace = () => state.workspaces.find((w) => w.id === selectedWorkspaceId());

  // Reload sessions when active workspace or provider changes
  createEffect(async () => {
    const ws = activeWorkspace();
    const provider = state.activeProvider;
    const current = ++requestId;
    if (!ws) {
      setSessions([]);
      return;
    }
    setLoading(true);
    setVisibleCount(DEFAULT_VISIBLE);
    try {
      const data = await api.listSessions(ws.path, provider);
      if (current !== requestId) return;
      setSessions(data);
    } catch {
      if (current !== requestId) return;
      setSessions([]);
    } finally {
      if (current !== requestId) return;
      setLoading(false);
    }
  });

  async function refresh() {
    const ws = activeWorkspace();
    if (!ws) return;
    const current = ++requestId;
    setLoading(true);
    try {
      const data = await api.listSessions(ws.path, state.activeProvider);
      if (current !== requestId) return;
      setSessions(data);
    } catch {
      if (current !== requestId) return;
      setSessions([]);
    } finally {
      if (current !== requestId) return;
      setLoading(false);
    }
  }

  function newSession() {
    const ws = activeWorkspace();
    if (!ws) return;
    if (ws.id !== state.activeWorkspaceId) {
      setState("activeWorkspaceId", ws.id);
    }
    addTerminal(ws.path, buildNewSessionCommand(state.activeProvider));
  }

  const visibleSessions = () => sessions().slice(0, visibleCount());
  const hasMore = () => sessions().length > visibleCount();
  const isExpanded = () => visibleCount() > DEFAULT_VISIBLE;

  return (
    <div class="px-2 pb-2">
      <Show when={!activeWorkspace()}>
        <div class="text-xs text-[var(--text-secondary)] py-6 text-center">
          Select a workspace to see sessions
        </div>
      </Show>

      <Show when={activeWorkspace()}>
        <div class="flex items-center py-1 gap-1.5">
          <button
            class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            onClick={refresh}
          >
            Refresh
          </button>
          <button
            class="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
            onClick={newSession}
            title={`Start new ${PROVIDER_LABELS[state.activeProvider]} terminal`}
          >
            + New {PROVIDER_LABELS[state.activeProvider]}
          </button>
        </div>

        {loading() ? (
          <div class="text-xs text-[var(--text-secondary)] py-4 text-center">Loading sessions...</div>
        ) : (
          <>
            <For each={visibleSessions()} fallback={
              <div class="text-xs text-[var(--text-secondary)] py-4 text-center">No sessions found</div>
            }>
              {(session) => <SessionCard session={session} />}
            </For>
            <Show when={hasMore()}>
              <button
                class="w-full text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] py-1.5 transition-colors"
                onClick={() => setVisibleCount((c) => c + LOAD_MORE_COUNT)}
              >
                Load more
              </button>
            </Show>
            <Show when={isExpanded()}>
              <button
                class="w-full text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-1 transition-colors"
                onClick={() => setVisibleCount(DEFAULT_VISIBLE)}
              >
                Collapse
              </button>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}
