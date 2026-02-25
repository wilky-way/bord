# Bord Execution Plan (Living)

Last updated: 2026-02-25
Owner: OpenCode + Wilky

## Goal

Ship a polished Bord desktop experience with accurate docs, clear roadmap status, and a prioritized implementation backlog that matches what is already done vs what is still missing.

This document is the source of truth for:
- Current feature status (done/partial/missing)
- Research-backed UX decisions (Parallel Code + OpenCode)
- Delivery phases with acceptance criteria
- Validation and media evidence plan

## Current State Snapshot

### Done (confirmed in code)

- Workspace-scoped terminals (active + stashed per workspace)
- Terminal ownership persists by `workspaceId` even if shell cwd changes later
- Return-to-workspace action when cwd drifts outside workspace root
- Session resume linking for Claude/Codex/OpenCode via provider-aware command parsing
- Terminal minimap with provider icon + hover details + attention pulse
- Cmd/Ctrl shortcuts: new terminal, next/prev terminal, git panel toggle
- Drag-and-drop terminal reorder
- 1x/2x/3x/4x layout density controls
- Compact sidebar rail + hover flyout previews + quick workspace/session switching
- Stash terminals with attention and per-terminal mute + global bell mute
- Git operations in-app (status, diff, stage/unstage, commit, push/pull, branches)
- Workspace and terminal level git indicators
- Built-in file icon packs (Bord Classic + Catppuccin + Material + vscode-icons) across file tree/tabs/git rows
- Open in VS Code/Cursor (workspace and file level)
- Docker sidebar panel with compose discovery + start/stop/restart/pull + logs/shell
- App rename to bord (runtime/UI/tauri config)

### Partial

- Provider parity: Gemini exists in UI but scanner currently returns no sessions
- Native desktop notifications are partially implemented (permission-aware web notifications; native desktop parity still in progress)
- Layout density behavior is good, but strict "uniform resize all cards" semantics need extra polish around min-width constraints

### Missing

- Full Gemini session discovery/resume parity

## Key Behavioral Notes

- Workspace ownership is metadata based: terminals are assigned `workspaceId` at creation and stay in that workspace regardless of later `cd`.
- Session linking works when resume is launched via Bord session cards (provider resume command -> parsed `sessionId`).
- If a user manually runs a resume command in an existing terminal, automatic linkage is not currently inferred.

## Research Notes (Parallel Code + OpenCode)

### Patterns to borrow now

1. Terminal ownership + cwd drift controls
- Keep workspace ownership metadata-based.
- Provide an explicit one-click return action when shell cwd drifts outside the workspace root.

2. Collapsed rail navigation
- Keep a narrow icon rail always visible.
- Use hover tooltips in collapsed mode and flyout previews for fast switching.

3. Theme UX
- Preview theme on highlight, commit on select, cancel restores prior theme.

4. Notification store
- Maintain unseen counters by workspace/session with cooldown and dedupe.
- Support per-terminal and global mute policy in one place.

### External references

- Parallel Code README: https://github.com/johannesjo/parallel-code
- OpenCode README: https://github.com/anomalyco/opencode

### Local reference paths (vendor mirror)

- `tmp-opencode/packages/app/src/components/prompt-input.tsx`
- `tmp-opencode/packages/app/src/components/prompt-input/submit.ts`
- `tmp-opencode/packages/app/src/pages/layout/sidebar-shell.tsx`
- `tmp-opencode/packages/app/src/components/settings-general.tsx`
- `tmp-opencode/packages/ui/src/theme/context.tsx`
- `tmp-opencode/packages/app/src/context/notification.tsx`

## Delivery Phases

### Phase 0 - Truth in docs (P0)

Scope:
- Align README + ROADMAP to current implementation
- Add this living plan

Acceptance criteria:
- Docs clearly separate shipped vs partial vs planned
- No stale statements that conflict with code

### Phase 1 - Sidebar and navigation polish (P1)

Scope:
- Move sidebar hide/show control into sidebar rail
- Implement compact icon rail + hover tooltips + quick switch interactions
- Keep minimap + hotkeys as primary terminal navigation model (no extra chrome arrows)

Acceptance criteria:
- Sidebar can be fully collapsed to rail and still usable
- Workspace/provider/session switching works without reopening full sidebar

### Phase 2 - Git overlay parity (P1)

Scope:
- Keep popover model and focus on interaction smoothness + reliability
- Preserve titlebar branch stats + open/close affordances

