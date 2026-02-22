import { mkdir, readFile, readdir, rename, rm } from "fs/promises";
import { spawnSync } from "child_process";
import { homedir } from "os";
import { join } from "path";

interface WorkspaceFixture {
  name: string;
  path: string;
  notes: string;
}

interface SeedToken {
  provider: string;
  cwd: string;
  token: string;
  sessionId: string | null;
}

interface Manifest {
  fixtureRoot: string;
  workspaces: WorkspaceFixture[];
  seededSessions?: {
    seedTokens?: SeedToken[];
    captureHints?: {
      fixtureWeb?: {
        claudeTokens?: string[];
        codexTokens?: string[];
      };
    };
  };
}

interface RunOptions {
  allowFailure?: boolean;
  silent?: boolean;
  timeout?: number;
}

const repoRoot = process.cwd();
const mediaDir = join(repoRoot, "docs", "media");
const fixtureRoot = process.env.BORD_FIXTURE_ROOT ?? join(homedir(), "Developer", "bord-fixtures");
const manifestPath = join(fixtureRoot, "fixture-manifest.json");
const appUrl = process.env.BORD_APP_URL ?? "http://localhost:1420";
const session = process.env.AGENT_BROWSER_SESSION ?? `bord-media-${Date.now()}`;

function stripAnsi(value: string) {
  return value.replace(/\x1B\[[0-9;]*m/g, "");
}

function run(cmd: string[], opts: RunOptions = {}) {
  const result = spawnSync(cmd[0], cmd.slice(1), {
    encoding: "utf8",
    timeout: opts.timeout ?? 120_000,
  });

  const stdout = stripAnsi((result.stdout ?? "").trim());
  const stderr = stripAnsi((result.stderr ?? "").trim());
  const exitCode = result.status ?? 1;

  if (!opts.silent) {
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  }

  if (result.error && !opts.allowFailure) throw result.error;
  if (exitCode !== 0 && !opts.allowFailure) {
    throw new Error(`Command failed (${exitCode}): ${cmd.join(" ")}`);
  }

  return { exitCode, stdout, stderr };
}

function browser(args: string[], opts: RunOptions = {}) {
  return run(["agent-browser", "--session", session, ...args], opts);
}

function wait(ms: number) {
  browser(["wait", String(ms)], { allowFailure: true, silent: true });
}

function snapshotCompact() {
  return browser(["snapshot", "-c"], { allowFailure: true, silent: true }).stdout;
}

function hasText(text: string) {
  return snapshotCompact().includes(text);
}

function screenshot(name: string) {
  browser(["screenshot", join(mediaDir, name)]);
}

function screenshotAbsolute(path: string) {
  browser(["screenshot", path]);
}

function clickText(value: string, exact = false, allowFailure = false) {
  const args = ["find", "text", value, "click"];
  if (exact) args.push("--exact");
  return browser(args, { allowFailure, silent: allowFailure });
}

function clickButton(name: string, allowFailure = false) {
  return browser(["find", "role", "button", "click", "--name", name], {
    allowFailure,
    silent: allowFailure,
  });
}

function press(key: string, allowFailure = false) {
  return browser(["press", key], { allowFailure, silent: allowFailure });
}

function evalJs(script: string, allowFailure = false) {
  return browser(["eval", script], { allowFailure, silent: allowFailure }).stdout;
}

function extractFirstInt(value: string) {
  const match = value.match(/-?\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function visibleTerminalCount() {
  const out = evalJs("document.querySelectorAll('[data-titlebar]').length", true);
  return extractFirstInt(out);
}

async function verifyApp() {
  const health = await fetch("http://localhost:4200/api/health").catch(() => null);
  if (!health || !health.ok) {
    throw new Error("Bord server is not reachable at http://localhost:4200. Start `bun run dev` first.");
  }
}

function sidebarExpanded() {
  const result = evalJs(
    "(() => !!document.querySelector('[data-bord-sidebar-panel=\"expanded\"]'))()",
    true,
  ).trim();
  return result.includes("true");
}

function sidebarFlyoutVisible() {
  const result = evalJs(
    "(() => { const flyout = document.querySelector('[data-bord-sidebar-flyout]'); if (!(flyout instanceof HTMLElement)) return false; const style = window.getComputedStyle(flyout); return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'; })()",
    true,
  ).trim();
  return result.includes("true");
}

function toggleSidebar() {
  evalJs(
    "(() => { const rail = document.querySelector('[data-bord-sidebar-rail]'); if (!(rail instanceof HTMLElement)) return 'missing'; const button = rail.querySelector('button'); if (!(button instanceof HTMLElement)) return 'missing'; button.click(); return 'clicked'; })()",
    true,
  );
  wait(450);
}

function ensureSidebarExpanded() {
  if (sidebarExpanded()) return;
  toggleSidebar();
  wait(450);
}

function ensureSidebarCollapsed() {
  if (!sidebarExpanded()) return;
  toggleSidebar();
  wait(450);
}

function ensureSidebarFlyoutVisible() {
  ensureSidebarCollapsed();
  if (sidebarFlyoutVisible()) return;

  const coords = evalJs(
    "(() => { const rail = document.querySelector('[data-bord-sidebar-rail]'); if (!(rail instanceof HTMLElement)) return ''; const toggle = rail.querySelector('button'); if (!(toggle instanceof HTMLElement)) return ''; const rect = toggle.getBoundingClientRect(); return `${Math.round(rect.left + rect.width / 2)},${Math.round(rect.top + rect.height / 2)}`; })()",
    true,
  ).trim();

  const [x, y] = coords.split(",").map((part) => parseInt(part, 10));
  if (Number.isFinite(x) && Number.isFinite(y)) {
    browser(["mouse", "move", String(x), String(y)], { allowFailure: true, silent: true });
  }

  wait(260);
}

function moveMouseToMainArea() {
  browser(["mouse", "move", "1460", "220"], { allowFailure: true, silent: true });
  wait(260);
}

function hoverExpandedWorkspacePreview(name: string) {
  ensureSidebarExpanded();

  const coords = evalJs(
    `(() => { const buttons = [...document.querySelectorAll('[data-bord-sidebar-rail] button[title]')]; const target = buttons.find((button) => (button.getAttribute('title') || '').trim() === ${JSON.stringify(name)}); if (!(target instanceof HTMLElement)) return ''; const rect = target.getBoundingClientRect(); target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); return String(Math.round(rect.left + rect.width / 2)) + ',' + String(Math.round(rect.top + rect.height / 2)); })()`,
    true,
  ).trim();

  const [x, y] = coords.split(",").map((part) => parseInt(part, 10));
  if (Number.isFinite(x) && Number.isFinite(y)) {
    browser(["mouse", "move", String(x), String(y)], { allowFailure: true, silent: true });
  }

  wait(320);
}

function clickPreviewTab(tab: "sessions" | "all" | "active" | "stashed") {
  evalJs(
    `(() => { const buttons = [...document.querySelectorAll('[data-preview-tab=\"${tab}\"]')].filter((el) => el instanceof HTMLElement && el.getClientRects().length > 0); const button = buttons[0]; if (!(button instanceof HTMLElement)) return 'missing'; button.click(); return 'ok'; })()`,
    true,
  );
  wait(260);
}

function openEditorDropdown() {
  evalJs(
    "(() => { const buttons = [...document.querySelectorAll('button[title=\"Choose editor\"]')].filter((el) => el instanceof HTMLElement && el.getClientRects().length > 0); const button = buttons[0]; if (!(button instanceof HTMLElement)) return 'missing'; button.click(); return 'ok'; })()",
    true,
  );
  wait(280);
}

function ensureSectionExpanded(header: string, marker: string) {
  if (hasText(marker)) return;

  for (let i = 0; i < 3; i++) {
    clickButton(header, true);
    wait(350);
    if (hasText(marker)) return;
  }
}

function selectWorkspace(name: string) {
  evalJs(
    `(() => { const buttons = [...document.querySelectorAll('[data-bord-sidebar-rail] button[title]')]; const target = buttons.find((button) => (button.getAttribute('title') || '').trim() === ${JSON.stringify(name)}); if (!(target instanceof HTMLElement)) return 'missing'; target.click(); return 'ok'; })()`,
    true,
  );
  wait(700);

  ensureSidebarExpanded();

  if (!hasText(name) && !hasText("Refresh")) {
    clickText(name, false, true);
    wait(700);
  }
}

function ensureProvider(provider: "Claude" | "Codex") {
  clickButton(provider, true);
  wait(600);
}

function refreshSessions() {
  clickButton("Refresh", true);
  wait(900);
}

function openSessionByToken(token: string) {
  clickText(token, false, true);
  wait(700);
}

function ensureVisibleTerminalCount(target: number) {
  for (let i = 0; i < 10; i++) {
    const count = visibleTerminalCount();
    if (count >= target) return;
    clickButton("Add terminal", true);
    wait(350);
  }
}

function revealMinimapProviderTooltip() {
  const coords = evalJs(
    "(() => { const groups = [...document.querySelectorAll('div.group')].filter((group) => group.querySelector('button.h-2.rounded-sm') && group.querySelector('div.absolute.top-full')); if (!groups.length) return ''; const group = groups[0]; const target = group.querySelector('button.h-2.rounded-sm'); if (!(target instanceof HTMLElement)) return ''; const tip = group.querySelector('div.absolute.top-full'); if (tip instanceof HTMLElement) { tip.classList.remove('hidden'); tip.classList.add('flex'); tip.style.display = 'flex'; tip.style.opacity = '1'; tip.style.visibility = 'visible'; tip.style.zIndex = '9999'; } const rect = target.getBoundingClientRect(); target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); return `${Math.round(rect.left + rect.width / 2)},${Math.round(rect.top + rect.height / 2)}`; })()",
    true,
  ).trim();

  const [x, y] = coords.split(",").map((part) => parseInt(part, 10));
  if (Number.isFinite(x) && Number.isFinite(y)) {
    browser(["mouse", "move", String(x), String(y)], { allowFailure: true, silent: true });
  }

  for (let i = 0; i < 3; i++) {
    if (minimapTooltipVisible()) break;
    evalJs(
      "(() => { const groups = [...document.querySelectorAll('div.group')].filter((group) => group.querySelector('button.h-2.rounded-sm') && group.querySelector('div.absolute.top-full')); if (!groups.length) return 'missing'; const tip = groups[0].querySelector('div.absolute.top-full'); if (!(tip instanceof HTMLElement)) return 'missing'; tip.classList.remove('hidden'); tip.classList.add('flex'); tip.style.display = 'flex'; tip.style.visibility = 'visible'; tip.style.opacity = '1'; return 'ok'; })()",
      true,
    );
    wait(120);
  }

  wait(200);
}

function openGitDiff() {
  press("Meta+g", true);
  wait(900);

  const candidates = ["src/panel.ts", "src/theme.css", "src/layout.ts", "notes/todo.md"];
  for (const file of candidates) {
    clickText(file, false, true);
    wait(600);
  }
}

function closeGitPanel() {
  press("Meta+g", true);
  wait(500);
}

function stashPopoverVisible() {
  const result = evalJs(
    "(() => [...document.querySelectorAll('[data-stash-zone]')].some((el) => { const cls = typeof el.className === 'string' ? el.className : ''; return cls.includes('absolute') && cls.includes('top-full') && cls.includes('shadow-lg'); }))()",
    true,
  ).trim();
  return result.includes("true");
}

function minimapTooltipVisible() {
  const result = evalJs(
    "(() => [...document.querySelectorAll('div.group div.absolute.top-full')].some((el) => { if (!(el instanceof HTMLElement)) return false; const style = window.getComputedStyle(el); return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'; }))()",
    true,
  ).trim();
  return result.includes("true");
}

function stashOneTerminalAndOpenTray() {
  browser(["click", "button[title=\"Stash terminal\"]"], { allowFailure: true, silent: true });
  wait(350);

  for (let i = 0; i < 6; i++) {
    evalJs(
      "(() => { const old = document.querySelector('[data-bord-tray]'); if (old) old.removeAttribute('data-bord-tray'); const trays = [...document.querySelectorAll('[data-stash-tray-button]')].filter((el) => el instanceof HTMLElement && el.getClientRects().length > 0); const tray = trays[0]; if (!(tray instanceof HTMLElement)) return ''; tray.setAttribute('data-bord-tray', '1'); const rect = tray.getBoundingClientRect(); return `${Math.round(rect.left + rect.width / 2)},${Math.round(rect.top + rect.height / 2)}`; })()",
      true,
    );

    browser(["click", "[data-bord-tray='1']"], { allowFailure: true, silent: true });
    wait(420);
    if (stashPopoverVisible()) return;

    const coords = evalJs(
      "(() => { const tray = document.querySelector('[data-bord-tray=\\\"1\\\"]'); if (!tray) return ''; const rect = tray.getBoundingClientRect(); return `${Math.round(rect.left + rect.width / 2)},${Math.round(rect.top + rect.height / 2)}`; })()",
      true,
    ).trim();

    const [x, y] = coords.split(",").map((part) => parseInt(part, 10));
    if (Number.isFinite(x) && Number.isFinite(y)) {
      browser(["mouse", "move", String(x), String(y)], { allowFailure: true, silent: true });
      browser(["mouse", "down", "left"], { allowFailure: true, silent: true });
      browser(["mouse", "up", "left"], { allowFailure: true, silent: true });
      wait(420);
      if (stashPopoverVisible()) return;
    }
  }
}

function ensureDockerPanelVisible() {
  const markers = ["Start all services", "Pull latest images", "No compose files found", "Scanning..."];
  const hasMarker = () => markers.some((marker) => hasText(marker));

  if (hasMarker()) return;

  for (let i = 0; i < 6; i++) {
    evalJs(
      "(() => { const buttons = [...document.querySelectorAll('button')]; const docker = buttons.find((btn) => ((btn.textContent || '').trim() || '').startsWith('Docker')); if (!docker) return 'missing'; docker.click(); return 'clicked'; })()",
      true,
    );
    wait(900);
    if (hasMarker()) return;
  }
}

function horizontalScrollRight() {
  evalJs(
    "(() => { const container = [...document.querySelectorAll('div')].find((el) => typeof el.className === 'string' && el.className.includes('flex-nowrap') && el.className.includes('overflow-x-auto')); if (!container) return 'missing'; container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' }); return 'ok'; })()",
    true,
  );
}

function horizontalScrollLeft() {
  evalJs(
    "(() => { const container = [...document.querySelectorAll('div')].find((el) => typeof el.className === 'string' && el.className.includes('flex-nowrap') && el.className.includes('overflow-x-auto')); if (!container) return 'missing'; container.scrollTo({ left: 0, behavior: 'smooth' }); return 'ok'; })()",
    true,
  );
}

function clickLayoutPlusButton() {
  evalJs(
    "(() => { const button = document.querySelector('button[title=\"Add terminal\"]'); if (!button) return 'missing'; button.click(); return 'clicked'; })()",
    true,
  );
}

function clickProviderNewTerminal(provider: "Claude" | "Codex") {
  clickText(`+ New ${provider}`, false, true);
  wait(700);
}

function stashTerminalByProvider(provider: "claude" | "codex") {
  evalJs(
    `(() => { const panels = [...document.querySelectorAll('[data-terminal-id]')]; const panel = panels.find((el) => (el.getAttribute('data-provider') || '').toLowerCase() === '${provider}'); if (!(panel instanceof HTMLElement)) return 'missing'; panel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); const button = panel.querySelector('button[data-action="stash-terminal"]'); if (!(button instanceof HTMLElement)) return 'missing'; button.click(); return 'ok'; })()`,
    true,
  );
  wait(450);
}

function openWorkspaceStashTray() {
  for (let i = 0; i < 6; i++) {
    const clicked = evalJs(
      "(() => { const trays = [...document.querySelectorAll('[data-stash-tray-button]')].filter((el) => el instanceof HTMLElement && el.getClientRects().length > 0); const tray = trays[0]; if (!(tray instanceof HTMLElement)) return 'missing'; tray.click(); return 'ok'; })()",
      true,
    ).trim();
    wait(360);
    if (stashPopoverVisible()) return;
    if (clicked.includes("missing")) break;
  }
}

function unstashFirstStashedTerminal() {
  evalJs(
    "(() => { const buttons = [...document.querySelectorAll('[data-stash-zone] button')].filter((button) => (button.textContent || '').includes('↑ ')); if (!(buttons[0] instanceof HTMLElement)) return 'missing'; buttons[0].click(); return 'ok'; })()",
    true,
  );
  wait(520);
}

function closeExtraTerminals() {
  for (let i = 0; i < 14; i++) {
    const status = evalJs(
      "(() => { const panels = [...document.querySelectorAll('[data-terminal-id]')]; if (panels.length <= 2) return 'done'; const keep = new Set(['claude', 'codex']); const preferred = panels.find((panel) => !keep.has((panel.getAttribute('data-provider') || '').toLowerCase())); const target = preferred ?? panels[panels.length - 1]; if (!(target instanceof HTMLElement)) return 'missing'; const close = target.querySelector('button[data-action=\"close-terminal\"]'); if (!(close instanceof HTMLElement)) return 'missing'; close.click(); return 'closed'; })()",
      true,
    ).trim();

    if (status.includes("done")) break;
    wait(280);
  }
}

function closeAllVisibleTerminals() {
  for (let i = 0; i < 20; i++) {
    const status = evalJs(
      "(() => { const close = document.querySelector('button[data-action=\"close-terminal\"]'); if (!(close instanceof HTMLElement)) return 'done'; close.click(); return 'closed'; })()",
      true,
    ).trim();

    if (status.includes("done")) break;
    wait(220);
  }
}

function ensureMixedProviderTerminals(claudeTokens: string[], codexTokens: string[]) {
  ensureProvider("Claude");
  refreshSessions();
  openSessionByToken(claudeTokens[0]);
  if (claudeTokens[1]) openSessionByToken(claudeTokens[1]);

  ensureProvider("Codex");
  refreshSessions();
  openSessionByToken(codexTokens[0]);

  ensureVisibleTerminalCount(5);
  wait(900);
}

function ffmpegBinaryPath() {
  return process.env.BORD_FFMPEG_PATH ?? "ffmpeg";
}

async function buildWebmFromFrames(frameDir: string, outputPath: string, fps = 2) {
  const ffmpeg = ffmpegBinaryPath();

  const files = await readdir(frameDir).catch(() => [] as string[]);
  if (!files.length) {
    throw new Error("No showcase frames were captured");
  }

  run(
    [
      ffmpeg,
      "-y",
      "-framerate",
      String(fps),
      "-start_number",
      "1",
      "-i",
      join(frameDir, "frame-%03d.png"),
      "-c:v",
      "libvpx-vp9",
      "-crf",
      "30",
      "-b:v",
      "0",
      "-pix_fmt",
      "yuv420p",
      outputPath,
    ],
    { timeout: 120_000 },
  );
}

async function buildGifFromFrames(
  frameDir: string,
  outputPath: string,
  fps: number,
  startNumber: number,
  frameLimit: number,
) {
  const ffmpeg = ffmpegBinaryPath();
  const pattern = join(frameDir, "frame-%03d.png");

  run(
    [
      ffmpeg,
      "-y",
      "-framerate",
      String(fps),
      "-start_number",
      String(startNumber),
      "-i",
      pattern,
      "-frames:v",
      String(frameLimit),
      "-vf",
      "fps=10,scale=1320:-1:flags=lanczos",
      outputPath,
    ],
    { timeout: 120_000 },
  );
}

function openBrowser(url: string) {
  browser(["close"], { allowFailure: true, silent: true });
  const first = browser(["open", url], { allowFailure: true, silent: true });
  if (first.exitCode !== 0) {
    run(["agent-browser", "close"], { allowFailure: true, silent: true });
    wait(200);
    browser(["open", url]);
  }
}

function tokensFor(
  manifest: Manifest,
  workspacePath: string,
  provider: "claude" | "codex",
) {
  const hints = manifest.seededSessions?.captureHints?.fixtureWeb;

  if (provider === "claude" && hints?.claudeTokens?.length) {
    return hints.claudeTokens;
  }
  if (provider === "codex" && hints?.codexTokens?.length) {
    return hints.codexTokens;
  }

  return (manifest.seededSessions?.seedTokens ?? [])
    .filter((seed) => seed.provider === provider && seed.cwd === workspacePath)
    .map((seed) => seed.token);
}

async function main() {
  await verifyApp();
  await mkdir(mediaDir, { recursive: true });

  const manifestRaw = await readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw) as Manifest;

  const fixtureWeb = manifest.workspaces.find((workspace) => workspace.name === "fixture-web");
  const fixtureDocker = manifest.workspaces.find((workspace) => workspace.name === "fixture-docker");
  if (!fixtureWeb || !fixtureDocker) {
    throw new Error("Fixture workspaces missing from manifest. Run setup script first.");
  }

  const claudeTokens = tokensFor(manifest, fixtureWeb.path, "claude");
  const codexTokens = tokensFor(manifest, fixtureWeb.path, "codex");
  if (!claudeTokens.length || !codexTokens.length) {
    throw new Error("Missing capture tokens for fixture-web. Re-run fixture setup.");
  }
  const showcasePath = join(mediaDir, "showcase-workflow.webm");
  const showcaseGifPath = join(mediaDir, "showcase-workflow.gif");
  const showcaseTempPath = join(mediaDir, "showcase-workflow.tmp.webm");
  const showcaseGifTempPath = join(mediaDir, "showcase-workflow.tmp.gif");
  const frameDir = join(mediaDir, "_showcase_frames");

  try {
    openBrowser(appUrl);
    browser(["set", "viewport", "1720", "980"]);
    wait(1200);
    ensureSidebarExpanded();
    wait(250);

    screenshot("home-overview.png");

    selectWorkspace(fixtureWeb.name);
    ensureSectionExpanded("Sessions", "Refresh");

    ensureProvider("Claude");
    refreshSessions();

    ensureProvider("Codex");
    refreshSessions();

    ensureMixedProviderTerminals(claudeTokens, codexTokens);

    ensureSidebarCollapsed();
    moveMouseToMainArea();
    screenshot("sidebar-rail-counters.png");

    ensureSidebarExpanded();
    hoverExpandedWorkspacePreview(fixtureWeb.name);
    clickPreviewTab("all");
    screenshot("sidebar-hover-workspace-preview.png");
    clickPreviewTab("sessions");
    moveMouseToMainArea();

    ensureProvider("Claude");
    refreshSessions();
    screenshot("sessions-claude.png");

    ensureProvider("Codex");
    refreshSessions();
    screenshot("sessions-codex.png");

    screenshot("terminals-provider-icons.png");

    clickButton("1x", true);
    wait(700);
    screenshot("layout-1x.png");

    clickButton("4x", true);
    wait(700);
    screenshot("layout-4x.png");

    revealMinimapProviderTooltip();
    screenshot("minimap-hover-provider-tooltip.png");

    openGitDiff();
    screenshot("git-panel-diff-selected.png");
    closeGitPanel();

    stashOneTerminalAndOpenTray();
    screenshot("stash-sidebar-popover.png");

    selectWorkspace(fixtureDocker.name);
    ensureDockerPanelVisible();
    screenshot("docker-panel-expanded.png");

    selectWorkspace(fixtureWeb.name);
    ensureSidebarExpanded();
    openEditorDropdown();
    screenshot("open-in-editor-controls.png");
    evalJs("(() => { document.body.click(); return 'ok'; })()", true);
    wait(200);

    selectWorkspace(fixtureWeb.name);
    ensureSidebarExpanded();
    ensureSectionExpanded("Sessions", "Refresh");
    closeAllVisibleTerminals();
    wait(500);

    await rm(showcaseTempPath, { force: true });
    await rm(showcaseGifTempPath, { force: true });
    await rm(frameDir, { recursive: true, force: true });
    await mkdir(frameDir, { recursive: true });

    let frame = 1;
    const frameShot = () => {
      const name = `frame-${String(frame).padStart(3, "0")}.png`;
      screenshotAbsolute(join(frameDir, name));
      frame++;
    };

    const hold = (count: number, delay = 220) => {
      for (let i = 0; i < count; i++) {
        frameShot();
        wait(delay);
      }
    };

    // --- Showcase sequence: open sessions, explore features ---

    ensureProvider("Claude");
    refreshSessions();
    openSessionByToken(claudeTokens[0]);
    hold(4, 240);

    ensureProvider("Codex");
    refreshSessions();
    openSessionByToken(codexTokens[0]);
    hold(4, 240);

    // Minimap hover with provider tooltip
    revealMinimapProviderTooltip();
    hold(3, 200);
    moveMouseToMainArea();

    // Layout density cycling
    clickButton("4x", true);
    wait(400);
    hold(3, 200);

    clickButton("2x", true);
    wait(400);
    hold(3, 200);

    clickButton("1x", true);
    wait(500);
    hold(3, 200);

    // Scroll through terminals in 1x
    horizontalScrollRight();
    wait(900);
    hold(3, 200);

    horizontalScrollLeft();
    wait(900);
    hold(3, 200);

    // Back to multi-column
    clickButton("3x", true);
    wait(400);
    hold(3, 200);

    // Switch to Docker workspace, peek Docker panel
    selectWorkspace(fixtureDocker.name);
    ensureDockerPanelVisible();
    hold(4, 240);

    // Switch back
    selectWorkspace(fixtureWeb.name);
    hold(3, 220);

    // Workspace hover preview card
    hoverExpandedWorkspacePreview(fixtureWeb.name);
    clickPreviewTab("sessions");
    hold(3, 220);
    clickPreviewTab("all");
    hold(3, 220);
    clickPreviewTab("active");
    hold(3, 220);
    clickPreviewTab("stashed");
    hold(3, 220);
    moveMouseToMainArea();

    // New session + stash cycle
    ensureProvider("Claude");
    clickProviderNewTerminal("Claude");
    hold(3, 220);

    stashTerminalByProvider("claude");
    hold(3, 220);

    if (claudeTokens[1]) {
      ensureProvider("Claude");
      openSessionByToken(claudeTokens[1]);
      hold(4, 220);
    }

    // Collapsed flyout
    ensureSidebarFlyoutVisible();
    hold(3, 220);

    // Stash tray
    openWorkspaceStashTray();
    hold(4, 240);

    unstashFirstStashedTerminal();
    hold(3, 240);

    // Add terminal via + button
    clickLayoutPlusButton();
    wait(900);
    hold(3, 220);

    closeExtraTerminals();
    wait(560);
    hold(3, 220);

    // Multi-provider terminals side by side
    ensureProvider("Claude");
    openSessionByToken(claudeTokens[0]);
    wait(420);
    ensureProvider("Codex");
    openSessionByToken(codexTokens[0]);
    wait(420);
    hold(3, 220);

    // Git panel
    openGitDiff();
    hold(4, 240);

    const totalFrames = frame - 1;
    const preferredStart = 1;
    const preferredCount = 80;
    const gifStart = Math.max(1, Math.min(preferredStart, totalFrames));
    const gifCount = Math.max(1, Math.min(preferredCount, totalFrames - gifStart + 1));

    await buildWebmFromFrames(frameDir, showcaseTempPath, 3);
    await buildGifFromFrames(frameDir, showcaseGifTempPath, 3, gifStart, gifCount);
    await rename(showcaseTempPath, showcasePath);
    await rename(showcaseGifTempPath, showcaseGifPath);

    console.log(`Media capture complete: ${mediaDir}`);
  } finally {
    await rm(frameDir, { recursive: true, force: true });
    await rm(showcaseTempPath, { force: true });
    await rm(showcaseGifTempPath, { force: true });
    browser(["close"], { allowFailure: true, silent: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
