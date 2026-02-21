import { createSignal, createEffect, For, Show } from "solid-js";
import { state } from "../../store/core";
import { api } from "../../lib/api";
import { addTerminal } from "../../store/terminals";
import SessionCard from "./SessionCard";
import type { SessionInfo } from "../../store/types";

const DEFAULT_VISIBLE = 5;
const LOAD_MORE_COUNT = 10;

export default function SessionList() {
  const [sessions, setSessions] = createSignal<SessionInfo[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [visibleCount, setVisibleCount] = createSignal(DEFAULT_VISIBLE);

  const activeWorkspace = () => state.workspaces.find((w) => w.id === state.activeWorkspaceId);

  // Reload sessions when active workspace changes
  createEffect(async () => {
    const ws = activeWorkspace();
    if (!ws) {
      setSessions([]);
      return;
    }
    setLoading(true);
    setVisibleCount(DEFAULT_VISIBLE);
    try {
      const data = await api.listSessions(ws.path);
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  });

  async function refresh() {
    const ws = activeWorkspace();
    if (!ws) return;
    setLoading(true);
    try {
      const data = await api.listSessions(ws.path);
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  function newSession() {
    const ws = activeWorkspace();
    if (ws) addTerminal(ws.path);
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
        <div class="flex items-center justify-end py-1 gap-1.5">
          <button
            class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            onClick={refresh}
          >
            Refresh
          </button>
          <button
            class="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
            onClick={newSession}
          >
            + New
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
