import { type JSX, createSignal } from "solid-js";

const MIN_PANEL_WIDTH = 280;

interface Props {
  index: number;
  total: number;
  size: number;
  pixelWidth: number;
  unitWidth: number;
  onResize: (newSize: number) => void;
  ref?: (el: HTMLDivElement) => void;
  isDragging?: boolean;
  children: JSX.Element;
}

export default function ResizablePanel(props: Props) {
  const [dragging, setDragging] = createSignal(false);

  function handleMouseDown(e: MouseEvent) {
    e.preventDefault();
    setDragging(true);

    const startX = e.clientX;
    const startPixelWidth = props.pixelWidth;

    function handleMouseMove(e: MouseEvent) {
      const deltaX = e.clientX - startX;
      const newPx = Math.max(MIN_PANEL_WIDTH, startPixelWidth + deltaX);
      const newSize = newPx / props.unitWidth;
      props.onResize(Math.max(0.5, newSize));
    }

    function handleMouseUp() {
      setDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  return (
    <div
      ref={(el) => props.ref?.(el)}
      class="relative h-full rounded-xl overflow-hidden panel-appear"
      classList={{ "opacity-40 pointer-events-none": props.isDragging }}
      style={{
        flex: `0 0 ${props.pixelWidth}px`,
        transition: props.isDragging ? "opacity 0.15s ease" : undefined,
      }}
    >
      {props.children}

      {/* Resize handle — always shown so every panel (including last) can expand */}
      <div
        class="absolute top-0 -right-[2px] w-[5px] h-full cursor-col-resize z-10 hover:bg-[var(--accent)] transition-colors"
        classList={{ "bg-[var(--accent)]": dragging() }}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
