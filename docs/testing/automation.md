# Automation Workflow

## Goal

Automate repeatable fixture setup and media capture so docs and QA evidence stay current.

Prerequisite:

- `ffmpeg` must be available on `PATH` for `showcase-workflow.webm` generation.

## Commands

```bash
# Build fixture repos + git states + real claude/codex sessions
bun run scripts/fixtures/setup-demo.ts

# Register fixture workspaces into running Bord server
bun run scripts/fixtures/register-workspaces.ts

# Capture screenshots and short interaction video with agent-browser
bun run scripts/qa/capture-media.ts

# Optional cleanup
bun run scripts/fixtures/cleanup-demo.ts
```

## Capture Outputs

Generated media files (default):

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
- `docs/media/showcase-workflow.gif`
- `docs/media/showcase-workflow.webm`

## Environment Variables

- `BORD_FIXTURE_ROOT` - override fixture root (default `~/Developer/bord-fixtures`)
- `BORD_API_URL` - workspace API base (default `http://localhost:4200`)
- `BORD_APP_URL` - UI URL for media capture (default `http://localhost:1420`)
- `AGENT_BROWSER_SESSION` - browser session name for capture script
