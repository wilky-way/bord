# How To Use Bord

This is the practical operator guide for daily usage.

## Workspaces

- Add a workspace from the sidebar (`Workspaces` -> `+ Add`).
- Terminals are scoped to the active workspace.
- Active and stashed terminals remain tied to that workspace.
- If a terminal `cd`s elsewhere, ownership still stays with the original workspace.

## Terminal Cards

- Create terminal: `Cmd/Ctrl+N` or `+ Terminal`.
- Switch active terminal: `Cmd/Ctrl+Left` and `Cmd/Ctrl+Right`.
- Reorder cards with drag-and-drop.
- Use density buttons (`1x`, `2x`, `3x`, `4x`) to change visible columns.
- Use minimap in the top bar to jump to any terminal quickly.

## Stash + Notifications

- Stash a terminal from the terminal card controls.
- Stashed terminals keep running in the background.
- New output on stashed terminals shows attention indicators.
- Mute behavior:
  - Global bell mute from top bar
  - Per-terminal mute from terminal controls

## Sessions (Claude, Codex, OpenCode, Gemini)

- Choose provider tab in the sidebar.
- Select a session card to open a new terminal with provider-specific resume command.
- Session list is filtered by the active workspace path.

Current provider caveat:

- Gemini scanning/resume is still placeholder behavior.

## Git Panel

- Toggle from active terminal header or `Cmd/Ctrl+G`.
- Review unstaged and staged files.
- Open file diffs inline.
- Stage/unstage individual files or all files.
- Commit with a message, then push/pull from the same panel.
- Use repo tree controls (parent, siblings, children) to switch repos quickly.

## Docker Panel

- Open `Docker` section in sidebar.
- Bord scans for compose files under the active workspace.
- Use project/service controls:
  - Start
  - Stop
  - Restart
  - Pull
- Open logs or shell into a terminal card.

## Open In Editor

- Workspace-level editor button supports VS Code and Cursor.
- Primary action opens with your preferred editor.
- Dropdown lets you switch editors without changing workspace.

## Recommended Daily Flow

1. Pick workspace
2. Spawn 2-5 terminal cards
3. Resume a Claude/Codex session for context
4. Use git panel to stage/diff/commit
5. Stash long-running terminals
6. Use minimap + hotkeys for rapid navigation
