// WebSocket protocol:
// - Binary frames: raw PTY data (stdin/stdout bytes)
// - Text frames: JSON control messages
//
// Control message types:
// Client → Server:
//   { type: "resize", cols: number, rows: number }
//   { type: "ping" } -> responds with { type: "pong" }
//   { type: "configure", idleThresholdMs: number }
//
// Server → Client:
//   { type: "cursor", cursor: number }  - current buffer position after replay
//   { type: "pong" }
//   { type: "replay-done" }  - replay burst finished, live output follows
//   { type: "idle" }   - PTY has been silent for idleThresholdMs
//   { type: "active" } - PTY resumed output after being idle

export interface ResizeMessage {
  type: "resize";
  cols: number;
  rows: number;
}

export interface PingMessage {
  type: "ping";
}

export interface ConfigureMessage {
  type: "configure";
  idleThresholdMs: number;
}

export interface CursorMessage {
  type: "cursor";
  cursor: number;
}

export interface PongMessage {
  type: "pong";
}

export interface IdleMessage {
  type: "idle";
}

export interface ActiveMessage {
  type: "active";
}

export interface ReplayDoneMessage {
  type: "replay-done";
}

export type ClientControlMessage = ResizeMessage | PingMessage | ConfigureMessage;
export type ServerControlMessage = CursorMessage | PongMessage | IdleMessage | ActiveMessage | ReplayDoneMessage;
export type ControlMessage = ClientControlMessage | ServerControlMessage;

export function isControlMessage(data: unknown): data is ControlMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof (data as { type: unknown }).type === "string"
  );
}
