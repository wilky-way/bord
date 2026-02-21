import { For, Show, createSignal, onMount, onCleanup } from "solid-js";
import { state, setState } from "../../store/core";
import { addTerminal, moveTerminal, getVisibleTerminals } from "../../store/terminals";
import { useDragReorder } from "../../lib/use-drag-reorder";
import TerminalPanel from "../terminal/TerminalPanel";
import ResizablePanel from "./ResizablePanel";

const MIN_PANEL_WIDTH = 280;
const PADDING = 12; // p-1.5 = 6px * 2
const GAP = 6; // gap-1.5

export default function TilingLayout() {
  const visibleTerminals = () => getVisibleTerminals();

  const [containerWidth, setContainerWidth] = createSignal(0);
  let containerRef: HTMLDivElement | undefined;
  const panelRefs: HTMLElement[] = [];

  // Drag reorder
  const { draggingId, dropIndex, handlePointerDown } = useDragReorder({
    getPanelElements: () => panelRefs.slice(0, visibleTerminals().length),
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

  onMount(() => {
    if (!containerRef) return;

    // ResizeObserver for container width
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef);
    onCleanup(() => ro.disconnect());

    // Capture-phase wheel listener — fires before ghostty's canvas handler
    containerRef.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          e.stopPropagation();
          containerRef!.scrollLeft += e.deltaX;
        }
      },
      { capture: true },
    );
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
      class="flex flex-nowrap h-full p-1.5 gap-1.5 overflow-x-auto overflow-y-hidden flex-1 min-w-0"
    >
      <Show
        when={visibleTerminals().length > 0}
        fallback={
          <div class="flex items-center justify-center w-full h-full text-[var(--text-secondary)]">
            <div class="text-center">
              <div class="text-lg mb-2">Welcome to Bord</div>
              <div class="text-sm opacity-70 mb-4">
                Add a workspace to get started
              </div>
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
          <For each={visibleTerminals()}>
            {(terminal, index) => (
              <>
                {/* Drop indicator before this panel */}
                <Show when={dropIndex() === index()}>
                  <div class="drop-indicator" />
                </Show>
                <ResizablePanel
                  index={index()}
                  total={visibleTerminals().length}
                  size={terminal.panelSize ?? 1}
                  pixelWidth={panelWidth(index())}
                  unitWidth={unitWidth()}
                  onResize={(newSize) => {
                    setState("terminals", (t) => t.id === terminal.id, "panelSize", newSize);
                  }}
                  ref={(el) => {
                    panelRefs[index()] = el;
                  }}
                  isDragging={draggingId() === terminal.id}
                >
                  <TerminalPanel
                    id={terminal.id}
                    cwd={terminal.cwd}
                    isActive={terminal.id === state.activeTerminalId}
                    onDragStart={(e) => handlePointerDown(terminal.id, index(), e)}
                  />
                </ResizablePanel>
              </>
            )}
          </For>
          {/* Drop indicator after last panel */}
          <Show when={dropIndex() !== null && dropIndex()! >= visibleTerminals().length}>
            <div class="drop-indicator" />
          </Show>
          <button
            class="flex-none self-stretch flex items-center justify-center w-20 rounded-xl border-2 border-dashed border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer opacity-40 hover:opacity-100"
            onClick={() => addTerminal()}
            title="Add terminal"
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
