// WebSocket protocol:
// - Binary frames: raw PTY data (stdin/stdout bytes)
// - Text frames: JSON control messages
//
// Control message types:
// Client → Server:
//   { type: "resize", cols: number, rows: number }
//   { type: "ping" } -> responds with { type: "pong" }
//
// Server → Client:
//   { type: "cursor", cursor: number }  - current buffer position after replay
//   { type: "pong" }

export interface ResizeMessage {
  type: "resize";
  cols: number;
  rows: number;
}

export interface PingMessage {
  type: "ping";
}

export interface CursorMessage {
  type: "cursor";
  cursor: number;
}

export interface PongMessage {
  type: "pong";
}

export type ClientControlMessage = ResizeMessage | PingMessage;
export type ServerControlMessage = CursorMessage | PongMessage;
export type ControlMessage = ClientControlMessage | ServerControlMessage;

export function isControlMessage(data: unknown): data is ControlMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof (data as { type: unknown }).type === "string"
  );
}
