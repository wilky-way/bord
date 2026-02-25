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

type CaptureProfile = "context" | "closeup";
type CaptureMode = "mixed" | "context" | "closeup";

interface CaptureOptions {
  profile?: CaptureProfile;
  selector?: string;
  padding?: number;
  minWidth?: number;
  minHeight?: number;
  allowFlyout?: boolean;
  allowStash?: boolean;
  allowSettings?: boolean;
  allowMinimapTooltip?: boolean;
}

interface CaptureRect {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}

const repoRoot = process.cwd();
const mediaDir = join(repoRoot, "docs", "media");
const fixtureRoot = process.env.BORD_FIXTURE_ROOT ?? join(homedir(), "Developer", "bord-fixtures");
const manifestPath = join(fixtureRoot, "fixture-manifest.json");
const appUrl = process.env.BORD_APP_URL ?? "http://localhost:1420";
const session = process.env.AGENT_BROWSER_SESSION ?? `bord-media-${Date.now()}`;
const captureMode = (
  process.env.BORD_CAPTURE_MODE === "context" ||
  process.env.BORD_CAPTURE_MODE === "closeup" ||
  process.env.BORD_CAPTURE_MODE === "mixed"
    ? process.env.BORD_CAPTURE_MODE
    : "mixed"
) as CaptureMode;
const overlaySettleMs = 220;

function resolveProfile(profile?: CaptureProfile): CaptureProfile {
  if (captureMode === "context") return "context";
  if (captureMode === "closeup") return "closeup";
  return profile ?? "context";
}