Acceptance criteria:
- Git popover remains stable during resize/reflow and does not steal terminal focus unexpectedly
- Commit/push/pull/diff/stage flows remain fully functional

### Phase 3 - Session/provider polish (P1)

Scope:
- Provider session filtering and icon polish
- Clarify Gemini behavior (implemented scanner or explicit disabled state)
- Add optional "straggler" indicator for terminals not attached to an active workspace context

Acceptance criteria:
- Session panel behavior is consistent across providers
- No confusing empty provider states without explanation

### Phase 4 - File icon packs (P1)

Scope:
- Add built-in icon pack selector in settings
- Ship Bord Classic + Catppuccin + Material + vscode-icons packs
- Apply icons consistently in file tree, file tabs, and git changed-file rows

Acceptance criteria:
- Icon pack changes apply immediately and persist
- No regressions in file open/diff workflows

### Phase 5 - Themes + settings (P2)

Scope:
- Settings entry point
- Theme selection (catppuccin variants + gruvbox + one dark baseline)
- Notification and appearance preferences in settings

Acceptance criteria:
- Theme changes apply immediately and persist
- Terminal palette and app chrome remain coherent

### Phase 6 - Notifications + updater (P2)

Scope:
- Native desktop notification wiring (mac focused)
- Release checking + update prompt flow

Acceptance criteria:
- User can mute noisy alerts globally and per terminal
- App can detect newer github release and prompt update

### Phase 7 - Testing and quality gates (P2)

Scope:
- Unit tests for provider parsing + core store behavior
- Playwright smoke coverage for core UI flows

Acceptance criteria:
- CI-ready smoke suite for workspace/session/git terminal flows
- Manual checklist passes in desktop mode

## Testing Plan

### Manual smoke (desktop + web)

1. Workspace scoping + terminal stash/unstash behavior
2. Session resume linking and provider filtering
3. Git panel lifecycle (open, diff, stage, commit, push/pull)
4. Docker panel controls and log/shell spawn
5. Layout density + drag reorder + minimap navigation
6. Notification attention/mute behavior
7. Open in VS Code/Cursor flows

### Unit tests (current focus)

- Provider command parsing and resume command generation
- Workspace visibility filtering and terminal ownership rules
- Notification state transitions

### Playwright coverage (current focus)

- Create/select workspace and spawn terminal
- Stash terminal and restore from tray
- Switch provider tab and open a session card
- Toggle git panel and verify status rendering
- Collapse sidebar and navigate via rail

## README Media Capture Plan

Capture and store under `docs/media/`:

1. `workspace-scoping.gif`
- Open terminals in workspace A, switch to workspace B, confirm isolated sets.

2. `stash-notifications.gif`
- Stash terminals, trigger output, show attention badge + tray restore.

3. `providers-minimap.png`
- Show provider icons in minimap and hover tooltip context.

4. `layout-density.gif`
- With 5 terminals: show 1x vs 4x behavior and add-terminal action.

5. `git-overlay-flow.gif`
- Open git panel, stage file, view diff, commit, push.

6. `open-in-editor.png`
- Show workspace tile and terminal card editor actions.

7. `docker-controls.gif`
- Start/stop/restart and open logs/shell from docker section.

## Agent-Browser Validation Workflow

1. Start app in dev mode
2. Run scripted walkthrough with `agent-browser`
3. Capture screenshots/gifs per media checklist
4. Link assets in README feature sections
5. Record any mismatches in this document under a "Findings" section

## Findings Log

- 2026-02-21: Initial baseline created from code audit and docs reconciliation.
- 2026-02-21: Added fixture automation scripts (`scripts/fixtures/*`) using real `claude` and `codex` session seeding plus media capture automation (`scripts/qa/capture-media.ts`).
- 2026-02-22: Captured initial media set in `docs/media/` (overview, minimap, density, sessions, git panel, docker panel, editor controls) from fixture-based walkthrough.
- 2026-02-22: Hardened media capture for minimap tooltip visibility and storyboarded showcase replay; regenerated `docs/media/showcase-workflow.webm` and refreshed screenshot set.
- 2026-02-24: Ran full automated regression (`bun run test:unit`, `bun run test:e2e`) with green baseline (unit suites pass, Playwright 157 passed / 9 skipped).
- 2026-02-24: Hardened settings/provider controls: permission-aware OS notification toggle handling, switch accessibility semantics, active-provider reconciliation, and server-side provider invariant (at least one enabled).
