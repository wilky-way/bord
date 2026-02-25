# Manual Test Matrix

Use this matrix with fixture environment from `docs/how-to/fixture-lab.md`.

## Legend

- `PASS`: behavior matches expected result
- `FAIL`: behavior diverges, attach screenshot and notes
- `N/A`: blocked by environment dependency

## Core Workspace + Terminal

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| W1 | Workspace scoping | Open workspace A terminals, switch to workspace B | A terminals disappear, B terminals show |
| W2 | Ownership persistence | In workspace A terminal, `cd` to unrelated path | Terminal remains in workspace A |
| W3 | New terminal hotkey | Press `Cmd/Ctrl+N` in active workspace | New terminal card appears |
| W4 | Adjacent navigation | Press `Alt+Left/Right` | Focus moves to previous/next card |
| W5 | Drag reorder | Drag card positions | Card order updates and persists in store |
| W6 | Density controls | Toggle `1x` -> `4x` -> `2x` | Layout updates with matching visible column count |
| W7 | Minimap navigation | Click minimap item | Corresponding terminal becomes active |

## Stash + Notifications

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| N1 | Stash terminal | Stash active terminal | Terminal hidden, appears in stash tray |
| N2 | Attention on output | Produce output in stashed terminal | Attention indicator appears |
| N3 | Restore from stash | Unstash terminal | Terminal returns with state intact |
| N4 | Global bell mute | Toggle top bell mute, produce output | No bell played globally |
| N5 | Per-terminal mute | Mute one terminal, produce output there | Terminal-specific bell suppressed |

## Sessions

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| S1 | Claude sessions | Open Claude tab in fixture workspace | Seeded Claude sessions are listed |
| S2 | Codex sessions | Open Codex tab in fixture workspace | Seeded Codex sessions are listed |
| S3 | Resume session | Click a session card | New terminal starts with provider resume command |
| S4 | Provider filtering | Switch provider tabs | Session list changes per provider |
| S5 | Gemini placeholder | Open Gemini tab | Empty/placeholder behavior is clear |

## Git Panel

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| G1 | Open git panel | Toggle git panel on active terminal | Git widget appears for active repo |
| G2 | File status groups | Inspect fixture-web and fixture-api | Staged/unstaged/untracked entries are accurate |
| G3 | Diff open | Click changed file | Diff renders in panel |
| G4 | Stage/unstage | Move files between groups | Lists and counts update correctly |
| G5 | Commit | Commit staged files with message | Commit succeeds and staged list clears |
| G6 | Push indicator | Use repo ahead of remote | Push affordance appears and works |
| G7 | Repo tree nav | Navigate parent/sibling/child repo list | Repo switch updates panel and stats |

## Docker

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| D1 | Compose discovery | Select `fixture-docker` workspace | Compose projects/services listed |
| D2 | Start services | Click start controls | Containers transition to running state |
| D3 | Stop/restart/pull | Run each action | Status and logs reflect action |
| D4 | Open logs/shell | Launch logs/shell actions | New terminal card opens with command output |

## Editor Integration

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| E1 | Open preferred editor | Click primary editor button | Workspace opens in preferred editor |
| E2 | Switch editor | Use dropdown and select other editor | New editor becomes default |

## Settings + Feature Flags

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| X1 | OS notification permission handling | In Settings -> Notifications, toggle Desktop notifications on when browser permission is denied/default | Setting only remains on when permission is granted |
| X2 | Active provider fallback | Select non-default provider tab, disable it in Settings -> Features -> Providers | Active provider auto-falls back to next enabled provider |
| X3 | Last-provider lockout | Disable providers until one remains enabled | Final provider toggle is disabled and cannot be turned off |

## Evidence

Record results in `docs/testing/evidence.md` with:

- test ID
- PASS/FAIL
- screenshot/video path
- short notes
