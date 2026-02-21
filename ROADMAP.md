# Bord Roadmap

## Phase 1 — Core Polish (current)

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

- [ ] Git overlay panel (same dimensions as terminal, toggle via branch button)
- [ ] Unstaged/staged file list, diff view in-card
- [ ] Commit with message, push, branch management
- [ ] Lines changed indicators on tab + workspace sidebar

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
