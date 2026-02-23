import { describe, test, expect, beforeEach } from "bun:test";
import { createRoot } from "solid-js";
import { useDragReorder } from "./use-drag-reorder";

// Minimal window event system for tests
let moveHandlers: ((e: any) => void)[] = [];
let upHandlers: ((e: any) => void)[] = [];

function installWindowEventMock() {
  moveHandlers = [];
  upHandlers = [];
  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.addEventListener = (type: string, handler: any) => {
    if (type === "pointermove") moveHandlers.push(handler);
    if (type === "pointerup") upHandlers.push(handler);
  };
  (globalThis as any).window.removeEventListener = (type: string, handler: any) => {
    if (type === "pointermove") moveHandlers = moveHandlers.filter((h) => h !== handler);
    if (type === "pointerup") upHandlers = upHandlers.filter((h) => h !== handler);
  };
}

function fireMove(clientX: number, clientY: number) {
  const e = { clientX, clientY };
  // Copy the array in case handlers modify it
  [...moveHandlers].forEach((h) => h(e));
}

function fireUp() {
  [...upHandlers].forEach((h) => h({}));
}

function makePointerEvent(opts: {
  clientX: number;
  clientY: number;
  button?: number;
  target?: Partial<HTMLElement>;
}): PointerEvent {
  return {
    clientX: opts.clientX,
    clientY: opts.clientY,
    button: opts.button ?? 0,
    target: {
      closest: (_sel: string) => null,
      ...opts.target,
    },
  } as unknown as PointerEvent;
}

function makePanels(positions: { left: number; width: number }[]): HTMLElement[] {
  return positions.map((p) => ({
    getBoundingClientRect: () => ({
      left: p.left,
      width: p.width,
      right: p.left + p.width,
      top: 0,
      bottom: 100,
      height: 100,
      x: p.left,
      y: 0,
      toJSON: () => {},
    }),
  })) as unknown as HTMLElement[];
}

