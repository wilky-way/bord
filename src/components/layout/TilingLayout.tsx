import { For, Show, createSignal, createEffect, onMount, onCleanup } from "solid-js";
import { state, setState } from "../../store/core";
import { addTerminal, moveTerminal, getVisibleTerminals } from "../../store/terminals";
import { useDragReorder } from "../../lib/use-drag-reorder";
import TerminalPanel from "../terminal/TerminalPanel";
import ResizablePanel from "./ResizablePanel";

const MIN_PANEL_WIDTH = 280;
const PADDING = 4; // p-0.5 = 2px * 2
const GAP = 4; // gap-1

export default function TilingLayout() {
  const visibleTerminals = () => getVisibleTerminals();
  const allNonStashed = () => state.terminals.filter(t => !t.stashed);

  const [containerWidth, setContainerWidth] = createSignal(0);
  let containerRef: HTMLDivElement | undefined;
  const panelRefMap = new Map<string, HTMLElement>();

  // Drag reorder
  const { draggingId, dropIndex, handlePointerDown, cancelDrag } = useDragReorder({
    getPanelElements: () => getVisibleTerminals()
      .map(t => panelRefMap.get(t.id))
      .filter((el): el is HTMLElement => !!el),
    getVisibleCount: () => visibleTerminals().length,
    onDrop: (fromVisible, toVisible) => {
      // Convert visible indices to absolute indices in state.terminals
      const vis = visibleTerminals();
      const fromAbsolute = state.terminals.indexOf(vis[fromVisible]);
      const toAbsolute = state.terminals.indexOf(vis[toVisible]);
      if (fromAbsolute !== -1 && toAbsolute !== -1) {
        moveTerminal(fromAbsolute, toAbsolute);
      }
    },
  });

  createEffect(() => {
    const dragging = draggingId();
    if (!dragging) return;

    if (!visibleTerminals().some((terminal) => terminal.id === dragging)) {
      cancelDrag();
    }
  });

  onMount(() => {
    if (!containerRef) return;
    const container = containerRef;

    // ResizeObserver for container width
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(container);
    onCleanup(() => ro.disconnect());

    // Capture horizontal wheel gestures before terminal canvases handle wheel events.
    const onWheelCapture = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.stopPropagation();
      container.scrollLeft += e.deltaX;
    };

    container.addEventListener("wheel", onWheelCapture, { capture: true });
    onCleanup(() => {
      container.removeEventListener("wheel", onWheelCapture, true);
    });
  });

  const columns = () => state.layoutColumns || visibleTerminals().length;

  const unitWidth = () => {
    const n = columns();
    if (n === 0) return 0;
    const available = containerWidth() - PADDING - (n - 1) * GAP;
    return available / n;
  };

  const panelWidth = (index: number) => {
    const size = visibleTerminals()[index]?.panelSize ?? 1;
    return Math.max(MIN_PANEL_WIDTH, size * unitWidth());
  };

  return (
    <div
      ref={containerRef}
      class="flex flex-nowrap h-full p-0.5 gap-1 overflow-x-auto overflow-y-hidden flex-1 min-w-0"
    >
      <Show
        when={allNonStashed().length > 0}
        fallback={
          <div class="flex items-center justify-center w-full h-full text-[var(--text-secondary)]">
            <div class="text-center">
              <Show when={state.workspaces.length > 0} fallback={
                <>
                  <div class="text-lg mb-2">Welcome to Bord</div>
                  <div class="text-sm opacity-70 mb-4">
                    Add a workspace to get started
                  </div>
                </>
              }>
                <div class="text-sm opacity-70 mb-4">
                  Open a terminal to get started
                </div>
              </Show>
              <Show when={!state.sidebarOpen}>
                <button
                  class="px-3 py-1.5 text-xs rounded-[var(--btn-radius)] bg-[var(--bg-tertiary)] hover:bg-[var(--border)] text-[var(--text-primary)] transition-colors"
                  onClick={() => setState("sidebarOpen", true)}
                >
                  Open Sidebar
                </button>
              </Show>
            </div>
          </div>
        }
      >
        <>
          <Show when={visibleTerminals().length === 0}>
            <div class="flex items-center justify-center w-full h-full text-[var(--text-secondary)]">
              <div class="text-center">
                <div class="text-sm opacity-70">No terminals in this workspace</div>
              </div>
            </div>
          </Show>
          <For each={allNonStashed()}>
            {(terminal) => {
              const isVisible = () => {
                const wsId = state.activeWorkspaceId;
                return !wsId || terminal.workspaceId === wsId;
              };
              const visIdx = () => getVisibleTerminals().findIndex(t => t.id === terminal.id);

              onCleanup(() => panelRefMap.delete(terminal.id));

              return (
                <div style={{ display: isVisible() ? "contents" : "none" }}>
                  {/* Drop indicator before this panel */}
                  <Show when={isVisible() && dropIndex() === visIdx()}>
                    <div class="drop-indicator" />
                  </Show>
                  <ResizablePanel
                    index={isVisible() ? visIdx() : 0}
                    total={isVisible() ? visibleTerminals().length : 1}
                    size={terminal.panelSize ?? 1}
                    pixelWidth={isVisible() ? panelWidth(visIdx()) : 0}
                    unitWidth={unitWidth()}
                    onResize={(newSize) => {
                      setState("terminals", (t) => t.id === terminal.id, "panelSize", newSize);
                    }}
                    ref={(el) => { panelRefMap.set(terminal.id, el); }}
                    isDragging={draggingId() === terminal.id}
                  >
                    <TerminalPanel
                      id={terminal.id}
                      cwd={terminal.cwd}
                      isActive={terminal.id === state.activeTerminalId}
                      onDragStart={(e) => handlePointerDown(terminal.id, visIdx(), e)}
                    />
                  </ResizablePanel>
                </div>
              );
            }}
          </For>
          {/* Drop indicator after last panel */}
          <Show when={dropIndex() !== null && dropIndex()! >= visibleTerminals().length}>
            <div class="drop-indicator" />
          </Show>
          <button
            class="flex-none self-stretch flex items-center justify-center w-20 rounded-xl border-2 border-dashed transition-colors"
            classList={{
              "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer opacity-40 hover:opacity-100": !!state.activeWorkspaceId,
              "border-[var(--border)] text-[var(--text-secondary)] opacity-15 cursor-not-allowed": !state.activeWorkspaceId,
            }}
            onClick={() => { if (state.activeWorkspaceId) addTerminal(); }}
            disabled={!state.activeWorkspaceId}
            title={state.activeWorkspaceId ? "Add terminal" : "Select a workspace first"}
          >
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </>
      </Show>
    </div>
  );
}
