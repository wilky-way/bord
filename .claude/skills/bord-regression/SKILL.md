# Skill: bord-regression

Run a full Bord regression pass with fixture data, media capture, and evidence logging.

## Use When

- Before shipping feature work
- Before updating README/roadmap screenshots
- During QA sweeps for workspace/session/git/docker flows

## Workflow

1. Reset runtime and sync branch:

```bash
# Stop old dev processes (if running)
lsof -tiTCP:1420 -sTCP:LISTEN | xargs kill 2>/dev/null || true
lsof -tiTCP:4200 -sTCP:LISTEN | xargs kill 2>/dev/null || true

git checkout main
git pull --ff-only
```

2. Start app:

```bash
bun run dev
```

3. Ensure fixtures + workspaces are ready:

```bash
bun run fixtures:setup
bun run fixtures:register
```

4. Run automated regression:

```bash
bun run test:unit
bun run test:e2e
```

5. (Optional) Capture media artifacts:

```bash
bun run qa:capture-media
```

6. Execute manual matrix for any unautomated edge cases:

```text
docs/testing/manual-matrix.md
```

7. Record outcomes:

```text
docs/testing/evidence.md
```

## Artifacts

- Screenshots/videos in `docs/media/`
- Pass/fail notes in `docs/testing/evidence.md`
- Automated baseline in terminal output (`bun run test:unit`, `bun run test:e2e`)
