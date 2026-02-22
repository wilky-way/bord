# Skill: bord-regression

Run a full Bord regression pass with fixture data, media capture, and evidence logging.

## Use When

- Before shipping feature work
- Before updating README/roadmap screenshots
- During QA sweeps for workspace/session/git/docker flows

## Workflow

1. Start app:

```bash
bun run dev
```

2. Ensure fixtures + workspaces are ready:

```bash
bun run scripts/fixtures/setup-demo.ts
bun run scripts/fixtures/register-workspaces.ts
```

3. Capture media artifacts:

```bash
bun run scripts/qa/capture-media.ts
```

4. Execute manual matrix:

```text
docs/testing/manual-matrix.md
```

5. Record outcomes:

```text
docs/testing/evidence.md
```

## Artifacts

- Screenshots/videos in `docs/media/`
- Pass/fail notes in `docs/testing/evidence.md`
