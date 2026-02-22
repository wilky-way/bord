import { execSync, type ExecSyncOptions } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const FIXTURE_ROOT =
  process.env.BORD_FIXTURE_ROOT ?? join(homedir(), "Developer", "bord-fixtures");
const SERVER_URL = process.env.BORD_SERVER_URL ?? "http://localhost:4200";
const HEALTH_TIMEOUT = 30_000;
const PROJECT_ROOT = join(import.meta.dirname, "..");

export default async function globalSetup() {
  // 1. Ensure fixtures exist
  const manifestPath = join(FIXTURE_ROOT, "fixture-manifest.json");
  if (!existsSync(manifestPath)) {
    console.log("[e2e] Fixture manifest not found, running setup-demo.ts...");
    const opts: ExecSyncOptions = {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env: { ...process.env, BORD_FIXTURE_ROOT: FIXTURE_ROOT },
      timeout: 300_000,
    };
    execSync("bun run scripts/fixtures/setup-demo.ts", opts);
  }

  // 2. Wait for server health
  console.log("[e2e] Waiting for server health...");
  const start = Date.now();
  while (Date.now() - start < HEALTH_TIMEOUT) {
    try {
      const res = await fetch(`${SERVER_URL}/api/health`);
      if (res.ok) {
        console.log("[e2e] Server is healthy");
        break;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // 3. Register fixture workspaces
  console.log("[e2e] Registering fixture workspaces...");
  try {
    execSync("bun run scripts/fixtures/register-workspaces.ts", {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      env: { ...process.env, BORD_FIXTURE_ROOT: FIXTURE_ROOT },
      timeout: 30_000,
    });
  } catch (err) {
    console.warn("[e2e] Workspace registration failed (may already be registered):", err);
  }
}
