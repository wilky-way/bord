# Skill: bord-fixture-lab

Set up a deterministic Bord demo and QA environment using real Claude/Codex session data.

## Use When

- You need repeatable demo data for docs/screenshots
- You want realistic git states for git panel QA
- You want session lists populated from real CLI history

## Commands

```bash
bun run fixtures:setup
bun run fixtures:register
```

## Expected Outputs

- Fixture repos at `~/Developer/bord-fixtures`
- Manifest at `~/Developer/bord-fixtures/fixture-manifest.json`
- Bord workspace entries: `fixture-web`, `fixture-api`, `fixture-docker`, `fixture-ui`, `fixture-docs`

## Verification

1. Open Bord and confirm fixture workspaces are listed.
2. Open `fixture-web` and verify mixed git status.
3. Open Claude/Codex session tabs and verify seeded sessions appear.

## Cleanup

```bash
bun run fixtures:cleanup
```
