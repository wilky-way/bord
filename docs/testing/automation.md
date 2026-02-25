# Automation Workflow

## Goal

Automate repeatable fixture setup and media capture so docs and QA evidence stay current.

Media capture supports three profiles via `BORD_CAPTURE_MODE`:

- `mixed` (default): context shots for layout + closeups for feature readability
- `context`: full-frame captures everywhere
- `closeup`: selector-focused closeups wherever available

Prerequisite:

- `ffmpeg` must be available on `PATH` for `showcase-workflow.webm` generation.

## Commands

```bash
# Build fixture repos + git states + real claude/codex sessions
bun run fixtures:setup

# Register fixture workspaces into running Bord server
bun run fixtures:register

# Capture screenshots and short interaction video with agent-browser
bun run qa:capture-media

# Capture media + horizontal scroll in parallel (uses separate browser sessions)
bun run qa:capture-media:parallel

# Run automated verification suites
bun run test:unit
bun run test:e2e

# Optional cleanup
bun run fixtures:cleanup
```

## Capture Outputs

Generated media files (default mixed profile):

- `docs/media/home-overview.png`
- `docs/media/terminals-provider-icons.png`
- `docs/media/layout-1x.png`
- `docs/media/layout-4x.png`
- `docs/media/minimap-hover-provider-tooltip.png`
- `docs/media/sessions-claude.png`
- `docs/media/sessions-codex.png`
- `docs/media/git-panel-diff-selected.png`
- `docs/media/stash-sidebar-popover.png`
- `docs/media/sidebar-rail-counters.png`
- `docs/media/sidebar-hover-workspace-preview.png`
- `docs/media/docker-panel-expanded.png`
- `docs/media/open-in-editor-controls.png`
- `docs/media/settings-appearance.png`
- `docs/media/settings-theme-picker.png`
- `docs/media/settings-notifications.png`
- `docs/media/settings-features.png`
- `docs/media/settings-about-updates.png`
- `docs/media/showcase-workflow.gif`
- `docs/media/showcase-workflow.webm`

## Environment Variables

- `BORD_FIXTURE_ROOT` - override fixture root (default `~/Developer/bord-fixtures`)
- `BORD_API_URL` - workspace API base (default `http://localhost:4200`)
- `BORD_APP_URL` - UI URL for media capture (default `http://localhost:1420`)
- `AGENT_BROWSER_SESSION` - browser session name for capture script
- `BORD_CAPTURE_MODE` - `mixed`, `context`, or `closeup` (default `mixed`)
- `BORD_SKIP_FIXTURES=1` - skip fixture setup/register in parallel capture wrapper