function parseJson<T>(value: string): T | null {
  const raw = value.trim();
  if (!raw) return null;

  const normalize = (parsed: unknown): unknown => {
    if (typeof parsed !== "string") return parsed;
    const nested = parsed.trim();
    if (!nested) return parsed;
    if (!nested.startsWith("{") && !nested.startsWith("[")) return parsed;
    try {
      return JSON.parse(nested);
    } catch {
      return parsed;
    }
  };

  try {
    return normalize(JSON.parse(raw)) as T;
  } catch {
    try {
      const unquoted = raw.replace(/^"|"$/g, "").replace(/\\"/g, '"');
      return normalize(JSON.parse(unquoted)) as T;
    } catch {
      return null;
    }
  }
}

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

function settingsModalVisible() {
  const result = evalJs(
    "(() => { const modal = document.querySelector('.fixed.inset-0.z-50'); if (!(modal instanceof HTMLElement)) return false; const style = window.getComputedStyle(modal); return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'; })()",
    true,
  ).trim();
  return result.includes("true");
}

function hideMinimapTooltip() {
  evalJs(
    "(() => { const tips = [...document.querySelectorAll('div.group div.absolute')].filter((el) => el instanceof HTMLElement); for (const tip of tips) { tip.classList.add('hidden'); tip.classList.remove('flex'); tip.style.removeProperty('display'); tip.style.removeProperty('visibility'); tip.style.removeProperty('opacity'); tip.style.removeProperty('z-index'); } return 'ok'; })()",
    true,
  );
}

function closeEditorMenus() {
  evalJs(
    "(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })); return 'ok'; })()",
    true,
  );
}

function closeStashPopover() {
  if (!stashPopoverVisible()) return;

  for (let i = 0; i < 4; i++) {
    moveMouseToMainArea();
    closeEditorMenus();
    press("Escape", true);
    wait(overlaySettleMs);
    if (!stashPopoverVisible()) return;
  }
}

function hideSettingsModal() {
  if (!settingsModalVisible()) return;

  for (let i = 0; i < 4; i++) {
    press("Escape", true);
    wait(180);
    if (!settingsModalVisible()) return;

    evalJs(
      "(() => { const close = document.querySelector('.fixed.inset-0.z-50 button[title=\"Close\"]'); if (!(close instanceof HTMLElement)) return 'missing'; close.click(); return 'ok'; })()",
      true,
    );
    wait(180);
    if (!settingsModalVisible()) return;
  }
}

function clearTransientOverlays(options: CaptureOptions = {}) {
  moveMouseToMainArea();

  if (!options.allowFlyout) {
    dismissFlyout();
  }

  if (!options.allowMinimapTooltip) {
    hideMinimapTooltip();
  }

  if (!options.allowStash) {
    closeStashPopover();
  }

  closeEditorMenus();

  if (!options.allowSettings) {
    hideSettingsModal();
  }

  wait(overlaySettleMs);
}

function overlayState() {
  const raw = evalJs(
    "(() => { const styleVisible = (el) => { if (!(el instanceof HTMLElement)) return false; const style = window.getComputedStyle(el); return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'; }; const flyout = styleVisible(document.querySelector('[data-bord-sidebar-flyout]')); const stash = [...document.querySelectorAll('[data-stash-zone]')].some((el) => { if (!(el instanceof HTMLElement)) return false; const cls = typeof el.className === 'string' ? el.className : ''; return cls.includes('absolute') && cls.includes('top-full') && cls.includes('shadow-lg') && styleVisible(el); }); const settings = styleVisible(document.querySelector('.fixed.inset-0.z-50')); const minimapTip = [...document.querySelectorAll('div.group div.absolute')].some((el) => styleVisible(el)); return JSON.stringify({ flyout, stash, settings, minimapTip }); })()",
    true,
  );

  return parseJson<{ flyout: boolean; stash: boolean; settings: boolean; minimapTip: boolean }>(raw) ?? {
    flyout: false,
    stash: false,
    settings: false,
    minimapTip: false,
  };
}

function assertCaptureSurface(options: CaptureOptions = {}) {
  const state = overlayState();
  const blocking: string[] = [];

  if (state.flyout && !options.allowFlyout) blocking.push("sidebar flyout");
  if (state.stash && !options.allowStash) blocking.push("stash popover");
  if (state.settings && !options.allowSettings) blocking.push("settings modal");
  if (state.minimapTip && !options.allowMinimapTooltip) blocking.push("minimap tooltip");

  if (blocking.length) {
    throw new Error(`Capture blocked by unexpected overlay(s): ${blocking.join(", ")}`);
  }
}

function selectorRect(selector: string): CaptureRect | null {
  const raw = evalJs(
    `(() => {
      const styleVisible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const el = nodes.find((node) => styleVisible(node));
      if (!(el instanceof HTMLElement)) return '';
      const rect = el.getBoundingClientRect();
      return JSON.stringify({ x: rect.left, y: rect.top, width: rect.width, height: rect.height, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight });
    })()`,
    true,
  );

  return parseJson<CaptureRect>(raw);
}

function isValidRect(rect: CaptureRect | null): rect is CaptureRect {
  if (!rect) return false;

  const values = [
    Number(rect.x),
    Number(rect.y),
    Number(rect.width),
    Number(rect.height),
    Number(rect.viewportWidth),
    Number(rect.viewportHeight),
  ];

  return values.every((value) => Number.isFinite(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ensureSelectorVisible(selector: string, attempts = 8, delayMs = 180) {
  for (let i = 0; i < attempts; i++) {
    const rect = selectorRect(selector);
    if (isValidRect(rect)) return true;
    wait(delayMs);
  }
  return false;
}

function cropToRect(
  inputPath: string,
  outputPath: string,
  rect: CaptureRect,
  padding = 28,
  minWidth = 980,
  minHeight = 620,
) {
  const x = Number(rect.x);
  const y = Number(rect.y);
  const width = Number(rect.width);
  const height = Number(rect.height);
  const viewportWidth = Number(rect.viewportWidth);
  const viewportHeight = Number(rect.viewportHeight);

  const centerX = x + width / 2;
  const centerY = y + height / 2;

  const targetWidth = Math.min(
    viewportWidth,
    Math.max(Math.ceil(width + padding * 2), minWidth),
  );
  const targetHeight = Math.min(
    viewportHeight,
    Math.max(Math.ceil(height + padding * 2), minHeight),
  );

  const left = Math.round(clamp(centerX - targetWidth / 2, 0, viewportWidth - targetWidth));
  const top = Math.round(clamp(centerY - targetHeight / 2, 0, viewportHeight - targetHeight));
  const cropWidth = Math.round(targetWidth);
  const cropHeight = Math.round(targetHeight);

  run(
    [
      ffmpegBinaryPath(),
      "-y",
      "-i",
      inputPath,
      "-vf",
      `crop=${cropWidth}:${cropHeight}:${left}:${top}`,
      outputPath,
    ],
    { timeout: 90_000, silent: true },
  );
}

async function captureShot(name: string, options: CaptureOptions = {}) {
  clearTransientOverlays(options);
  assertCaptureSurface(options);

  const outputPath = join(mediaDir, name);
  const profile = resolveProfile(options.profile);

  if (profile === "closeup" && options.selector) {
    const tempPath = join(mediaDir, `_tmp-${name}`);
    screenshotAbsolute(tempPath);

    const rect = selectorRect(options.selector);
    if (isValidRect(rect)) {
      cropToRect(
        tempPath,
        outputPath,
        rect,
        options.padding,
        options.minWidth,
        options.minHeight,
      );
      await rm(tempPath, { force: true });
      return;
    }

    console.warn(`[capture] Fallback to full-frame for ${name}; selector did not resolve: ${options.selector}`);

    await rename(tempPath, outputPath);
    return;
  }

  screenshot(name);
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

/** Dismiss the workspace hover preview by calling the SolidJS signal setter directly. */
function dismissFlyout() {
  moveMouseToMainArea();
  evalJs(
    "(() => { if (typeof window.__dismissHoverPreview === 'function') { window.__dismissHoverPreview(); return 'dismissed'; } return 'no-hook'; })()",
    true,
  );
  wait(200);
}

/** Suppress the hover preview at the SolidJS signal level — blocks any future hover triggers. */
function suppressHoverPreview() {
  evalJs(
    "(() => { if (typeof window.__suppressHoverPreview === 'function') { window.__suppressHoverPreview(); return 'suppressed'; } return 'no-hook'; })()",
    true,
  );
  wait(100);
}

/** Restore hover preview after suppression. */
function restoreHoverPreview() {
  evalJs(
    "(() => { if (typeof window.__restoreHoverPreview === 'function') { window.__restoreHoverPreview(); return 'restored'; } return 'no-hook'; })()",
    true,
  );
  wait(100);
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

function openSettingsPanel() {
  if (settingsModalVisible()) return;

  evalJs(
    "(() => { const settingsButton = document.querySelector('button[title=\"Settings\"]'); if (!(settingsButton instanceof HTMLElement)) return 'missing'; settingsButton.click(); return 'ok'; })()",
    true,
  );
  wait(420);

  if (settingsModalVisible()) return;

  ensureSidebarExpanded();
  clickButton("Settings", true);
  wait(420);

  if (!settingsModalVisible()) {
    throw new Error("Failed to open settings panel for media capture");
  }
}

function switchSettingsSection(section: "Appearance" | "Notifications" | "Features" | "About") {
  if (!settingsModalVisible()) {
    throw new Error("Settings panel is not open");
  }

  evalJs(
    `(() => { const modal = document.querySelector('.fixed.inset-0.z-50'); if (!(modal instanceof HTMLElement)) return 'missing'; const buttons = [...modal.querySelectorAll('button')].filter((el) => (el.textContent || '').trim() === ${JSON.stringify(section)}); const button = buttons[0]; if (!(button instanceof HTMLElement)) return 'missing'; button.click(); return 'ok'; })()`,
    true,
  );
  wait(360);
}

function closeSettingsPanel() {
  hideSettingsModal();
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
  // Minimap buttons live inside div.relative.group in the TopBar (top < 50px).
  // Each group has a <button> and a tooltip <div class="absolute top-full ...hidden group-hover:flex">.
  // Old selectors used button.h-2.rounded-sm which no longer matches (now h-3.5 rounded).
  const FIND_GROUPS =
    "[...document.querySelectorAll('div.group')].filter((g) => g.getBoundingClientRect().top < 50 && g.querySelector('button') && g.querySelector('div.absolute'))";

  const coords = evalJs(
    `(() => { const groups = ${FIND_GROUPS}; if (!groups.length) return ''; const group = groups[0]; const target = group.querySelector('button'); if (!(target instanceof HTMLElement)) return ''; const tip = group.querySelector('div.absolute'); if (tip instanceof HTMLElement) { tip.classList.remove('hidden'); tip.classList.add('flex'); tip.style.display = 'flex'; tip.style.opacity = '1'; tip.style.visibility = 'visible'; tip.style.zIndex = '9999'; } const rect = target.getBoundingClientRect(); target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); return Math.round(rect.left + rect.width / 2) + ',' + Math.round(rect.top + rect.height / 2); })()`,
    true,
  ).trim();

  const [x, y] = coords.split(",").map((part) => parseInt(part, 10));
  if (Number.isFinite(x) && Number.isFinite(y)) {
    browser(["mouse", "move", String(x), String(y)], { allowFailure: true, silent: true });
  }

  for (let i = 0; i < 3; i++) {
    if (minimapTooltipVisible()) break;
    evalJs(
      `(() => { const groups = ${FIND_GROUPS}; if (!groups.length) return 'missing'; const tip = groups[0].querySelector('div.absolute'); if (!(tip instanceof HTMLElement)) return 'missing'; tip.classList.remove('hidden'); tip.classList.add('flex'); tip.style.display = 'flex'; tip.style.visibility = 'visible'; tip.style.opacity = '1'; return 'ok'; })()`,
      true,
    );
    wait(120);
  }

  wait(200);
}

function openGitDiff() {
  const panelVisible = () => {
    const result = evalJs(
      "(() => { const panel = document.querySelector('[data-git-panel]'); if (!(panel instanceof HTMLElement)) return false; const style = window.getComputedStyle(panel); return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'; })()",
      true,
    ).trim();
    return result.includes("true");
  };

  evalJs(
    "(() => { const ctx = window.__bord || {}; if (typeof ctx.setState !== 'function') return 'no-store'; const active = ctx.state?.activeTerminalId; if (!active) return 'no-active'; ctx.setState('gitPanelTerminalId', active); return 'ok'; })()",
    true,
  );
  wait(300);

  if (!panelVisible()) {
    evalJs(
      "(() => { const button = [...document.querySelectorAll('button[title=\"Toggle git panel\"]')].find((el) => el instanceof HTMLElement && el.getClientRects().length > 0); if (!(button instanceof HTMLElement)) return 'missing'; button.click(); return 'ok'; })()",
      true,
    );
    wait(500);
  }

  if (!panelVisible()) {
    press("Meta+g", true);
    wait(700);
  }

  if (!panelVisible()) return;

  evalJs(
    "(() => { const panel = document.querySelector('[data-git-panel]'); if (!(panel instanceof HTMLElement)) return 'missing'; const fileButton = [...panel.querySelectorAll('button')].find((btn) => (btn.textContent || '').trim().includes('/')); if (!(fileButton instanceof HTMLElement)) return 'no-file'; fileButton.click(); return 'ok'; })()",
    true,
  );
  wait(500);
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
    "(() => { const groups = [...document.querySelectorAll('div.group')].filter((g) => g.getBoundingClientRect().top < 50 && g.querySelector('button') && g.querySelector('div.absolute')); return groups.some((g) => { const tip = g.querySelector('div.absolute'); if (!(tip instanceof HTMLElement)) return false; const style = window.getComputedStyle(tip); return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'; }); })()",
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

function ensureSidebarFileTreeMode() {
  evalJs(
    "(() => { const ctx = window.__bord || {}; if (typeof ctx.setState === 'function') { ctx.setState('sidebarMode', 'files'); return 'ok'; } return 'no-store'; })()",
    true,
  );
  wait(380);
}

function sidebarFileTreeVisible() {
  const result = evalJs(
    "(() => { const trees = [...document.querySelectorAll('[data-bord-sidebar] [data-file-tree]')]; return trees.some((el) => el instanceof HTMLElement && el.getClientRects().length > 0); })()",
    true,
  ).trim();
  return result.includes("true");
}

function fileViewerVisible() {
  const result = evalJs(
    "(() => { const el = document.querySelector('[data-file-viewer]'); if (!(el instanceof HTMLElement)) return false; return el.getClientRects().length > 0; })()",
    true,
  ).trim();
  return result.includes("true");
}

function expandVisibleTreeDirectory(name: string) {
  const result = evalJs(
    `(() => {
      const tree = [...document.querySelectorAll('[data-file-tree]')].find((el) => el instanceof HTMLElement && el.getClientRects().length > 0);
      if (!(tree instanceof HTMLElement)) return 'missing-tree';

      const rows = [...tree.querySelectorAll('div.flex.items-center.cursor-pointer')].filter((el) => el instanceof HTMLElement && el.getClientRects().length > 0);
      const target = rows.find((row) => {
        const label = ((row.querySelector('span.text-xs') as HTMLElement | null)?.textContent || row.textContent || '').trim().toLowerCase();
        return label === ${JSON.stringify(name.toLowerCase())};
      });
      if (!(target instanceof HTMLElement)) return 'missing-dir';

      const chevron = target.querySelector('svg');
      const expanded = chevron instanceof SVGElement && ((chevron.getAttribute('style') || '').includes('rotate(90deg)') || (chevron as SVGElement).style.transform.includes('90deg'));
      if (!expanded) target.click();
      return 'ok';
    })()`,
    true,
  ).trim();

  wait(260);
  return result.includes("ok");
}

function openFileFromVisibleTreeByRegex(pattern: string) {
  const result = evalJs(
    `(() => { const tree = [...document.querySelectorAll('[data-file-tree]')].find((el) => el instanceof HTMLElement && el.getClientRects().length > 0); if (!(tree instanceof HTMLElement)) return 'missing-tree'; const rows = [...tree.querySelectorAll('div.flex.items-center.cursor-pointer')].filter((el) => el instanceof HTMLElement && el.getClientRects().length > 0); const rx = new RegExp(${JSON.stringify(pattern)}, 'i'); const match = rows.find((row) => rx.test((row.textContent || '').trim())); if (!(match instanceof HTMLElement)) return 'no-match'; match.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return 'ok'; })()`,
    true,
  ).trim();
  wait(420);
  return result.includes("ok");
}

function openAnyVisibleTreeFile() {
  const result = evalJs(
    "(() => { const tree = [...document.querySelectorAll('[data-file-tree]')].find((el) => el instanceof HTMLElement && el.getClientRects().length > 0); if (!(tree instanceof HTMLElement)) return 'missing-tree'; const rows = [...tree.querySelectorAll('div.flex.items-center.cursor-pointer')].filter((el) => el instanceof HTMLElement && el.getClientRects().length > 0); for (const row of rows) { const text = (row.textContent || '').trim(); if (!text || text === 'Files' || text === 'Loading...') continue; if (/\.[a-z0-9]+$/i.test(text)) { row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return 'ok'; } } return 'no-file'; })()",
    true,
  ).trim();
  wait(420);
  return result.includes("ok");
}

function markdownPreviewReady() {
  const result = evalJs(
    "(() => { const preview = document.querySelector('.prose-viewer'); if (!(preview instanceof HTMLElement)) return false; const hasQuote = !!preview.querySelector('blockquote'); const hasList = !!preview.querySelector('ul, ol'); const hasCode = !!preview.querySelector('pre code'); const hasMermaid = !!preview.querySelector('.mermaid-rendered, .mermaid-placeholder'); return hasQuote && hasList && hasCode && hasMermaid; })()",
    true,
  ).trim();
  return result.includes("true");
}

function waitForMarkdownPreviewReady(attempts = 10, delayMs = 180) {
  for (let i = 0; i < attempts; i++) {
    if (markdownPreviewReady()) return true;
    wait(delayMs);
  }
  return false;
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
  clickButton(`New ${provider} session`, true);
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
      "fps=12,scale=1440:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=160:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=2",
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

function enforceCaptureVisualDefaults() {
  evalJs(
    "(() => { localStorage.setItem('bord-theme', 'catppuccin-frappe'); localStorage.setItem('bord:file-icon-pack', 'catppuccin'); localStorage.setItem('bord:file-icon-pack-explicit', '1'); return 'ok'; })()",
    true,
  );
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
  console.log(`Capture mode: ${captureMode}`);

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
    wait(700);

    enforceCaptureVisualDefaults();
    browser(["open", appUrl]);
    browser(["set", "viewport", "1720", "980"]);
    wait(1200);
    ensureSidebarExpanded();
    wait(250);

    await captureShot("home-overview.png", { profile: "context" });

    selectWorkspace(fixtureWeb.name);
    ensureSectionExpanded("Sessions", "Refresh");

    ensureProvider("Claude");
    refreshSessions();

    ensureProvider("Codex");
    refreshSessions();

    ensureMixedProviderTerminals(claudeTokens, codexTokens);

    ensureSidebarCollapsed();
    moveMouseToMainArea();
    await captureShot("sidebar-rail-counters.png", {
      profile: "closeup",
      selector: "[data-bord-sidebar-rail]",
      minWidth: 880,
      minHeight: 740,
    });

    ensureSidebarExpanded();
    hoverExpandedWorkspacePreview(fixtureWeb.name);
    clickPreviewTab("all");
    await captureShot("sidebar-hover-workspace-preview.png", {
      profile: "closeup",
      selector: "[data-workspace-hover-preview]",
      allowFlyout: true,
      minWidth: 980,
      minHeight: 700,
    });
    clickPreviewTab("sessions");
    moveMouseToMainArea();
    dismissFlyout();

    ensureProvider("Claude");
    refreshSessions();
    await captureShot("sessions-claude.png", {
      profile: "closeup",
      selector: "[data-bord-sidebar-panel=\"expanded\"]",
      minWidth: 1000,
      minHeight: 860,
    });

    ensureProvider("Codex");
    refreshSessions();
    await captureShot("sessions-codex.png", {
      profile: "closeup",
      selector: "[data-bord-sidebar-panel=\"expanded\"]",
      minWidth: 1000,
      minHeight: 860,
    });

    await captureShot("terminals-provider-icons.png", { profile: "context" });

    clickButton("1x", true);
    wait(700);
    await captureShot("layout-1x.png", { profile: "context" });

    clickButton("4x", true);
    wait(700);
    await captureShot("layout-4x.png", { profile: "context" });

    revealMinimapProviderTooltip();
    await captureShot("minimap-hover-provider-tooltip.png", {
      profile: "closeup",
      selector: "div.group div.absolute",
      allowMinimapTooltip: true,
      minWidth: 780,
      minHeight: 360,
    });
    hideMinimapTooltip();

    openGitDiff();
    ensureSelectorVisible("[data-git-panel]", 6, 200);
    await captureShot("git-panel-diff-selected.png", {
      profile: "closeup",
      selector: "[data-git-panel]",
      minWidth: 1100,
      minHeight: 760,
    });
    closeGitPanel();

    stashOneTerminalAndOpenTray();
    await captureShot("stash-sidebar-popover.png", {
      profile: "closeup",
      selector: "[data-stash-zone]",
      allowStash: true,
      minWidth: 900,
      minHeight: 580,
    });
    closeStashPopover();

    selectWorkspace(fixtureDocker.name);
    ensureDockerPanelVisible();
    await captureShot("docker-panel-expanded.png", {
      profile: "closeup",
      selector: "[data-bord-sidebar-panel=\"expanded\"]",
      minWidth: 1020,
      minHeight: 860,
    });

    selectWorkspace(fixtureWeb.name);
    ensureSidebarExpanded();
    openEditorDropdown();
    await captureShot("open-in-editor-controls.png", {
      profile: "closeup",
      selector: "button[title=\"Choose editor\"]",
      minWidth: 760,
      minHeight: 460,
    });
    evalJs("(() => { document.body.click(); return 'ok'; })()", true);
    wait(200);

    openSettingsPanel();
    switchSettingsSection("Appearance");
    await captureShot("settings-appearance.png", {
      profile: "closeup",
      selector: ".fixed.inset-0.z-50 > div",
      allowSettings: true,
      minWidth: 1100,
      minHeight: 760,
    });
    await captureShot("settings-theme-picker.png", {
      profile: "closeup",
      selector: ".fixed.inset-0.z-50 > div",
      allowSettings: true,
      minWidth: 1100,
      minHeight: 760,
    });

    switchSettingsSection("Notifications");
    await captureShot("settings-notifications.png", {
      profile: "closeup",
      selector: ".fixed.inset-0.z-50 > div",
      allowSettings: true,
      minWidth: 1100,
      minHeight: 760,
    });

    switchSettingsSection("Features");
    await captureShot("settings-features.png", {
      profile: "closeup",
      selector: ".fixed.inset-0.z-50 > div",
      allowSettings: true,
      minWidth: 1100,
      minHeight: 760,
    });

    switchSettingsSection("About");
    await captureShot("settings-about-updates.png", {
      profile: "closeup",
      selector: ".fixed.inset-0.z-50 > div",
      allowSettings: true,
      minWidth: 1100,
      minHeight: 760,
    });
    closeSettingsPanel();

    // --- File tree & viewer screenshots ---
    suppressHoverPreview();

    // Force single-column layout so only the active terminal is visible (hides secondary panels)
    const prevColumns = evalJs("(() => { const { state, setState } = window.__bord || {}; if (!state) return '0'; const prev = state.layoutColumns; setState('layoutColumns', 1); return String(prev); })()", true).trim();
    wait(300);

    // Sidebar file tree mode
    selectWorkspace(fixtureWeb.name);
    ensureSidebarExpanded();
    ensureSidebarFileTreeMode();
    dismissFlyout();

    evalJs(
      "(() => { const btns = [...document.querySelectorAll('[data-bord-sidebar] button[title=\"File tree\"]')].filter(b => b instanceof HTMLElement && b.getClientRects().length > 0); if (!btns[0]) return 'missing'; btns[0].click(); return 'ok'; })()",
      true,
    );
    wait(800);

    if (!sidebarFileTreeVisible()) {
      ensureSidebarFileTreeMode();
      wait(420);
    }

    // Expand key folders for a denser sidebar tree capture
    expandVisibleTreeDirectory("src");
    expandVisibleTreeDirectory("components");
    expandVisibleTreeDirectory("lib");
    expandVisibleTreeDirectory("docs");
    expandVisibleTreeDirectory("public");
    wait(420);
    dismissFlyout();
    await captureShot("sidebar-file-tree.png", {
      profile: "closeup",
      selector: "[data-bord-sidebar] [data-file-tree]",
      minWidth: 980,
      minHeight: 860,
    });

    // Open a code file from sidebar tree
    let openedCode = openFileFromVisibleTreeByRegex("terminal-tile\\.(ts|tsx)$");
    if (!openedCode) {
      openedCode = openFileFromVisibleTreeByRegex("\\.(ts|tsx|js|jsx|json)$");
    }
    if (!openedCode || !fileViewerVisible()) {
      openAnyVisibleTreeFile();
    }
    wait(420);
    dismissFlyout();
    await captureShot("file-viewer-syntax.png", {
      profile: "closeup",
      selector: "[data-file-viewer]",
      minWidth: 1000,
      minHeight: 760,
    });

    // Open markdown and toggle preview
    expandVisibleTreeDirectory("docs");
    let openedMarkdown = openFileFromVisibleTreeByRegex("showcase-preview\\.md$");
    if (!openedMarkdown) {
      openedMarkdown = openFileFromVisibleTreeByRegex("(readme|\\.md)$");
    }
    if (!openedMarkdown || !fileViewerVisible()) {
      openAnyVisibleTreeFile();
    }
    wait(420);

    // Click Preview button
    evalJs(
      "(() => { const btn = document.querySelector('[data-md-preview-toggle]'); if (!btn) return 'missing'; btn.click(); return 'ok'; })()",
      true,
    );
    wait(720);
    waitForMarkdownPreviewReady();

    dismissFlyout();
    await captureShot("file-viewer-markdown-preview.png", {
      profile: "closeup",
      selector: "[data-file-viewer]",
      minWidth: 1000,
      minHeight: 820,
    });

    // Terminal file tree (folder icon on terminal panel)
    // Click file tree button on terminal title bar
    evalJs(
      "(() => { const panels = document.querySelectorAll('[data-terminal-id]'); if (!panels.length) return 'missing'; const panel = panels[0]; const btn = panel.querySelector('button[title=\"File tree\"]'); if (!btn) return 'no-btn'; btn.click(); return 'ok'; })()",
      true,
    );
    wait(800);
    ensureSidebarCollapsed();
    ensureSelectorVisible("[data-terminal-id] [data-file-tree]", 6, 160);
    dismissFlyout();
    await captureShot("file-tree-terminal.png", {
      profile: "closeup",
      selector: "[data-terminal-id] [data-file-tree]",
      minWidth: 1020,
      minHeight: 760,
    });

    // Return to terminal view for subsequent captures
    evalJs(
      "(() => { const panels = document.querySelectorAll('[data-terminal-id]'); if (!panels.length) return 'missing'; const panel = panels[0]; const btn = panel.querySelector('button[title=\"File tree\"]'); if (!btn) return 'no-btn'; btn.click(); return 'ok'; })()",
      true,
    );
    wait(400);

    // --- End file tree & viewer screenshots ---
    restoreHoverPreview();

    // Restore original layout columns
    evalJs(`(() => { const { setState } = window.__bord || {}; if (setState) { setState('layoutColumns', ${prevColumns || 0}); return 'restored'; } return 'no-store'; })()`, true);
    wait(300);

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

    // --- Showcase sequence: 4 tabs, density cycle, then horizontal scroll ---

    ensureSidebarCollapsed();
    ensureVisibleTerminalCount(4);
    wait(650);
    hold(4, 220);

    clickButton("4x", true);
    wait(420);
    hold(4, 210);

    clickButton("3x", true);
    wait(420);
    hold(4, 210);

    clickButton("2x", true);
    wait(420);
    hold(4, 210);

    clickButton("1x", true);
    wait(560);
    hold(4, 210);

    horizontalScrollRight();
    hold(6, 170);
    wait(260);
    hold(2, 170);

    horizontalScrollLeft();
    hold(6, 170);
    wait(260);
    hold(2, 170);

    clickButton("3x", true);
    wait(400);
    hold(3, 210);

    // Continue showcase with session/provider workflow
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
    closeGitPanel();

    // File tree — open from terminal title bar
    evalJs(
      "(() => { const panels = document.querySelectorAll('[data-terminal-id]'); if (!panels.length) return 'missing'; const panel = panels[0]; const btn = panel.querySelector('button[title=\"File tree\"]'); if (!btn) return 'no-btn'; btn.click(); return 'ok'; })()",
      true,
    );
    wait(800);
    hold(3, 220);

    // Expand a directory
    evalJs(
      "(() => { const tree = document.querySelector('[data-file-tree]'); if (!tree) return 'missing'; const dirs = [...tree.querySelectorAll('div.flex.items-center:has(svg)')]; if (dirs[0]) dirs[0].click(); return 'ok'; })()",
      true,
    );
    wait(500);
    hold(3, 220);

    // Open a file from tree
    evalJs(
      "(() => { const tree = document.querySelector('[data-file-tree]'); if (!tree) return 'missing'; const entries = [...tree.querySelectorAll('div.flex.items-center.cursor-pointer')]; const file = entries.find(e => /\\.(ts|js|json)$/.test((e.textContent || '').trim())); if (file) { file.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return 'ok'; } return 'no-file'; })()",
      true,
    );
    wait(800);
    hold(4, 240);

    // Return to terminal
    evalJs(
      "(() => { const panels = document.querySelectorAll('[data-terminal-id]'); if (!panels.length) return 'missing'; const panel = panels[0]; const btn = panel.querySelector('button[title=\"File tree\"]'); if (!btn) return 'no-btn'; btn.click(); return 'ok'; })()",
      true,
    );
    wait(400);
    hold(3, 220);

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
