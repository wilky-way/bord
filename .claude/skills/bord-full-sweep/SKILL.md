# Skill: bord-full-sweep

Run a full pre-release Bord sweep: reset runtime, sync main, execute automated tests, and do an interactive pass.

## Use When

- You need high confidence before shipping
- Settings/feature-flag behavior changed
- README/docs are being refreshed with current app behavior

## Workflow

1. Kill any existing dev listeners and sync branch:

```bash
lsof -tiTCP:1420 -sTCP:LISTEN | xargs kill 2>/dev/null || true
lsof -tiTCP:4200 -sTCP:LISTEN | xargs kill 2>/dev/null || true
git checkout main
git pull --ff-only
```

2. Start app and validate health:

```bash
bun run dev
# Verify http://localhost:4200/api/health is OK
```

3. Prepare fixtures:

```bash
bun run fixtures:setup
bun run fixtures:register
```

4. Run automated gates:

```bash
bun run test:unit
bun run test:e2e
```

5. Run focused manual checks with `agent-browser`:

- Top bar: density, minimap, add terminal, mute
- Sidebar: workspace switching, sessions/providers, docker, files
- Settings: Appearance, Notifications, Features, About/update checks
- Terminal card: stash/unstash, git panel toggle, file tree toggle

6. Record evidence:

- Update `docs/testing/evidence.md`
- If docs screenshots changed, run: `bun run qa:capture-media`

## Exit Criteria

- Unit suite passes
- E2E suite passes
- No blockers in manual matrix (`docs/testing/manual-matrix.md`)
- Evidence log updated
