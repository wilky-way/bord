#!/usr/bin/env bun
/**
 * Captures a horizontal scrolling GIF demonstrating 1x density mode.
 *
 * Prerequisites: bun run dev (server + UI must be running)
 * Usage: bun run scripts/qa/capture-horizontal-scroll.ts
 */

import { mkdir, rm, rename } from "fs/promises";
import { statSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

const repoRoot = process.cwd();
const mediaDir = join(repoRoot, "docs", "media");
const outputPath = join(mediaDir, "horizontal-scroll-1x.gif");
const tempGifPath = join(mediaDir, "horizontal-scroll-1x.tmp.gif");
const frameDir = join(mediaDir, "_hscroll_frames");
const appUrl = process.env.BORD_APP_URL ?? "http://localhost:1420";
const apiUrl = process.env.BORD_API_URL ?? "http://localhost:4200";
const session =
  process.env.AGENT_BROWSER_SESSION ?? `bord-hscroll-${Date.now()}`;

// ---------------------------------------------------------------------------
// Helpers (same pattern as capture-media.ts)
// ---------------------------------------------------------------------------

function stripAnsi(value: string) {
  return value.replace(/\x1B\[[0-9;]*m/g, "");
}

interface RunOptions {
  allowFailure?: boolean;
  silent?: boolean;
  timeout?: number;
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

function ab(args: string[], opts: RunOptions = {}) {
  return run(["agent-browser", "--session", session, ...args], opts);
}

function wait(ms: number) {
  ab(["wait", String(ms)], { allowFailure: true, silent: true });
}

function evalJs(script: string) {
  return ab(["eval", script], { allowFailure: true, silent: true }).stdout;
}

function screenshotTo(path: string) {
  ab(["screenshot", path]);
}

function extractInt(value: string) {
  const match = value.match(/-?\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function ffmpegBinary() {
  return process.env.BORD_FFMPEG_PATH ?? "ffmpeg";
}

// ---------------------------------------------------------------------------
// Tiling container helpers
// ---------------------------------------------------------------------------

function getContainerWidth(): number {
  const raw = evalJs(
    "var c = document.querySelector('.flex-nowrap'); c ? c.clientWidth : 0",
  );
  return extractInt(raw) || 1368;
}

function getScrollWidth(): number {
  const raw = evalJs(
    "var c = document.querySelector('.flex-nowrap'); c ? c.scrollWidth : 0",
  );
  return extractInt(raw) || 4000;
}

function setScrollLeft(position: number) {
  evalJs(
    `var c = document.querySelector('.flex-nowrap'); if (c) c.scrollLeft = ${Math.round(position)}; 'ok'`,
  );
}

// ---------------------------------------------------------------------------
// UI interaction helpers
// ---------------------------------------------------------------------------

function clickAddTerminal() {
  evalJs(
    'var b = document.querySelector(\'button[title="Add terminal"]\'); if (b) b.click(); "ok"',
  );
}

function clickDensityButton(n: number) {
  // Density buttons are in a group; find by text content "Nx"
  evalJs(
    `var buttons = [...document.querySelectorAll('button')]; var b = buttons.find(function(el) { return el.textContent.trim() === '${n}x' && el.title && el.title.includes('terminal'); }); if (b) b.click(); 'ok'`,
  );
}

function collapseSidebar() {
  evalJs(
    'var b = document.querySelector(\'button[title*="Toggle sidebar"]\'); if (b) b.click(); "ok"',
  );
}

function selectWorkspaceByPath(path: string) {
  // Match the exact path — reject elements whose text continues with more
  // path characters (e.g. /bord-fixtures when looking for /bord).
  const nextChar = path + "/";
  const nextDash = path + "-";
  evalJs(
    `var items = [...document.querySelectorAll('div.cursor-pointer')]; var t = items.find(function(el) { var txt = el.textContent || ''; return txt.indexOf(${JSON.stringify(path)}) !== -1 && txt.indexOf(${JSON.stringify(nextChar)}) === -1 && txt.indexOf(${JSON.stringify(nextDash)}) === -1; }); if (t) t.click(); 'ok'`,
  );
  wait(700);
}

function visibleTerminalCount(): number {
  return extractInt(
    evalJs("document.querySelectorAll('[data-titlebar]').length"),
  );
}

function ensureTerminalCount(target: number) {
  for (let i = 0; i < target + 5; i++) {
    if (visibleTerminalCount() >= target) return;
    clickAddTerminal();
    wait(1500);
  }
}

function sidebarIsExpanded(): boolean {
  return evalJs(
    "!!document.querySelector('[data-bord-sidebar-panel=\"expanded\"]')",
  ).includes("true");
}

function ensureSidebarCollapsed() {
  if (sidebarIsExpanded()) {
    collapseSidebar();
    wait(400);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function verifyApp() {
  const health = await fetch(`${apiUrl}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    throw new Error(
      `Bord server not reachable at ${apiUrl}. Run \`bun run dev\` first.`,
    );
  }
}

async function main() {
  await verifyApp();
  await rm(frameDir, { recursive: true, force: true });
  await mkdir(frameDir, { recursive: true });

  try {
    // Open browser
    ab(["close"], { allowFailure: true, silent: true });
    const first = ab(["open", appUrl], { allowFailure: true, silent: true });
    if (first.exitCode !== 0) {
      run(["agent-browser", "close"], { allowFailure: true, silent: true });
      wait(200);
      ab(["open", appUrl]);
    }
    ab(["set", "viewport", "1520", "920"]);
    wait(2000);

    // Create or reuse workspace
    const workspaces = (await fetch(`${apiUrl}/api/workspaces`).then((r) =>
      r.json(),
    )) as any[];
    const bordPath = "/Users/wilky/Developer/bord";
    const existing = workspaces.find((w: any) => w.path === bordPath);

    if (existing) {
      console.log("Using existing workspace:", existing.id);
    } else {
      const result = (await fetch(`${apiUrl}/api/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "bord", path: bordPath }),
      }).then((r) => r.json())) as any;
      console.log("Created workspace:", result.id);
      // Reload to pick up new workspace
      ab(["open", appUrl]);
      wait(2000);
    }

    // Select workspace
    selectWorkspaceByPath(bordPath);

    // Add 3 terminals
    ensureTerminalCount(3);
    wait(1500);
    console.log(`Visible terminals: ${visibleTerminalCount()}`);

    // Set 1x density
    clickDensityButton(1);
    wait(800);

    // Collapse sidebar for clean capture
    ensureSidebarCollapsed();
    wait(400);

    // Move mouse off-screen
    ab(["mouse", "move", "860", "950"], {
      allowFailure: true,
      silent: true,
    });
    wait(300);

    // Read container dimensions
    const panelWidth = getContainerWidth();
    const scrollW = getScrollWidth();
    console.log(`Container: ${panelWidth}px wide, scrollWidth: ${scrollW}px`);

    // -----------------------------------------------------------------
    // Frame capture with eased scrolling
    // -----------------------------------------------------------------

    let frame = 1;

    const captureFrame = () => {
      screenshotTo(
        join(frameDir, `frame-${String(frame).padStart(3, "0")}.png`),
      );
      frame++;
    };

    const holdFrames = (count: number, delayMs = 150) => {
      for (let i = 0; i < count; i++) {
        captureFrame();
        wait(delayMs);
      }
    };

    /** Ease-in-out cubic */
    const ease = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    /** Animate scrollLeft from `from` to `to` over `steps` frames. */
    const animateScroll = (from: number, to: number, steps: number) => {
      for (let i = 1; i <= steps; i++) {
        const pos = Math.round(from + (to - from) * ease(i / steps));
        setScrollLeft(pos);
        wait(60);
        captureFrame();
      }
    };

    console.log("Capturing frames...");

    // 1. Terminal 1 in view
    setScrollLeft(0);
    wait(300);
    holdFrames(5);

    // 2. Ease scroll to mid-point between T1 and T2
    const midT1T2 = Math.round(panelWidth * 0.5);
    animateScroll(0, midT1T2, 8);

    // 3. Hold at mid-scroll (the showcase moment)
    holdFrames(4);

    // 4. Continue to Terminal 2
    animateScroll(midT1T2, panelWidth, 6);

    // 5. Hold at Terminal 2
    holdFrames(4);

    // 6. Scroll to mid-point between T2 and T3
    const midT2T3 = Math.round(panelWidth * 1.5);
    animateScroll(panelWidth, midT2T3, 6);

    // 7. Brief hold
    holdFrames(2);

    // 8. Snap to Terminal 3
    animateScroll(midT2T3, panelWidth * 2, 5);

    // 9. Hold at Terminal 3
    holdFrames(5);

    const totalFrames = frame - 1;
    console.log(`Captured ${totalFrames} frames`);

    // -----------------------------------------------------------------
    // Build GIF with two-pass palette for quality
    // -----------------------------------------------------------------

    const ffmpeg = ffmpegBinary();
    const pattern = join(frameDir, "frame-%03d.png");

    run(
      [
        ffmpeg,
        "-y",
        "-framerate",
        "12",
        "-start_number",
        "1",
        "-i",
        pattern,
        "-frames:v",
        String(totalFrames),
        "-vf",
        "fps=12,scale=1480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=160:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=2",
        tempGifPath,
      ],
      { timeout: 120_000 },
    );

    await rename(tempGifPath, outputPath);
    const size = statSync(outputPath).size;
    console.log(
      `GIF created: ${outputPath} (${(size / 1024 / 1024).toFixed(2)} MB)`,
    );

    if (size > 5 * 1024 * 1024) {
      console.warn(
        "Warning: GIF exceeds 5 MB target. Consider reducing frames or resolution.",
      );
    }
  } finally {
    await rm(frameDir, { recursive: true, force: true });
    await rm(tempGifPath, { force: true });
    ab(["close"], { allowFailure: true, silent: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
