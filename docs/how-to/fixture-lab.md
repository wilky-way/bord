# Fixture Lab Setup

This guide builds a repeatable Bord demo environment with:

- Fake repos with realistic git states (staged, unstaged, untracked, ahead)
- Real Claude and Codex sessions created through the actual CLIs
- Docker compose fixtures for the sidebar Docker panel
- A manifest file that scripts and docs can reuse

## Prerequisites

- `git`, `bun`, `claude`, `codex`, `agent-browser`
- Claude and Codex authenticated locally
- Bord dev server available (`bun run dev`)

## 1) Create fixtures and seed real sessions

```bash
bun run scripts/fixtures/setup-demo.ts
```

Default fixture root:

```bash
~/Developer/bord-fixtures
```

Generated manifest:

```bash
~/Developer/bord-fixtures/fixture-manifest.json
```

The setup script creates these workspaces:

- `fixture-web` (`mono-hub/app-web`) - ahead + staged + unstaged + untracked
- `fixture-api` (`mono-hub/app-api`) - staged + unstaged + untracked
- `fixture-docker` (`infra-docker`) - compose discovery and controls
- `fixture-ui` (`playground-ui`) - clean workspace baseline
- `fixture-docs` (`docs-lab`) - docs workflow workspace

## 2) Register fixture workspaces in Bord

Start Bord first:

```bash
bun run dev
```

Then register workspaces via API:

```bash
bun run scripts/fixtures/register-workspaces.ts
```

## 3) Capture screenshots and videos

```bash
bun run scripts/qa/capture-media.ts

# Optional: force profile
# BORD_CAPTURE_MODE=context bun run scripts/qa/capture-media.ts
# BORD_CAPTURE_MODE=closeup bun run scripts/qa/capture-media.ts
```

Outputs are written to:

```bash
docs/media/
```

## 4) Clean up fixtures

```bash
bun run scripts/fixtures/cleanup-demo.ts
```

## Notes

- Session seeding intentionally uses real `claude` and `codex` commands to match production scanner behavior.
- If session seeding fails for auth or network reasons, the script still writes the manifest and reports failures.
- You can override the fixture root with `BORD_FIXTURE_ROOT`.
- Media capture defaults to mixed mode (`BORD_CAPTURE_MODE=mixed`) so README images keep context while closeups stay readable.
