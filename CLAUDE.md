# CLAUDE.md — Bord

## What This Is

Bord is a workspace-scoped terminal manager with tiling layout, git integration, docker controls, feature flags, auto-updates, and multi-provider session resume. It runs as a Tauri v2 desktop app (or standalone web app during development).

**Tech stack:** SolidJS, Bun, Tauri v2, TypeScript, Tailwind CSS v4, SQLite (`bun:sqlite`), ghostty-web (WASM terminal emulator).

## Key File Paths

| Path | Purpose |
|------|---------|
| `server/index.ts` | Bun.serve() entry — HTTP routes + WebSocket |
| `server/services/pty-manager.ts` | PTY lifecycle, 2MB circular buffer, WS subscriber fan-out, server-side idle detection |
| `server/services/session-scanner.ts` | Scans provider session stores for Claude/Codex/OpenCode/Gemini sessions |
| `server/services/git-service.ts` | Shells out to `git` for status, diff, stage, commit, push, pull |
| `server/services/feature-flags.ts` | Persists and evaluates feature/provider enablement flags |
| `server/services/editor-service.ts` | Spawns `code .` or `cursor .` |
| `server/services/crash-log.ts` | JSONL crash log writer + in-memory ring buffer, auto-rotating at 512KB |
| `server/routes/crash-log.ts` | GET `/api/crash-log` — returns recent crash entries + log file path |
| `server/ws/protocol.ts` | WebSocket control message types (resize, ping/pong, cursor, idle/active, configure) |
| `server/ws/handler.ts` | WS upgrade, message dispatch, close handling |
| `server/schema.sql` | SQLite schema — workspaces, session_cache, app_state |
| `src/App.tsx` | Root layout + global keyboard shortcuts (Cmd+N, Cmd+Arrow) |
| `src/store/core.ts` | `createStore<AppState>` — single source of truth |
| `src/store/types.ts` | All TypeScript interfaces: TerminalInstance, Workspace, SessionInfo, GitStatus, AppState |
| `src/store/terminals.ts` | Terminal actions: add, remove, stash, unstash, move, navigate |
| `src/store/settings.ts` | Font size signal (persisted, clamped 8–24), global settingsOpen state |
| `src/store/features.ts` | Feature flags state (git/docker/sessions/providers) + active provider reconciliation |
| `src/lib/api.ts` | Typed HTTP client wrapping all `/api/*` routes |
| `src/lib/terminal-shortcuts.ts` | Terminal key handler — Cmd+C/V/K/A, Option+arrows, font size, bracketed paste, image paste |
| `src/lib/ws.ts` | WebSocket connection manager, idle/active event handling, output volume tracking, server health monitor |
| `src/lib/notifications/` | Notification store (localStorage-persisted), types, dual-indexed reactive index, sound system |
| `src/lib/debounce.ts` | Burst coalescer + keyed batch coalescer for WS event batching |
| `src/styles.css` | CSS variable defaults + Tailwind import (overridden at runtime by active theme) |
| `src/lib/theme.ts` | Reactive theme manager — signals, localStorage persistence, CSS var application |
| `src/lib/themes/index.ts` | 15 curated theme definitions (chrome + terminal palettes) |
| `src/components/settings/SettingsPanel.tsx` | Settings modal (appearance, notifications, features, about/updater, diagnostics/crash log viewer) |

## Store Architecture

The store uses SolidJS `createStore` with a single `AppState` object in `core.ts`. Action modules import `state` and `setState` from core and export pure functions:

- **`core.ts`** — `createStore<AppState>` (terminals, activeTerminalId, workspaces, activeWorkspaceId, sidebarOpen, layoutColumns)
- **`terminals.ts`** — mutations via `setState("terminals", ...)` — add, remove, stash, unstash, move, setActiveTerminal, activateAdjacentTerminal
- **`workspaces.ts`** — async CRUD via API calls + `setState("workspaces", ...)`
- **`sessions.ts`** — uses separate `createSignal` (not in the main store) for session list
- **`git.ts`** — uses separate `createSignal` for git status per-workspace
- **`ui.ts`** — simple toggles on the main store

Pattern: store slices that need async loading (sessions, git) use standalone signals. Static state lives in the main `createStore`.

## Server Architecture

Bun native HTTP server with manual route matching (no framework):

- **Routes** (`server/routes/`) — each file exports a function `(req, url) => Response | null`
- **Services** (`server/services/`) — business logic separated from HTTP handling
- **WebSocket** (`server/ws/`) — binary frames = raw PTY I/O; text frames = JSON control messages (resize, ping/pong, cursor)
- **Database** — `bun:sqlite` with tables: `workspaces`, `session_cache`, `app_state`

PTY manager maintains an in-memory Map of sessions, each with a 2MB circular buffer for replay on reconnect. Multiple WS clients can subscribe to the same PTY.

**Error handling:** Global `uncaughtException` / `unhandledRejection` handlers log to `crash-log.ts`. The HTTP `fetch()` handler is wrapped in try/catch. PTY unexpected exits and WebSocket message errors are logged. The crash log writes JSONL to disk (next to the DB file) and keeps the last 100 entries in memory for the `/api/crash-log` endpoint. Frontend catches `window.onerror` and `unhandledrejection`, surfacing errors via the notification system. A health monitor pings the server every 15s and notifies on connection loss/recovery.

## Conventions

- **SolidJS reactive patterns** — use `createSignal` / `createStore`, never React hooks. Components use `() => value` accessor pattern.
- **CSS variables for theming** — all colors defined as `--bg-primary`, `--accent`, etc. in `:root` in `styles.css`. Components reference these, not raw hex values.
- **Tailwind utilities** — v4 style (`@import "tailwindcss"`). Use utility classes with CSS variable references: `bg-[var(--bg-secondary)]`, `text-[var(--text-primary)]`.
- **No framework for routing** — server uses manual URL matching; client is a single-page app with no router.
- **Terminal rendering** — uses `ghostty-web` WASM package (excluded from Vite pre-bundling).

## Build & Run

```bash
# Development (web)
bun install
bun run dev          # Starts server (:4200) + Vite (:1420) concurrently

# Development (desktop)
bun run tauri:dev    # Tauri v2 dev mode

# Production build
bun run build        # Vite build (frontend)
bun run build:server # Compiled Bun binary → dist/bord-server
```

## Testing

Automated suites:

1. `bun run test:unit` — route/service/store/lib unit coverage
2. `bun run test:e2e` — Playwright end-to-end coverage across workspace/session/git/docker/files/settings flows

Manual verification (targeted smoke):

1. `bun run dev` — confirm both server and UI start
2. Add a workspace, verify terminals spawn in that workspace scope
3. Stash a terminal, confirm it moves to stash and notification badge behavior is correct
4. Open git panel on a repo with changes, verify status/diff/stage/commit flow
5. Click provider session cards (Claude/Codex/OpenCode), confirm resume terminal opens
6. Test Cmd+N, Cmd+Arrow/Alt+Arrow navigation, drag reorder, and layout density controls
