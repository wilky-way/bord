# bord

A workspace-scoped terminal manager with tiling layout, git integration, docker controls, and multi-provider session resume — built as a native desktop app.

<p align="center">
  <img src="./docs/media/bord-logo.png" alt="bord logo" width="280" />
</p>

![SolidJS](https://img.shields.io/badge/SolidJS-335C88?logo=solid&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-24C8D8?logo=tauri&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)

![Bord workflow showcase](./docs/media/showcase-workflow.gif)

[Full workflow video (WebM)](./docs/media/showcase-workflow.webm)

Workspace switching, session launches, density transitions, stash/unstash, minimap navigation, and git diff — all from one tiling terminal manager.

### Snap-scroll between full-width terminals

![Horizontal scrolling at 1x density](./docs/media/horizontal-scroll-1x.gif)

Swipe or arrow-key between terminals at 1x density — the mid-scroll state shows partial panels on both sides before snapping into place.

## Status

- **Execution plan:** `docs/plan.md`
- **Roadmap:** `ROADMAP.md`
- **Fixture lab guide:** `docs/how-to/fixture-lab.md`
- **Operator guide:** `docs/how-to/using-bord.md`

## Demo Media

Media generated from fixture automation (`bun run qa:capture-media`):

### Provider Sessions (Claude + Codex)

![Claude sessions in fixture workspace](./docs/media/sessions-claude.png)

Shows seeded Claude sessions in the same fixture workspace used for capture.

![Codex sessions in fixture workspace](./docs/media/sessions-codex.png)

Shows seeded Codex sessions for the same workspace so provider switching is visible and comparable.

### Terminal Provider Icons + Mixed Session Tabs

![Mixed Claude and Codex terminals](./docs/media/terminals-provider-icons.png)

Shows active terminal cards with mixed provider icons after launching terminals from both session providers.

### Layout Density: 1x vs 4x - Resizes ALL terminals to fit 1, 2, 3, 4 per viewport. Horizontal scroll 

![Single-column 1x density](./docs/media/layout-1x.png)

1x mode emphasizes one terminal at a time for focus workflows.

![Four-column 4x density](./docs/media/layout-4x.png)

4x mode shows multi-terminal parallel workflows in the same viewport.
5 terminals in 4x mode means you have 1 terminal overflowing to the right to scroll to.
Resets manual resize.

### Minimap Hover Tooltip

![Minimap hover with provider context](./docs/media/minimap-hover-provider-tooltip.png)

Shows minimap hover behavior with provider-aware terminal context.

### Git Diff View (In-Panel) - Double Click to Open in Cursor/VS Code

![Git panel with selected file diff](./docs/media/git-panel-diff-selected.png)

Shows staged/changed lists and an active diff render inside the git panel.

### Stash Tray Popover

![Stash tray popover](./docs/media/stash-sidebar-popover.png)

Shows workspace stash tray behavior with active/stashed terminal states.

### Collapsed Rail Counters

![Collapsed sidebar rail counters](./docs/media/sidebar-rail-counters.png)

Shows per-workspace terminal counters in collapsed mode (`total-active-stashed`) with attention badge.

### Workspace Hover Preview

![Workspace hover preview with tabs](./docs/media/sidebar-hover-workspace-preview.png)

Shows workspace hover preview tabs (`Sessions`, `All`, `Active`, `Stashed`), provider switchers, and quick-action buttons for spawning new sessions and terminals.

### Docker Section Expanded

![Expanded Docker section](./docs/media/docker-panel-expanded.png)

Shows Docker section expanded in sidebar for compose discovery and controls.

### Editor Controls

![Open in editor controls](./docs/media/open-in-editor-controls.png)

Shows workspace-level editor launch controls.

### Theme Picker (Settings Panel)

![Settings panel with 15 theme swatches](./docs/media/settings-theme-picker.png)

Settings panel with 15 curated theme swatches — each swatch shows a mini terminal preview with palette colors and a chrome strip. Click to apply instantly.

### Theme Examples

![Gruvbox Dark theme](./docs/media/theme-gruvbox-dark.png)

Gruvbox Dark — warm earthy tones.

![Dracula theme](./docs/media/theme-dracula.png)

Dracula — deep purple accents.

![Tokyo Night theme](./docs/media/theme-tokyo-night.png)

Tokyo Night — deep blue with pastel highlights.

![Rosé Pine theme](./docs/media/theme-rose-pine.png)

Rosé Pine — muted purple and gold.

## Features

### Terminal Management
- **Tiling layout** — terminals tile side-by-side in a horizontally scrollable row
- **Layout density** — 1x/2x/3x/4x column buttons to control how many terminals are visible at once (0 = auto-fit all)
- **Drag-and-drop reorder** — grab a terminal title bar and drag to reposition
- **Resizable panels** — drag panel edges to adjust width ratios
- **Stash/unstash** — hide terminals without destroying them; stashed terminals show attention badges when new output arrives
- **Notification controls** — per-terminal mute controls from terminal card or stash tray
- **Terminal minimap** — compact navigation strip in the top bar center, alongside density buttons and the + add-terminal button

### Workspace Scoping
- **Terminal isolation** — each workspace maintains its own set of active and stashed terminals
- **Workspace switching** — swap entire terminal sets by selecting a different workspace
- **Ownership persistence** — terminals remain owned by their workspace even after `cd` to other paths
- **Folder browser** — browse and add workspace directories via the filesystem API

### Session Integration (Multi-Provider)
- **Provider tabs** — switch session lists between Claude, Codex, OpenCode, and Gemini modes; quick-action buttons alongside tabs for spawning new sessions and terminals
- **Session scanning** — reads provider-specific session stores (`~/.claude/projects/`, `~/.codex/sessions/`, OpenCode storage dirs)
- **Session resume** — click a session card to open a new terminal with provider-specific resume command mapping
- **Idle detection** — terminals track `lastOutputAt` and `lastSeenAt` timestamps; attention badges pulse when unseen output arrives
- **Attention chime** — visual pulse animation on minimap dots for terminals that need attention
- **Current gap** — Gemini scan/resume discovery is still placeholder-only

### Git Workflow
- **Status** — branch name and dirty indicator on each terminal title bar
- **Stage/unstage** — individual files or stage-all/unstage-all
- **Diff viewer** — inline diff view for staged and unstaged changes
- **Commit** — commit with message from the git panel
- **Push/pull** — push button appears on title bar when commits are ahead; one-click push
- **Branch management** — list branches, checkout/switch
- **Repo navigation** — jump to parent/sibling/child git repos from inside the panel

### Docker Panel
- **Compose discovery** — scans workspace for compose files
- **Container controls** — start/stop/restart/pull at project or service level
- **Logs and shell** — open `docker logs -f` and `docker exec -it ... sh` in new terminals
- **Live refresh** — container status polling refreshes panel state

### Themes
- **15 curated themes** — Catppuccin (Frappe, Mocha, Macchiato, Latte), Dracula, Gruvbox Dark, Nord, Tokyo Night, Tokyo Night Storm, One Dark, Solarized Dark, Rosé Pine, Ayu Mirage, Monokai Pro, Night Owl
- **Synchronized palettes** — terminal ANSI colors and app chrome (backgrounds, borders, accents) update together per theme
- **Live preview** — click a theme swatch to apply instantly; no restart needed
- **Settings panel** — gear icon in sidebar opens a modal with theme grid showing mini terminal previews
- **Persistence** — selected theme saved to `localStorage` and restored on reload

### Editor Integration
- **VS Code and Cursor** — open workspace directory in either editor via CLI (`code .` / `cursor .`)
- **Preference persistence** — last-used editor saved to `localStorage` and remembered across sessions
- **Split button** — primary click opens preferred editor; dropdown to switch

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+N` / `Ctrl+N` | New terminal in active workspace |
| `Cmd+Left` / `Ctrl+Left` | Focus previous terminal |
| `Cmd+Right` / `Ctrl+Right` | Focus next terminal |
| `Cmd+G` / `Ctrl+G` | Toggle git panel for active terminal |

## Architecture

### Why This Stack?

These choices form a coherent stack for a desktop app that spawns PTY processes, streams real-time output to multiple panes, and needs to stay lightweight. [OpenCode](https://github.com/anomalyco/opencode) uses the same core stack (Tauri v2 + SolidJS + ghostty-web + Bun) for their desktop AI coding tool.

| Choice | Over | Why |
|--------|------|-----|
| [ghostty-web](https://github.com/coder/ghostty-web) | xterm.js | Compiles Ghostty's battle-tested native VT100 parser to WASM instead of reimplementing terminal emulation from scratch in JavaScript. The win is correctness — proper grapheme cluster handling, complex script rendering (Devanagari, Arabic, RTL), and full XTPUSHSGR/XTPOPSGR escape sequence support that xterm.js lacks. ~400 KB WASM bundle, zero runtime dependencies, and xterm.js API-compatible so it's a drop-in swap. Performance parity with native Ghostty is still in progress (the RenderState delta-update API hasn't landed in the web build yet), but the emulation fidelity is already ahead. Created by Coder for their agentic dev tool Mux. |
| **Bun** | Node.js | Native PTY support via `Bun.spawn({ terminal })` — no node-pty dependency (which doesn't even work under Bun). Built-in SQLite (`bun:sqlite`), native WebSocket in `Bun.serve()`, and `bun build --compile` for single-binary distribution. One runtime replaces three dependencies. |
| **SolidJS** | React | Fine-grained reactivity without a virtual DOM. When multiple terminal panes stream output while the UI updates layout, minimap, and attention badges simultaneously, SolidJS touches only the exact DOM nodes that changed — no component-level re-renders. ~7 KB gzipped vs ~40 KB. |
| **Tauri v2** | Electron | Uses the system WebView instead of bundling Chromium. ~30–40 MB memory at idle vs ~200–300 MB. Sub-second startup. Capability-based security (everything disabled by default) fits an app that spawns shell processes. The Bun server runs as a sidecar managed by the Rust shell. |

### System Architecture

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
        Editors["VS Code / Cursor CLI"]
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

### Component Tree

```mermaid
graph TD
    App --> TopBar
    App --> Sidebar
    App --> TilingLayout

    TopBar --> LayoutDensityButtons["Layout Density (1x-4x)"]
    TopBar --> TerminalMinimap
    TopBar --> AddTerminalButton["Add Terminal (+)"]

    Sidebar --> WorkspaceList
    Sidebar --> ProviderTabs["ProviderTabs + Quick Actions"]
    Sidebar --> SessionList
    Sidebar --> DockerPanel
    Sidebar --> SettingsPanel
    SessionList --> SessionCard

    TilingLayout --> ResizablePanel
    ResizablePanel --> TerminalPanel
    TerminalPanel --> TerminalView["TerminalView (ghostty-web)"]
    TerminalPanel --> EditorButton
    TerminalPanel --> GitBadge["Branch Badge"]

    WorkspaceList --> EditorButton2["EditorButton"]

    style App fill:#8caaee,color:#232634
    style TilingLayout fill:#a6d189,color:#232634
    style TerminalView fill:#e5c890,color:#232634
```

### State Management

```mermaid
graph LR
    subgraph Store["SolidJS Store"]
        Core["core.ts<br/>createStore&lt;AppState&gt;"]
    end

    subgraph Slices["Action Modules"]
        Terminals["terminals.ts<br/>add/remove/stash/move"]
        Workspaces["workspaces.ts<br/>load/create/delete"]
        Sessions["sessions.ts<br/>loadSessions()"]
        GitStore["git.ts<br/>refreshGitStatus()"]
        UI["ui.ts<br/>toggleSidebar()"]
    end

    subgraph State["AppState Shape"]
        S1["terminals: TerminalInstance[]"]
        S2["activeTerminalId: string | null"]
        S3["workspaces: Workspace[]"]
        S4["activeWorkspaceId: string | null"]
        S5["sidebarOpen: boolean"]
        S6["layoutColumns: number"]
        S7["gitPanelTerminalId: string | null"]
        S8["bellMuted: boolean"]
        S9["activeProvider: Provider"]
        S10["sidebarCollapsed: object"]
    end

    Terminals --> Core
    Workspaces --> Core
    Sessions -.->|"signal-based"| Sessions
    GitStore -.->|"signal-based"| GitStore
    UI --> Core
    Core --> State
```

### Server Routes & Services

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

### WebSocket Data Flow

```mermaid
sequenceDiagram
    participant Client as SolidJS Client
    participant Server as Bun WS Handler
    participant PTY as PTY Process

    Client->>Server: WS connect /ws/pty/:id?cursor=N
    Server->>Server: attachWs(id, ws, clientCursor)
    Server->>Client: Binary: replay buffered data (64KB chunks)
    Server->>Client: JSON: { type: "cursor", cursor: N }

    loop Terminal I/O
        Client->>Server: Binary: raw stdin bytes
        Server->>PTY: terminal.write(data)
        PTY->>Server: terminal.data callback
        Server->>Client: Binary: raw stdout bytes
    end

    Client->>Server: JSON: { type: "resize", cols, rows }
    Server->>PTY: terminal.resize(cols, rows)

    Client->>Server: JSON: { type: "ping" }
    Server->>Client: JSON: { type: "pong" }

    Client->>Server: WS close
    Server->>Server: detachWs(id, ws)
```

### Terminal Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: addTerminal()
    Created --> Active: WebSocket attached
    Active --> Active: I/O streaming
    Active --> Stashed: stashTerminal()
    Stashed --> Active: unstashTerminal()
    Active --> Destroyed: removeTerminal()
    Stashed --> Destroyed: removeTerminal()
    Destroyed --> [*]

    Active --> NeedsAttention: output while unfocused
    NeedsAttention --> Active: user focuses terminal

    note right of Stashed
        PTY stays alive.
        WS reconnects when
        the panel is visible.
        Attention badge pulses
        on new output.
    end note
```

## UI Layout

```
┌──────────────────────────────────────────────────────┐
│  TopBar                                              │
│  [bord] [3 terminals]   [1x 2x 3x 4x] ··●·· [+]    │
├──────────┬───────────────────────────────────────────┤
│ Sidebar  │  TilingLayout                             │
│          │ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│ Workspace│ │ Terminal  │ │ Terminal  │ │ Terminal  │   │
│ List     │ │ Panel     │ │ Panel     │ │ Panel     │   │
│          │ │           │ │           │ │           │   │
│──────────│ │ ghostty   │ │ ghostty   │ │ ghostty   │   │
│          │ │ -web      │ │ -web      │ │ -web      │   │
│ Session  │ │           │ │           │ │           │   │
│ List     │ └──────────┘ └──────────┘ └──────────┘   │
│          │                                    [+]    │
└──────────┴───────────────────────────────────────────┘
```

### Color Palette (Default: Catppuccin Frappe)

15 built-in themes are available via Settings (gear icon). Each theme defines both app chrome CSS variables and a matched terminal ANSI palette. The default is Catppuccin Frappe:

| Role | Variable | Hex | Catppuccin Name |
|------|----------|-----|-----------------|
| Background | `--bg-primary` | `#232634` | Crust |
| Panels | `--bg-secondary` | `#292c3c` | Mantle |
| Buttons/Cards | `--bg-tertiary` | `#414559` | Surface0 |
| Borders | `--border` | `#51576d` | Surface1 |
| Text | `--text-primary` | `#c6d0f5` | Text |
| Subtle text | `--text-secondary` | `#a5adce` | Subtext0 |
| Accent | `--accent` | `#8caaee` | Blue |
| Accent hover | `--accent-hover` | `#babbf1` | Lavender |
| Danger | `--danger` | `#e78284` | Red |
| Success | `--success` | `#a6d189` | Green |
| Warning | `--warning` | `#e5c890` | Yellow |
| Diff additions | `--diff-add-bg` | `#12261e` | — |
| Diff deletions | `--diff-delete-bg` | `#2d1215` | — |

Other themes: Catppuccin Mocha/Macchiato/Latte, Dracula, Gruvbox Dark, Nord, Tokyo Night, Tokyo Night Storm, One Dark, Solarized Dark, Rosé Pine, Ayu Mirage, Monokai Pro, Night Owl.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.1+
- [Rust](https://rustup.rs/) + Cargo (for Tauri desktop builds only)

### Web Mode (development)

```bash
bun install
bun run dev
# UI on http://localhost:1420, server on http://localhost:4200
```

### Desktop Mode (Tauri)

```bash
bun run tauri:dev
```

### Compiled Server

```bash
bun run build:server
# Produces dist/bord-server single binary
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BORD_PORT` | `4200` | Server HTTP/WS port |
| `BORD_CORS_ORIGIN` | `http://localhost:1420` | Allowed CORS origin |

## Testing

### Automated

- Run current unit tests: `bun test src/lib/providers.test.ts`
- Note: broad app-level unit and Playwright suites are planned but not fully implemented yet.

### Fixture lab + media automation

```bash
bun run fixtures:setup
bun run fixtures:register
bun run qa:capture-media
```

- Setup details: `docs/how-to/fixture-lab.md`
- Automation details: `docs/testing/automation.md`
- Manual matrix: `docs/testing/manual-matrix.md`
- Evidence template: `docs/testing/evidence.md`

### Manual verification checklist

1. `bun run dev` and confirm UI/server boot (`:1420` + `:4200`)
2. Add at least two workspaces and verify terminal sets are isolated per workspace
3. Stash terminal(s), produce output, verify attention indicators and mute controls
4. Resume a provider session from SessionList and verify linked terminal behavior
5. Open git panel (`Cmd+G`) and test stage/diff/commit/push flow
6. Open Docker panel and verify compose discovery and start/stop/logs actions
7. Verify 1x/2x/3x/4x density controls, drag reorder, and minimap navigation
8. Open Settings (gear icon), switch themes, verify chrome + new terminal palettes update

## Project Structure

```
bord/
├── server/
│   ├── index.ts              # Bun.serve() entry — routes + WebSocket
│   ├── routes/
│   │   ├── docker.ts         # /api/docker/* (discover, containers, up/down/restart/pull, logs)
│   │   ├── editor.ts         # POST /api/editor/open
│   │   ├── fs.ts             # GET /api/fs/browse
│   │   ├── git.ts            # /api/git/* (status, diff, stage, commit, push, pull, branches, checkout)
│   │   ├── health.ts         # GET /api/health
│   │   ├── pty.ts            # POST/GET/DELETE /api/pty
│   │   ├── session.ts        # GET /api/sessions
│   │   └── workspace.ts      # CRUD /api/workspaces
│   ├── services/
│   │   ├── db.ts             # SQLite via bun:sqlite
│   │   ├── docker-service.ts # Docker compose discovery + container controls
│   │   ├── editor-service.ts # Spawn VS Code / Cursor CLI
│   │   ├── git-service.ts    # Shell out to git
│   │   ├── pty-manager.ts    # PTY lifecycle + 2MB circular buffer + WS fan-out
│   │   ├── session-scanner.ts# Scan provider session stores (Claude/Codex/OpenCode/Gemini)
│   │   └── workspace-service.ts
│   ├── ws/
│   │   ├── handler.ts        # WS upgrade, message routing, close
│   │   └── protocol.ts       # Control message types (resize, ping/pong, cursor)
│   └── schema.sql            # workspaces, session_cache, app_state tables
├── src/
│   ├── App.tsx               # Root layout + global keyboard shortcuts
│   ├── index.tsx             # SolidJS render entry
│   ├── styles.css            # CSS variable defaults (overridden by active theme) + Tailwind
│   ├── components/
│   │   ├── docker/           # DockerPanel
│   │   ├── git/              # GitPanel, ChangedFilesList, CommitInput, DiffViewer
│   │   ├── icons/            # ProviderIcons (Claude, VS Code, Cursor, etc.)
│   │   ├── layout/           # TopBar, Sidebar, TilingLayout, ResizablePanel, TerminalMinimap
│   │   ├── session/          # ProviderTabs, SessionList, SessionCard
│   │   ├── settings/         # SettingsPanel (theme picker)
│   │   ├── shared/           # EditorButton
│   │   ├── terminal/         # TerminalPanel, TerminalView
│   │   └── workspace/        # WorkspaceList
│   ├── lib/
│   │   ├── api.ts            # Typed HTTP client for all server routes
│   │   ├── terminal-writer.ts# Terminal data writer utility
│   │   ├── theme.ts          # Reactive theme manager (signals + CSS var application)
│   │   ├── themes/           # Theme definitions (15 curated) + BordTheme type
│   │   ├── use-drag-reorder.ts# Pointer-event drag reorder hook
│   │   └── ws.ts             # WebSocket connection manager
│   └── store/
│       ├── core.ts           # createStore<AppState> — single source of truth
│       ├── types.ts          # TerminalInstance, Workspace, SessionInfo, GitStatus, AppState
│       ├── terminals.ts      # Terminal actions (add, remove, stash, move, navigate)
│       ├── workspaces.ts     # Workspace CRUD actions
│       ├── sessions.ts       # Session loading (signal-based)
│       ├── git.ts            # Git status refresh (signal-based)
│       └── ui.ts             # UI toggles
├── src-tauri/                # Tauri v2 Rust shell
│   ├── tauri.conf.json       # Window config, CSP, bundle settings
│   ├── Cargo.toml
│   └── src/
├── scripts/
│   ├── fixtures/             # fixture setup/register/cleanup automation
│   └── qa/                   # agent-browser media capture automation
├── docs/
│   ├── how-to/               # operator and fixture guides
│   ├── testing/              # matrix, evidence, automation docs
│   └── media/                # screenshots and videos for README/docs
├── index.html                # Vite entry HTML
├── vite.config.ts            # SolidJS + Tailwind + proxy to :4200
├── package.json
├── tsconfig.json
├── bord.db                   # SQLite database (created at runtime)
└── ROADMAP.md
```

## License

Private — not yet published under an open-source license.
