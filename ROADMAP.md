# Bord Roadmap

Last updated: 2026-02-25

This roadmap reflects actual implementation status in the repo today. For execution details and acceptance criteria, see `docs/plan.md`.

## Shipped

- [x] Tiling terminal layout with horizontal scroll, resizable panels, and 1x/2x/3x/4x density controls
- [x] Drag-and-drop reorder of terminal panels
- [x] Terminal minimap with provider color coding and attention pulse
- [x] Workspace-scoped terminals (active + stashed)
- [x] Terminal ownership stays with workspace even if shell cwd changes
- [x] Return-to-workspace action when cwd drifts outside workspace root
- [x] Session resume linking for Claude/Codex/OpenCode via provider-aware commands
- [x] Provider tabs (Claude, Codex, OpenCode, Gemini)
- [x] Keyboard navigation: Cmd/Ctrl+N, Alt+Left/Right, Cmd/Ctrl+G
- [x] Stash/unstash workflow with attention badges and tray popover
- [x] Compact sidebar rail mode with hover flyout previews and quick switching
- [x] Global bell mute + per-terminal mute
- [x] Git panel operations: stage/unstage, diff, commit, push/pull, branches
- [x] Git stats badges on terminal headers and workspace tiles
- [x] Git popover UX accepted as current interaction model
- [x] Repo tree navigation in git panel (parent/sibling/child repos)
- [x] Docker compose discovery + per-project/per-service controls
- [x] Docker logs/shell spawn into terminals
- [x] Open workspace/file in VS Code or Cursor
- [x] App rename from cockpit to bord
- [x] Theme system with 15 curated themes, settings panel, and localStorage persistence
- [x] Built-in file icon packs (Bord Classic + Catppuccin + Material + vscode-icons) across file tree/tabs/git lists
- [x] Feature flags in settings (git/docker/sessions/providers) persisted via `/api/features`
- [x] In-app updater flow (launch check, settings check, update banner + install/relaunch)
- [x] Playwright end-to-end suite for core UI flows
- [x] Unit test baseline across routes/services/store/lib modules

## Partial / Needs Polish

- [ ] Gemini provider scanner is placeholder (no session discovery yet)
- [ ] Native desktop notifications are not fully wired (current model is in-app + chime)
- [ ] Layout density semantics need final polish for strict "resize all to chosen density" behavior in edge cases

## Active Phases

### Phase 0 - Documentation Alignment (Done)

- [x] Create living execution plan (`docs/plan.md`)
- [x] Update README to match shipped/partial features and current shortcuts
- [x] Add fixture-lab/how-to/testing documentation and media capture workflow
- [x] Keep roadmap synced to current implementation and test coverage

### Phase 1 - Core UX Parity (Done)

- [x] Sidebar rail mode: move hide/show into sidebar and support compact icon-only rail
- [x] Hover tooltips + fast provider/session switching in collapsed mode
- [x] Keep minimap + hotkeys as primary terminal navigation model (no extra chrome arrows)
- [x] Keep git panel popover model as accepted UX for this cycle
- [x] Add return-to-workspace action when cwd drifts from workspace root

### Phase 2 - Sessions and Provider Parity

- [ ] Complete multi-provider parity (Gemini discovery + clear empty-state behavior)
- [ ] Add session grouping/visibility improvements and straggler terminal indicators

### Phase 3 - Settings and Themes

- [x] Add settings surface (modal from gear icon, left nav with Appearance section)
- [x] Add theme selector (15 curated: Catppuccin ×4, Dracula, Gruvbox, Nord, Tokyo Night ×2, One Dark, Solarized, Rosé Pine, Ayu Mirage, Monokai Pro, Night Owl)
- [x] Keep terminal palette and app chrome synchronized per theme
- [x] Add built-in icon pack selector (Bord Classic + Catppuccin + Material + vscode-icons)
- [x] Add notification toggles to settings panel

### Phase 4 - Distribution and Quality

- [x] Auto-update checks from GitHub releases with user prompt/flow
- [x] Playwright smoke coverage for core app flows (expanded beyond smoke)
- [x] Unit tests for provider parsing, store behavior, routes/services, and notification transitions

## Deferred / Low Priority

- [ ] Full rename sweeps inside third-party mirror directories (for example `tmp-opencode/`)
- [ ] SSH/Tailscale remote workspace helper UX
- [ ] Docker resource metrics (CPU/memory) and deeper health diagnostics
