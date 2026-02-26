import type { Terminal } from "ghostty-web";
import { sendToTerminal } from "./ws";

type PtyIdSource = string | (() => string);

function resolvePtyId(source: PtyIdSource): string {
  return typeof source === "function" ? source() : source;
}

const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;
const MAX_WHEEL_STEPS = 5;
const FALLBACK_ROW_HEIGHT = 20;
const SGR_WHEEL_UP = 64;
const SGR_WHEEL_DOWN = 65;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function encodeSgrWheel(buttonCode: number, col: number, row: number): string {
  return `\x1b[<${buttonCode};${col};${row}M`;
}

function encodeX10Wheel(buttonCode: number, col: number, row: number): string {
  const x10Col = clamp(col, 1, 223);
  const x10Row = clamp(row, 1, 223);
  return `\x1b[M${String.fromCharCode(32 + buttonCode)}${String.fromCharCode(32 + x10Col)}${String.fromCharCode(32 + x10Row)}`;
}

function getWheelSteps(event: WheelEvent, rowHeight: number, rows: number): number {
  const absDelta = Math.abs(event.deltaY);
  if (!Number.isFinite(absDelta) || absDelta === 0) return 0;

  let lines = 0;
  if (event.deltaMode === DOM_DELTA_LINE) {
    lines = absDelta;
  } else if (event.deltaMode === DOM_DELTA_PAGE) {
    lines = absDelta * Math.max(1, rows);
  } else {
    lines = absDelta / Math.max(1, rowHeight || FALLBACK_ROW_HEIGHT);
  }

  if (!Number.isFinite(lines) || lines <= 0) return 0;
  return clamp(Math.max(1, Math.round(lines)), 1, MAX_WHEEL_STEPS);
}

function getMouseCellPosition(terminal: Terminal, event: WheelEvent): { col: number; row: number } {
  const rect = terminal.element?.getBoundingClientRect();
  if (!rect) {
    return {
      col: clamp(terminal.buffer.active.cursorX + 1, 1, Math.max(1, terminal.cols)),
      row: clamp(terminal.buffer.active.cursorY + 1, 1, Math.max(1, terminal.rows)),
    };
  }

  const metrics = terminal.renderer?.getMetrics?.();
  const cellWidth = (metrics?.width && metrics.width > 0)
    ? metrics.width
    : Math.max(1, rect.width / Math.max(1, terminal.cols));
  const cellHeight = (metrics?.height && metrics.height > 0)
    ? metrics.height
    : Math.max(1, rect.height / Math.max(1, terminal.rows));

  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  return {
    col: clamp(Math.floor(x / cellWidth) + 1, 1, Math.max(1, terminal.cols)),
    row: clamp(Math.floor(y / cellHeight) + 1, 1, Math.max(1, terminal.rows)),
  };
}

function isHorizontalDominantWheel(event: WheelEvent): boolean {
  const absX = Math.abs(event.deltaX);
  const absY = Math.abs(event.deltaY);
  return absX > 0 && absX > absY;
}

export function createTerminalWheelHandler(
  ptyIdSource: PtyIdSource,
  terminal: Terminal,
): (event: WheelEvent) => boolean {
  return (event: WheelEvent): boolean => {
    if (isHorizontalDominantWheel(event)) return false;
    if (terminal.buffer.active.type !== "alternate") return false;
    if (!terminal.hasMouseTracking()) return false;
    if (event.deltaY === 0) return false;

    const buttonCode = event.deltaY < 0 ? SGR_WHEEL_UP : SGR_WHEEL_DOWN;
    const { col, row } = getMouseCellPosition(terminal, event);
    const rowHeight = terminal.renderer?.getMetrics?.()?.height ?? FALLBACK_ROW_HEIGHT;
    const steps = getWheelSteps(event, rowHeight, terminal.rows);
    if (steps <= 0) return false;

    const useSgr = terminal.getMode(1006);
    const sequence = useSgr
      ? encodeSgrWheel(buttonCode, col, row)
      : encodeX10Wheel(buttonCode, col, row);
    const ptyId = resolvePtyId(ptyIdSource);

    for (let i = 0; i < steps; i++) {
      sendToTerminal(ptyId, sequence);
    }

    return true;
  };
}
