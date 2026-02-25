# Architecture Overview

This is the technical architecture reference for Bord.

If you are new to terminal internals, start with the [Terminal Ecosystem Primer](./how-to/terminal-ecosystem-primer.md).

## Stack Decisions

| Choice | Over | Why |
|--------|------|-----|
| [ghostty-web](https://github.com/coder/ghostty-web) | xterm.js | Ghostty parser fidelity in WASM with xterm-like API compatibility. |
| Bun server/runtime | Node.js | Native PTY support via `Bun.spawn({ terminal })`, built-in SQLite, native WS in `Bun.serve()`. |
| SolidJS | React | Fine-grained updates help when many terminals stream output concurrently. |
| Tauri v2 shell | Electron | Lower idle memory footprint and faster startup with system WebView. |

## System Architecture

```mermaid
graph TD
    subgraph Desktop["Tauri Shell"]
        WebView["WebView (SolidJS + Vite)"]
    end

    subgraph Server["Bun Server :4200"]
        Routes["HTTP Routes"]
        WS["WebSocket Handler"]
        Services["Service Layer"]
    end

    subgraph Backend["System Resources"]
        PTY["PTY Processes (zsh)"]
        SQLite["SQLite Database"]
        Git["Git CLI"]
        SessionStores["Provider session stores"]
        FS["Filesystem"]
        Editors["VS Code / Cursor / Zed CLI"]
    end

    WebView -->|"HTTP /api/*"| Routes
    WebView -->|"WS /ws/pty/:id"| WS
    Routes --> Services
    WS --> Services
    Services --> PTY
    Services --> SQLite
    Services --> Git
    Services --> SessionStores
    Services --> FS
    Services --> Editors
```

## Client State Model

- Core app state uses Solid `createStore` in `src/store/core.ts`.
- Async loaded slices (sessions/git) use dedicated signals for reactive decoupling.
- Terminal actions are mutation helpers in `src/store/terminals.ts`.

```mermaid
graph LR
    subgraph Store["SolidJS Store"]
        Core["core.ts<br/>createStore<AppState>"]
    end

    subgraph Slices["Action Modules"]
        Terminals["terminals.ts"]
        Workspaces["workspaces.ts"]
        Sessions["sessions.ts"]
        GitStore["git.ts"]
        UI["ui.ts"]
    end

    Terminals --> Core
    Workspaces --> Core
    UI --> Core
    Sessions -.->|"signal-based"| Sessions
    GitStore -.->|"signal-based"| GitStore
```

## Server Routes and Services

```mermaid
graph LR
    subgraph Routes["HTTP Routes"]
        R1["/api/health"]
        R2["/api/pty"]
        R3["/api/workspaces"]
        R4["/api/sessions"]
        R5["/api/git/*"]
        R6["/api/fs/browse"]
        R7["/api/editor/open"]
        R8["/api/docker/*"]
    end

    subgraph Services["Service Layer"]
        PtyMgr["pty-manager.ts"]
        WsSvc["workspace-service.ts"]
        SessScan["session-scanner.ts"]
        GitSvc["git-service.ts"]
        EdSvc["editor-service.ts"]
        DockerSvc["docker-service.ts"]
        DB["db.ts (SQLite)"]
    end

    R1 --> DB
    R2 --> PtyMgr
    R3 --> WsSvc
    R3 --> DB
    R4 --> SessScan
    R5 --> GitSvc
    R6 -.->|"fs/promises"| FS["Filesystem"]
    R7 --> EdSvc
    R8 --> DockerSvc
    WsSvc --> DB
```

## PTY WebSocket Flow

```mermaid
sequenceDiagram
    participant Client as SolidJS Client
    participant Server as Bun WS Handler
    participant PTY as PTY Process

    Client->>Server: WS connect /ws/pty/:id?cursor=N
    Server->>Client: JSON replay-start
    Server->>Client: Binary replay chunks
    Server->>Client: JSON replay-done + cursor

    loop Terminal I/O
        Client->>Server: Binary stdin
        Server->>PTY: terminal.write(data)
        PTY->>Server: terminal.data
        Server->>Client: Binary stdout
    end

    Client->>Server: JSON resize
    Server->>PTY: terminal.resize(cols, rows)

    Server->>Client: JSON idle / active
```

## Terminal Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: addTerminal()
    Created --> Active: WebSocket attached
    Active --> Stashed: stashTerminal()
    Stashed --> Active: unstashTerminal()
    Active --> Destroyed: removeTerminal()
    Stashed --> Destroyed: removeTerminal()
    Destroyed --> [*]

    Active --> Idle: server idle timer fires
    Idle --> Active: new output arrives
```

## Repository Structure

```text
bord/
├── server/              # Bun server: routes, services, ws protocol/handler
├── src/                 # SolidJS app: components, store, lib utilities
├── src-tauri/           # Tauri v2 shell configuration + Rust host
├── scripts/             # fixture setup and QA media capture scripts
├── docs/                # operator/testing/architecture/media documentation
└── e2e/                 # Playwright coverage
```
