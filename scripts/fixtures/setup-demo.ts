import { existsSync } from "fs";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "fs/promises";
import { homedir } from "os";
import { dirname, join } from "path";
import { randomUUID } from "crypto";
import { spawnSync } from "child_process";

type Provider = "claude" | "codex";

interface WorkspaceFixture {
  name: string;
  path: string;
  notes: string;
}

interface SessionSeed {
  provider: Provider;
  cwd: string;
  prompt: string;
  token: string;
  sessionId?: string;
}

interface ClaudeIndexEntry {
  sessionId: string;
  summary?: string;
  firstPrompt?: string;
  messageCount?: number;
  created?: string;
  modified?: string;
  projectPath?: string;
  lastUpdated?: string;
}

interface CommandOptions {
  cwd?: string;
  timeout?: number;
  allowFailure?: boolean;
}

const FIXTURE_ROOT = process.env.BORD_FIXTURE_ROOT ?? join(homedir(), "Developer", "bord-fixtures");
const DEFAULT_TIMEOUT = 180_000;

function run(cmd: string[], opts: CommandOptions = {}) {
  const result = spawnSync(cmd[0], cmd.slice(1), {
    cwd: opts.cwd,
    encoding: "utf8",
    timeout: opts.timeout ?? DEFAULT_TIMEOUT,
  });

  const stdout = (result.stdout ?? "").trim();
  const stderr = (result.stderr ?? "").trim();
  const exitCode = result.status ?? 1;

  if (result.error && !opts.allowFailure) {
    throw result.error;
  }

  if (exitCode !== 0 && !opts.allowFailure) {
    throw new Error(
      [
        `Command failed (${exitCode}): ${cmd.join(" ")}`,
        stdout ? `stdout: ${stdout}` : "",
        stderr ? `stderr: ${stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return { exitCode, stdout, stderr };
}

function ensureSafeRoot(root: string) {
  if (!root.includes("bord-fixtures")) {
    throw new Error(`Refusing to modify non-fixture path: ${root}`);
  }

  const home = homedir();
  const blocked = new Set(["/", home, join(home, "Developer")]);
  if (blocked.has(root)) {
    throw new Error(`Refusing to modify unsafe path: ${root}`);
  }
}

async function write(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

function git(repo: string, args: string[], opts: CommandOptions = {}) {
  return run(["git", "-C", repo, ...args], opts);
}

function gitCommit(repo: string, message: string) {
  run([
    "git",
    "-C",
    repo,
    "-c",
    "user.name=Bord Fixtures",
    "-c",
    "user.email=bord-fixtures@example.com",
    "commit",
    "-m",
    message,
  ]);
}

async function walkFiles(root: string, suffix: string): Promise<string[]> {
  if (!existsSync(root)) return [];

  const paths: string[] = [];

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (entry.name.endsWith(suffix)) paths.push(full);
    }
  }

  await walk(root);
  return paths;
}

function hasCommand(name: string) {
  return run(["which", name], { allowFailure: true }).exitCode === 0;
}

function claudeProjectDirName(path: string) {
  return path.replace(/\//g, "-");
}

async function writeClaudeIndex(projectsDir: string, seed: SessionSeed) {
  if (seed.provider !== "claude" || !seed.sessionId) return;

  const projectDir = join(projectsDir, claudeProjectDirName(seed.cwd));
  if (!existsSync(projectDir)) return;

  const indexPath = join(projectDir, "sessions-index.json");
  const currentRaw = await readFile(indexPath, "utf-8").catch(() => "");

  let entries: ClaudeIndexEntry[] = [];
  if (currentRaw) {
    try {
      const parsed = JSON.parse(currentRaw);
      if (Array.isArray(parsed)) {
        entries = parsed;
      } else if (Array.isArray(parsed?.entries)) {
        entries = parsed.entries;
      } else if (parsed && typeof parsed === "object") {
        entries = Object.entries(parsed).map(([sessionId, value]) => ({
          sessionId,
          ...(typeof value === "object" && value ? (value as Record<string, unknown>) : {}),
        })) as ClaudeIndexEntry[];
      }
    } catch {
      entries = [];
    }
  }

  const sessionFile = join(projectDir, `${seed.sessionId}.jsonl`);
  const times = await stat(sessionFile).catch(() => null);
  const now = new Date().toISOString();

  const updated: ClaudeIndexEntry = {
    sessionId: seed.sessionId,
    summary: seed.token,
    firstPrompt: seed.prompt,
    messageCount: 3,
    created: times?.birthtime.toISOString() ?? now,
    modified: times?.mtime.toISOString() ?? now,
    lastUpdated: times?.mtime.toISOString() ?? now,
    projectPath: seed.cwd,
  };

  const merged = entries.filter((entry) => entry.sessionId !== seed.sessionId);
  merged.push(updated);
  merged.sort((a, b) => (b.modified ?? "").localeCompare(a.modified ?? ""));

  await write(indexPath, JSON.stringify({ version: 1, entries: merged }, null, 2) + "\n");
}

async function initRepo(repo: string, files: Record<string, string>, message: string) {
  await mkdir(repo, { recursive: true });
  for (const [relative, content] of Object.entries(files)) {
    await write(join(repo, relative), content);
  }
  git(repo, ["init", "-b", "main"]);
  git(repo, ["add", "."]);
  gitCommit(repo, message);
}

async function seedSessions(seeds: SessionSeed[]) {
  const claudeDir = join(homedir(), ".claude", "projects");
  const codexDir = join(homedir(), ".codex", "sessions");

  const beforeClaude = new Set(await walkFiles(claudeDir, ".jsonl"));
  const beforeCodex = new Set(await walkFiles(codexDir, ".jsonl"));

  const failures: { provider: Provider; cwd: string; error: string }[] = [];

  for (const seed of seeds) {
    try {
      if (seed.provider === "claude") {
        const sessionId = seed.sessionId ?? randomUUID();
        run(["claude", "--session-id", sessionId, "-p", seed.prompt], {
          cwd: seed.cwd,
          timeout: 300_000,
        });
        await writeClaudeIndex(claudeDir, { ...seed, sessionId });
      }

      if (seed.provider === "codex") {
        run(["codex", "exec", "-C", seed.cwd, seed.prompt], {
          cwd: seed.cwd,
          timeout: 300_000,
        });
      }
    } catch (error) {
      failures.push({
        provider: seed.provider,
        cwd: seed.cwd,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const afterClaude = await walkFiles(claudeDir, ".jsonl");
  const afterCodex = await walkFiles(codexDir, ".jsonl");

  return {
    claudeNewFiles: afterClaude.filter((path) => !beforeClaude.has(path)).sort(),
    codexNewFiles: afterCodex.filter((path) => !beforeCodex.has(path)).sort(),
    failures,
  };
}

async function main() {
  ensureSafeRoot(FIXTURE_ROOT);

  const labRoot = join(FIXTURE_ROOT, "mono-hub");
  const appWeb = join(labRoot, "app-web");
  const appApi = join(labRoot, "app-api");
  const infraDocker = join(FIXTURE_ROOT, "infra-docker");
  const playgroundUi = join(FIXTURE_ROOT, "playground-ui");
  const docsLab = join(FIXTURE_ROOT, "docs-lab");
  const remotesRoot = join(FIXTURE_ROOT, "remotes");
  const appWebRemote = join(remotesRoot, "app-web.git");

  console.log(`Preparing fixture root: ${FIXTURE_ROOT}`);

  if (existsSync(FIXTURE_ROOT)) {
    await rm(FIXTURE_ROOT, { recursive: true, force: true });
  }
  await mkdir(FIXTURE_ROOT, { recursive: true });

  const appWebReadme = [
    "# fixture-web",
    "",
    "> Snapshot repo used for Bord file-tree and markdown preview captures.",
    "",
    "## Preview Checklist",
    "- [x] Bullets and task items",
    "- [x] Blockquote callout",
    "- [x] Code fences (bash + ts)",
    "- [x] Mermaid flowchart",
    "- [x] Compact status table",
    "",
    "## Quick Commands",
    "```bash",
    "bun install",
    "bun run dev",
    "bun run test:unit",
    "```",
    "",
    "## Layout Contract",
    "```ts",
    "export type Density = \"1x\" | \"2x\" | \"3x\" | \"4x\";",
    "export interface TileLayout { density: Density; scrollSnap: boolean; }",
    "```",
    "",
    "## Session Flow",
    "```mermaid",
    "flowchart LR",
    "  Sidebar --> Sessions",
    "  Sessions --> Terminal",
    "  Terminal --> GitPanel",
    "  GitPanel --> Commit",
    "```",
    "",
    "| Surface | Owner | Status |",
    "| --- | --- | --- |",
    "| Minimap | frontend | ready |",
    "| Git overlay | platform | ready |",
    "| Docker panel | ops | demo |",
    "",
    "> Keep captures dense, legible, and intentionally framed.",
    "",
  ].join("\n");

  const appWebShowcaseMarkdown = [
    "# Markdown Preview Showcase",
    "",
    "This file intentionally exercises the markdown viewer with mixed content blocks.",
    "",
    "> Goal: include diagrams, quotes, bullets, snippets, and tables in one viewport.",
    "",
    "## Deployment Steps",
    "1. Select `fixture-web` workspace",
    "2. Open file tree",
    "3. Double-click this file",
    "4. Toggle **Preview** mode",
    "",
    "### Feature Flags",
    "- `terminal.replay.sync=true`",
    "- `capture.profile=mixed`",
    "- `icons.pack=catppuccin`",
    "",
    "### Shell Snippet",
    "```bash",
    "bun run fixtures:setup",
    "bun run fixtures:register",
    "bun run qa:capture-media:parallel",
    "```",
    "",
    "### TypeScript Snippet",
    "```ts",
    "interface CapturePlan {",
    "  mode: \"mixed\" | \"closeup\" | \"context\";",
    "  tabs: 1 | 2 | 3 | 4;",
    "  includeHorizontalScroll: boolean;",
    "}",
    "```",
    "",
    "### Capture Orchestration",
    "```mermaid",
    "flowchart TD",
    "  Setup[fixtures:setup] --> Register[fixtures:register]",
    "  Register --> Parallel[qa:capture-media:parallel]",
    "  Parallel --> Media[showcase-workflow.gif]",
    "  Parallel --> Scroll[horizontal-scroll-1x.gif]",
    "```",
    "",
    "| Artifact | Purpose |",
    "| --- | --- |",
    "| `showcase-workflow.gif` | README hero demo |",
    "| `file-viewer-markdown-preview.png` | markdown renderer proof |",
    "| `sidebar-file-tree.png` | icon + hierarchy proof |",
    "",
  ].join("\n");

  await initRepo(
    labRoot,
    {
      "README.md": "# Bord Fixture Mono Hub\n\nParent repo used to exercise git parent/sibling discovery.\n",
      ".gitignore": "app-web/\napp-api/\n",
    },
    "chore: initialize mono hub fixture",
  );

  await initRepo(
    appWeb,
    {
      "README.md": appWebReadme,
      "package.json": '{"name":"fixture-web","private":true,"version":"0.0.1"}\n',
      "tsconfig.json": '{"compilerOptions":{"target":"ES2022","module":"ESNext","strict":true},"include":["src"]}\n',
      "vite.config.ts": "export default { server: { host: true, port: 4173 } };\n",
      ".gitignore": "dist/\ncoverage/\n",
      ".env.example": "BORD_CAPTURE_MODE=mixed\nBORD_ENABLE_GIT=true\n",
      "src/layout.ts": "export const densityMode = \"balanced\";\n",
      "src/panel.ts": "export function panelTitle(id: string) { return `terminal-${id}`; }\n",
      "src/theme.css": ":root { --panel-gap: 12px; }\n",
      "src/main.ts": [
        "import { renderWorkspaceList } from \"./components/sidebar/workspace-list\";",
        "import { panelTitle } from \"./panel\";",
        "",
        "export function bootstrap() {",
        "  return { title: panelTitle(\"01\"), sidebar: renderWorkspaceList([\"fixture-web\", \"fixture-api\"]) };",
        "}",
        "",
      ].join("\n"),
      "src/components/sidebar/workspace-list.tsx": [
        "export function renderWorkspaceList(names: string[]) {",
        "  return names.map((name) => ({ name, pinned: name === \"fixture-web\" }));",
        "}",
        "",
      ].join("\n"),
      "src/components/terminal/terminal-tile.tsx": [
        "export function tileClass(density: \"1x\" | \"2x\" | \"3x\" | \"4x\") {",
        "  return `tile tile-${density}`;",
        "}",
        "",
      ].join("\n"),
      "src/components/git/changed-files.tsx": [
        "export function changedFilesBadge(changed: number, staged: number) {",
        "  return `${changed} changed / ${staged} staged`;",
        "}",
        "",
      ].join("\n"),
      "src/lib/keys.ts": "export const HOTKEYS = [\"Meta+N\", \"Meta+G\", \"Meta+Shift+E\"];\n",
      "src/lib/paths.ts": "export function workspacePath(name: string) { return `/workspaces/${name}`; }\n",
      "src/hooks/useResize.ts": "export function useResize() { return { min: 320, max: 1920 }; }\n",
      "src/state/store.ts": "export const initialState = { tabs: 4, density: \"2x\" as const };\n",
      "docs/showcase-preview.md": appWebShowcaseMarkdown,
      "docs/architecture/terminal-flow.md": "# Terminal Flow\n\nTrack spawn -> stream -> replay paths.\n",
      "docs/notes/release-plan.md": "# Release Plan\n\n- tighten capture script\n- refresh gallery\n- verify readability\n",
      "scripts/dev-check.sh": "#!/usr/bin/env bash\nset -euo pipefail\nbun run test:unit\n",
      "public/images/hero.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"320\" height=\"160\"><rect width=\"320\" height=\"160\" fill=\"#1e1e2e\"/><text x=\"24\" y=\"86\" fill=\"#cdd6f4\" font-size=\"20\">fixture-web</text></svg>\n",
      "public/images/mock-preview.png": "PNG_PLACEHOLDER\n",
      "tests/layout.spec.ts": [
        "import { describe, expect, test } from \"bun:test\";",
        "import { panelTitle } from \"../src/panel\";",
        "",
        "describe(\"panelTitle\", () => {",
        "  test(\"prefixes terminal id\", () => {",
        "    expect(panelTitle(\"a1\")).toContain(\"terminal\");",
        "  });",
        "});",
        "",
      ].join("\n"),
    },
    "feat: scaffold fixture web app",
  );

  await mkdir(remotesRoot, { recursive: true });
  run(["git", "init", "--bare", appWebRemote]);
  git(appWeb, ["remote", "add", "origin", appWebRemote]);
  git(appWeb, ["push", "-u", "origin", "main"]);
  git(appWeb, ["checkout", "-b", "feature/layout-density"]);
  git(appWeb, ["push", "-u", "origin", "feature/layout-density"]);

  await write(join(appWeb, "src/layout.ts"), "export const densityMode = \"focus\";\n");
  git(appWeb, ["add", "src/layout.ts"]);
  gitCommit(appWeb, "feat: tune density defaults for fixture flow");

  await write(join(appWeb, "src/theme.css"), ":root { --panel-gap: 16px; --panel-radius: 14px; }\n");
  git(appWeb, ["add", "src/theme.css"]);
  await write(join(appWeb, "src/panel.ts"), "export function panelTitle(id: string) { return `workspace-tile-${id}`; }\n");
  await write(join(appWeb, "notes", "todo.md"), "- capture minimap hover states\n");

  await initRepo(
    appApi,
    {
      "README.md": "# fixture-api\n\nDemo backend repo for staged/unstaged git state.\n",
      "src/routes.ts": "export const routes = [\"/health\", \"/sessions\"];\n",
      "src/status.ts": "export const status = \"ok\";\n",
    },
    "feat: scaffold fixture api",
  );

  git(appApi, ["checkout", "-b", "feature/git-overlay"]);
  await write(join(appApi, "src/routes.ts"), "export const routes = [\"/health\", \"/sessions\", \"/git\"];\n");
  git(appApi, ["add", "src/routes.ts"]);
  await write(join(appApi, "README.md"), "# fixture-api\n\nDemo backend repo for staged/unstaged git state and diff previews.\n");
  await write(join(appApi, "docs", "notes.md"), "Remember to test commit + push from Bord git overlay.\n");

  await initRepo(
    infraDocker,
    {
      "README.md": "# fixture-docker\n\nDocker compose fixture for Bord sidebar controls.\n",
      "docker-compose.yml": [
        "services:",
        "  api:",
        "    image: nginx:alpine",
        "    ports:",
        "      - \"8088:80\"",
        "  worker:",
        "    image: alpine:3.20",
        "    command: [\"sh\", \"-c\", \"while true; do echo worker; sleep 30; done\"]",
        "",
      ].join("\n"),
      "compose.yaml": [
        "services:",
        "  cache:",
        "    image: redis:7-alpine",
        "",
      ].join("\n"),
    },
    "feat: add docker fixture compose files",
  );

  await write(
    join(infraDocker, "docker-compose.yml"),
    [
      "services:",
      "  api:",
      "    image: nginx:alpine",
      "    ports:",
      "      - \"8088:80\"",
      "    environment:",
      "      - FIXTURE=1",
      "  worker:",
      "    image: alpine:3.20",
      "    command: [\"sh\", \"-c\", \"while true; do echo worker; sleep 30; done\"]",
      "",
    ].join("\n"),
  );

  await initRepo(
    playgroundUi,
    {
      "README.md": "# fixture-ui\n\nClean repo used for workspace switching checks.\n",
      "src/app.ts": "export const app = \"fixture-ui\";\n",
    },
    "feat: create ui playground fixture",
  );

  await initRepo(
    docsLab,
    {
      "README.md": "# fixture-docs\n\nDocumentation sandbox workspace.\n",
      "guides/start.md": "# Start\n\nUse this repo for docs tile screenshots.\n",
    },
    "docs: create docs fixture repo",
  );

  const workspaces: WorkspaceFixture[] = [
    { name: "fixture-web", path: appWeb, notes: "ahead + staged + unstaged + untracked" },
    { name: "fixture-api", path: appApi, notes: "staged + unstaged + untracked" },
    { name: "fixture-docker", path: infraDocker, notes: "compose discovery + controls" },
    { name: "fixture-ui", path: playgroundUi, notes: "clean workspace baseline" },
    { name: "fixture-docs", path: docsLab, notes: "docs and navigation workspace" },
  ];

  const seeds: SessionSeed[] = [
    {
      provider: "claude",
      cwd: appWeb,
      token: "BFX_CLAUDE_WEB_A",
      sessionId: randomUUID(),
      prompt: "BFX_CLAUDE_WEB_A minimap hover behavior summary",
    },
    {
      provider: "claude",
      cwd: appWeb,
      token: "BFX_CLAUDE_WEB_B",
      sessionId: randomUUID(),
      prompt: "BFX_CLAUDE_WEB_B stash tray interaction recap",
    },
    {
      provider: "claude",
      cwd: appApi,
      token: "BFX_CLAUDE_API_A",
      sessionId: randomUUID(),
      prompt: "BFX_CLAUDE_API_A concise git commit suggestion",
    },
    {
      provider: "claude",
      cwd: infraDocker,
      token: "BFX_CLAUDE_DOCKER_A",
      sessionId: randomUUID(),
      prompt: "BFX_CLAUDE_DOCKER_A docker restart preflight checks",
    },
    {
      provider: "codex",
      cwd: appWeb,
      token: "BFX_CODEX_WEB_A",
      prompt: "BFX_CODEX_WEB_A one-line layout density guidance",
    },
    {
      provider: "codex",
      cwd: appWeb,
      token: "BFX_CODEX_WEB_B",
      prompt: "BFX_CODEX_WEB_B quick note on terminal minimap icons",
    },
    {
      provider: "codex",
      cwd: appApi,
      token: "BFX_CODEX_API_A",
      prompt: "BFX_CODEX_API_A staged versus unstaged review summary",
    },
    {
      provider: "codex",
      cwd: docsLab,
      token: "BFX_CODEX_DOCS_A",
      prompt: "BFX_CODEX_DOCS_A heading suggestion for Bord onboarding",
    },
  ];

  const missing: string[] = [];
  if (!hasCommand("claude")) missing.push("claude");
  if (!hasCommand("codex")) missing.push("codex");

  let seeded = {
    claudeNewFiles: [] as string[],
    codexNewFiles: [] as string[],
    failures: [] as { provider: Provider; cwd: string; error: string }[],
  };

  if (missing.length === 0) {
    console.log("Seeding real CLI sessions with claude and codex...");
    seeded = await seedSessions(seeds);
  } else {
    console.log(`Skipping session seeding. Missing command(s): ${missing.join(", ")}`);
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    fixtureRoot: FIXTURE_ROOT,
    parentRepo: labRoot,
    workspaces,
    repos: {
      appWeb: {
        path: appWeb,
        branch: git(appWeb, ["branch", "--show-current"]).stdout,
      },
      appApi: {
        path: appApi,
        branch: git(appApi, ["branch", "--show-current"]).stdout,
      },
      infraDocker: {
        path: infraDocker,
        branch: git(infraDocker, ["branch", "--show-current"]).stdout,
      },
      playgroundUi: {
        path: playgroundUi,
        branch: git(playgroundUi, ["branch", "--show-current"]).stdout,
      },
      docsLab: {
        path: docsLab,
        branch: git(docsLab, ["branch", "--show-current"]).stdout,
      },
    },
    seededSessions: {
      claudeRequestedSessionIds: seeds
        .filter((seed) => seed.provider === "claude" && seed.sessionId)
        .map((seed) => ({ cwd: seed.cwd, sessionId: seed.sessionId as string })),
      seedTokens: seeds.map((seed) => ({
        provider: seed.provider,
        cwd: seed.cwd,
        token: seed.token,
        sessionId: seed.sessionId ?? null,
      })),
      captureHints: {
        fixtureWeb: {
          claudeTokens: seeds
            .filter((seed) => seed.provider === "claude" && seed.cwd === appWeb)
            .map((seed) => seed.token),
          codexTokens: seeds
            .filter((seed) => seed.provider === "codex" && seed.cwd === appWeb)
            .map((seed) => seed.token),
        },
      },
      claudeNewFiles: seeded.claudeNewFiles,
      codexNewFiles: seeded.codexNewFiles,
      failures: seeded.failures,
    },
  };

  await write(join(FIXTURE_ROOT, "fixture-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log("Fixture setup complete.");
  console.log(`Manifest: ${join(FIXTURE_ROOT, "fixture-manifest.json")}`);
  console.log("Workspace paths:");
  for (const workspace of workspaces) {
    console.log(`- ${workspace.name}: ${workspace.path}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