describe("useDragReorder", () => {
  beforeEach(() => {
    installWindowEventMock();
  });

  test("drag below 5px threshold does not trigger", () => {
    createRoot((dispose) => {
      let dropCalled = false;
      const panels = makePanels([{ left: 0, width: 100 }, { left: 100, width: 100 }]);
      const { draggingId, handlePointerDown } = useDragReorder({
        getPanelElements: () => panels,
        getVisibleCount: () => 2,
        onDrop: () => { dropCalled = true; },
      });

      handlePointerDown("t1", 0, makePointerEvent({ clientX: 50, clientY: 50 }));
      // Move only 3px — below threshold
      fireMove(53, 50);
      expect(draggingId()).toBeNull();
      fireUp();
      expect(dropCalled).toBe(false);
      dispose();
    });
  });

  test("drag above 5px threshold triggers reorder mode", () => {
    createRoot((dispose) => {
      const panels = makePanels([{ left: 0, width: 100 }, { left: 100, width: 100 }]);
      const { draggingId, handlePointerDown } = useDragReorder({
        getPanelElements: () => panels,
        getVisibleCount: () => 2,
        onDrop: () => {},
      });

      handlePointerDown("t1", 0, makePointerEvent({ clientX: 50, clientY: 50 }));
      // Move 10px horizontally — above threshold
      fireMove(60, 50);
      expect(draggingId()).toBe("t1");
      fireUp();
      dispose();
    });
  });

  test("vertical-dominant movement cancels drag", () => {
    createRoot((dispose) => {
      const panels = makePanels([{ left: 0, width: 100 }, { left: 100, width: 100 }]);
      const { draggingId, handlePointerDown } = useDragReorder({
        getPanelElements: () => panels,
        getVisibleCount: () => 2,
        onDrop: () => {},
      });

      handlePointerDown("t1", 0, makePointerEvent({ clientX: 50, clientY: 50 }));
      // Move 10px vertically (dy > dx) — should cancel
      fireMove(50, 60);
      expect(draggingId()).toBeNull();
      dispose();
    });
  });

  test("drop index calculation from pointer position", () => {
    createRoot((dispose) => {
      const panels = makePanels([
        { left: 0, width: 100 },
        { left: 100, width: 100 },
        { left: 200, width: 100 },
      ]);
      const { dropIndex, handlePointerDown } = useDragReorder({
        getPanelElements: () => panels,
        getVisibleCount: () => 3,
        onDrop: () => {},
      });

      // Drag from index 0, move to right of panel 2 midpoint (250)
      handlePointerDown("t1", 0, makePointerEvent({ clientX: 10, clientY: 50 }));
      fireMove(260, 50); // Past midpoint of panel 2 (250), before end
      // dropIndex should be 3 (end) since pointer is past all midpoints,
      // but not at position 0 or 1 (which are suppressed for source index 0)
      expect(dropIndex()).toBe(3);
      fireUp();
      dispose();
    });
  });

  test("target index adjustment for same-list moves", () => {
    createRoot((dispose) => {
      let fromIdx = -1;
      let toIdx = -1;
      const panels = makePanels([
        { left: 0, width: 100 },
        { left: 100, width: 100 },
        { left: 200, width: 100 },
      ]);
      const { handlePointerDown } = useDragReorder({
        getPanelElements: () => panels,
        getVisibleCount: () => 3,
        onDrop: (from, to) => { fromIdx = from; toIdx = to; },
      });

      // Drag from index 0 to past the last panel
      handlePointerDown("t1", 0, makePointerEvent({ clientX: 10, clientY: 50 }));
      fireMove(260, 50); // dropIndex = 3, > dragVisibleIndex (0), so target = 3 - 1 = 2
      fireUp();
      expect(fromIdx).toBe(0);
      expect(toIdx).toBe(2);
      dispose();
    });
  });

  test("onDrop callback receives correct indices", () => {
    createRoot((dispose) => {
      let fromIdx = -1;
      let toIdx = -1;
      const panels = makePanels([
        { left: 0, width: 100 },
        { left: 100, width: 100 },
        { left: 200, width: 100 },
      ]);
      const { handlePointerDown } = useDragReorder({
        getPanelElements: () => panels,
        getVisibleCount: () => 3,
        onDrop: (from, to) => { fromIdx = from; toIdx = to; },
      });

      // Drag from index 2 to before index 0 (pointer at 10 < midpoint 50)
      handlePointerDown("t3", 2, makePointerEvent({ clientX: 250, clientY: 50 }));
      fireMove(10, 50); // dropIndex = 0, < dragVisibleIndex (2), so target = 0
      fireUp();
      expect(fromIdx).toBe(2);
      expect(toIdx).toBe(0);
      dispose();
    });
  });

  test("button elements are ignored for drag", () => {
    createRoot((dispose) => {
      const panels = makePanels([{ left: 0, width: 100 }]);
      const { draggingId, handlePointerDown } = useDragReorder({
        getPanelElements: () => panels,
        getVisibleCount: () => 1,
        onDrop: () => {},
      });

      const e = makePointerEvent({
        clientX: 50,
        clientY: 50,
        target: { closest: (sel: string) => (sel.includes("button") ? {} as HTMLElement : null) } as any,
      });
      handlePointerDown("t1", 0, e);
      fireMove(100, 50);
      // Should not have activated since target was inside a button
      expect(draggingId()).toBeNull();
      dispose();
    });
  });

  test("non-left-click is ignored", () => {
    createRoot((dispose) => {
      const panels = makePanels([{ left: 0, width: 100 }]);
      const { draggingId, handlePointerDown } = useDragReorder({
        getPanelElements: () => panels,
        getVisibleCount: () => 1,
        onDrop: () => {},
      });

      // Right click (button = 2)
      handlePointerDown("t1", 0, makePointerEvent({ clientX: 50, clientY: 50, button: 2 }));
      fireMove(100, 50);
      expect(draggingId()).toBeNull();
      dispose();
    });
  });
});
