import { createSignal, onCleanup } from "solid-js";

interface DragReorderOptions {
  getPanelElements: () => HTMLElement[];
  getVisibleCount: () => number;
  onDrop: (fromVisibleIndex: number, toVisibleIndex: number) => void;
}

export function useDragReorder(opts: DragReorderOptions) {
  const [draggingId, setDraggingId] = createSignal<string | null>(null);
  const [dropIndex, setDropIndex] = createSignal<number | null>(null);

  let dragVisibleIndex = -1;
  let startX = 0;
  let startY = 0;
  let active = false;
  let detachListeners: (() => void) | null = null;

  function cancelDrag() {
    active = false;
    dragVisibleIndex = -1;
    setDraggingId(null);
    setDropIndex(null);
    if (detachListeners) {
      detachListeners();
      detachListeners = null;
    }
  }

  onCleanup(() => {
    cancelDrag();
  });

  function handlePointerDown(terminalId: string, visibleIndex: number, e: PointerEvent) {
    cancelDrag();

    const target = e.target as HTMLElement;
    if (target.closest("button, input")) return;
    if (e.button !== 0) return;

    startX = e.clientX;
    startY = e.clientY;
    active = false;
    dragVisibleIndex = visibleIndex;

    const onMove = (me: PointerEvent) => {
      const dx = Math.abs(me.clientX - startX);
      const dy = Math.abs(me.clientY - startY);

      if (!active && dx < 5 && dy < 5) return;

      if (!active) {
        // Only start drag if horizontal movement dominates
        if (dy > dx) {
          cancelDrag();
          return;
        }
        active = true;
        setDraggingId(terminalId);
      }

      // Calculate drop index from pointer position vs panel midpoints
      const panels = opts.getPanelElements();
      let newDropIndex = panels.length;
      for (let i = 0; i < panels.length; i++) {
        const rect = panels[i].getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        if (me.clientX < midX) {
          newDropIndex = i;
          break;
        }
      }
      // Don't show indicator at the dragged item's current position or right after it
      if (newDropIndex === dragVisibleIndex || newDropIndex === dragVisibleIndex + 1) {
        setDropIndex(null);
      } else {
        setDropIndex(newDropIndex);
      }
    };

    const onUp = () => {
      if (active) {
        const di = dropIndex();
        if (di !== null) {
          // Adjust target index: if dropping after the dragged item, account for removal
          const targetIndex = di > dragVisibleIndex ? di - 1 : di;
          opts.onDrop(dragVisibleIndex, targetIndex);
        }
      }
      cancelDrag();
    };

    const onCancel = () => {
      cancelDrag();
    };

    detachListeners = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onCancel);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", onCancel);
  }

  return { draggingId, dropIndex, handlePointerDown, cancelDrag };
}
