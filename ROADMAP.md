# Bord Roadmap

## Completed

The following features have shipped and are available in the current build:

- **Tiling terminal layout** with horizontal scroll, resizable panels, and auto-fit or fixed 1x–4x column density
- **Drag-and-drop reorder** of terminal panels with visual drop indicators
- **Terminal minimap** in the top bar for quick navigation with attention pulse indicators
- **Stash/unstash** terminals with attention badges on new output while hidden
- **Workspace scoping** — terminals are isolated per workspace; switching workspaces swaps terminal sets
- **Keyboard shortcuts** — Cmd+N (new terminal), Cmd+Left/Right (navigate adjacent)
- **Scroll sync** — parallel scroll mode syncing position across all visible terminals
- **Claude session scanning** — discovers sessions from `~/.claude/projects/`, resume via `--resume` flag
- **Git integration** — branch badge + dirty indicator on title bar, stage/unstage, diff viewer, commit, push/pull, branch checkout
- **Editor integration** — open workspace in VS Code or Cursor with preference persistence
- **Catppuccin Frappe theme** with CSS custom properties
- **Tauri v2 desktop shell** with CSP and window configuration
- **2-finger horizontal scroll fix** for ghostty-web canvas
- **App rename** from "cockpit" to "bord"

---

## Phase 1 — Core Polish

- [x] Stash terminals + notifications (badge, sound, pulse)
- [x] Terminal sync: workspace → tab → session
- [x] 2-finger horizontal scroll fix
- [x] Terminal minimap navigation
- [x] Navigation hotkeys (Cmd+Arrow to snap next/prev terminal)
- [x] Drag + drop reorder terminals
- [x] Layout density buttons (1x/2x/3x/4x columns in TopBar)
- [ ] Investigate spurious terminal focus notifications (external file changes triggering attention badges)
- [x] Open in VS Code / Cursor buttons (workspace context, via CLI)

## Phase 2 — Workspace Scoping

- [x] Scope terminals per workspace (active + stashed kept per workspace)
- [x] Switching workspaces swaps terminal sets
- [ ] Return-to-workspace button if you `cd` away (requires live cwd tracking via OSC sequences)

## Phase 3 — Git Integration

- [x] Git overlay panel (same dimensions as terminal, toggle via branch button)
- [x] Unstaged/staged file list, diff view in-card
- [x] Commit with message, push, branch management
- [x] Lines changed indicators on tab + workspace sidebar

## Phase 4 — Multi-Provider Sessions

- [ ] Show sessions by CLI provider (Claude/Codex/OpenCode/Gemini) with SVG icons
- [ ] WYSIWYG prompt editor that pipes to active CLI terminal
- [ ] Provider mode tabs

## Phase 5 — Theming + Settings

- [ ] Theme selector (Catppuccin, Gruvbox, One Dark, Ghostty themes)
- [ ] Settings menu (toggle WYSIWYG editor, theme, etc.)
- [x] App rename from "cockpit" to "bord"

## Phase 6 — Distribution + Quality

- [ ] Auto-update from GitHub releases (polling + prompt)
- [ ] Playwright E2E tests
- [ ] Unit tests
