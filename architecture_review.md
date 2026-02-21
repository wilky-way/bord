# Bord Architecture Review

I took a deep dive into the current implementation to see what we've actually got running under the hood. The codebase is remarkably clean, and the choice of SolidJS with `ghostty-web` is very modern. However, there are some significant architectural choices and implementation details worth addressing for long-term stability and performance.

## 1. Network & Process Architecture (The Tauri-Bun Split)
Currently, `bord` runs a Tauri v2 desktop shell that loads a SolidJS Vite frontend, which in turn talks to a separate Bun backend server ([server/index.ts](file:///Users/wilky/Developer/bord/server/index.ts) running on `:4200`) via HTTP and WebSockets.

**The Good:**
- This makes the app incredibly portable. You essentially built a client-server architecture that just happens to be wrapped in Tauri. You can serve this over a network trivially.
- Writing the PTY and Git integrations in TypeScript/Bun is much faster for iteration than writing them in Rust.

**The Bad:**
- Tauri usually acts as the backend itself. By running a separate Bun daemon, you are shipping two runtimes (Tauri/WebView + Bun). This increases memory usage and complexity. If the Bun process crashes, the Tauri app is orphaned.

**Tradeoffs: Rust PTY vs Bun `node-pty`**
I researched how this dual-architecture compares to a pure Rust PTY implementation (the standard Tauri approach):
1. **Performance:** A native Rust PTY module inside Tauri (using crates like `portable-pty`) is generally more memory-efficient and avoids Node/Bun's garbage collection pauses entirely. Rust integrations excel at handling the massive async I/O throughput of high-speed terminal output without blocking the UI thread.
2. **Architecture Complexity:** Moving PTY management to Rust means writing complex IPC (Inter-Process Communication) wrappers to stream terminal bits from the Rust backend to the SolidJS frontend.
3. **The OpenCode Approach:** Interestingly, **OpenCode's desktop app uses the exact same architecture as `bord`**. Despite being a Tauri application, OpenCode bundles and spawns a separate daemon backend server (in their case, `cli::serve`) to handle the heavy lifting, rather than putting everything in `#[tauri::command]` functions. 

**Conclusion on Architecture:**
Given OpenCode validates this separate-daemon pattern, it is perfectly reasonable to keep the Bun server rather than rewriting everything in Rust. We get faster iteration speed and decoupled portability. The primary drawback of using Bun for the PTY is garbage collection pressure from string manipulation, which we can fix directly in TS.

## 2. PTY Management ([pty-manager.ts](file:///Users/wilky/Developer/bord/server/services/pty-manager.ts))
The PTY manager correctly implements a circular buffer for session replay, but the implementation is purely string-based:

```typescript
function appendToBuffer(session: PtySession, data: Uint8Array) {
  const text = new TextDecoder().decode(data);
  session.buffer += text;
  // ... slices the string if it exceeds 2MB
}
```

**The Issue (Resolved):** 
String concatenation and slicing (`session.buffer.slice(trim)`) on a 2MB string for *every* incoming PTY chunk created massive Garbage Collection (GC) pressure.
**The Fix (Implemented):** 
Migrated the PTY buffer to a pre-allocated `Uint8Array` ring buffer, writing bytes directly without string decode/encode cycles.

## 3. Terminal Resizing Logic ([TerminalView.tsx](file:///Users/wilky/Developer/bord/src/components/terminal/TerminalView.tsx))
The terminal resizing logic attempts to manually calculate the number of columns and rows based on font size and an arbitrary `CHAR_WIDTH_RATIO = 0.6`.

**The Issue (Resolved):**
This manual calculation is prone to rounding errors resulting in sub-pixel rendering issues. This was the root cause of the "2-finger scroll" bug.
**The Fix (Implemented):**
Now relies on Ghostty's `proposeDimensions` and uses the Canvas API `measureText` method to determine exact sub-pixel widths as a fallback.

## 4. State Management ([store/terminals.ts](file:///Users/wilky/Developer/bord/src/store/terminals.ts))
The SolidJS implementation here is flawless. Using `createStore` and highly specific `setState` updates ensures that only the affected components re-render. 

**Highlight:** The [getVisibleTerminals()](file:///Users/wilky/Developer/bord/src/store/terminals.ts#30-37) computed signal driving the [TilingLayout](file:///Users/wilky/Developer/bord/src/components/layout/TilingLayout.tsx#12-147) is implemented perfectly. Drag-and-drop converting to absolute indices via custom Pointer Events is also extremely well done.

## Summary
The foundation is fantastic. Before adding new features (like WYSIWYG piping or LLM tabs), I strongly recommend we:
1. **Refactor [pty-manager.ts](file:///Users/wilky/Developer/bord/server/services/pty-manager.ts)** (Resolved)
2. **Fix [TerminalView](file:///Users/wilky/Developer/bord/src/components/terminal/TerminalView.tsx#25-124) sizing** (Resolved)
3. (Optional but recommended) Decide if Bun is a permanent dependency or if we should port the backend to Rust via Tauri commands.
