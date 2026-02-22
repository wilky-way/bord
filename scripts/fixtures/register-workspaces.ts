import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

interface WorkspaceFixture {
  name: string;
  path: string;
  notes: string;
}

interface Manifest {
  fixtureRoot: string;
  workspaces: WorkspaceFixture[];
}

interface WorkspaceRecord {
  id: string;
  name: string;
  path: string;
}

const root = process.env.BORD_FIXTURE_ROOT ?? join(homedir(), "Developer", "bord-fixtures");
const manifestPath = join(root, "fixture-manifest.json");
const apiBase = process.env.BORD_API_URL ?? "http://localhost:4200";
const reset = process.env.BORD_FIXTURE_RESET !== "0";

async function main() {
  const raw = await readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(raw) as Manifest;

  const listResponse = await fetch(`${apiBase}/api/workspaces`);
  if (!listResponse.ok) {
    throw new Error(`Failed to list workspaces (${listResponse.status})`);
  }

  const existing = (await listResponse.json()) as WorkspaceRecord[];

  let removed = 0;
  if (reset) {
    const fixtureExisting = existing.filter((workspace) => workspace.path.startsWith(manifest.fixtureRoot));
    for (const workspace of fixtureExisting) {
      const removeResponse = await fetch(`${apiBase}/api/workspaces/${workspace.id}`, {
        method: "DELETE",
      });
      if (removeResponse.ok) {
        removed++;
      }
    }
  }

  const refreshedListResponse = await fetch(`${apiBase}/api/workspaces`);
  if (!refreshedListResponse.ok) {
    throw new Error(`Failed to refresh workspaces (${refreshedListResponse.status})`);
  }

  const refreshed = (await refreshedListResponse.json()) as WorkspaceRecord[];
  const existingPaths = new Set(refreshed.map((workspace) => workspace.path));

  let added = 0;
  let skipped = 0;

  for (const workspace of manifest.workspaces) {
    if (existingPaths.has(workspace.path)) {
      skipped++;
      continue;
    }

    const createResponse = await fetch(`${apiBase}/api/workspaces`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: workspace.name, path: workspace.path }),
    });

    if (!createResponse.ok) {
      const body = await createResponse.text();
      if (body.includes("UNIQUE constraint failed")) {
        skipped++;
        continue;
      }
      throw new Error(`Failed to create workspace ${workspace.name}: ${body}`);
    }

    added++;
  }

  console.log(`Workspace registration complete. Removed: ${removed}, added: ${added}, skipped: ${skipped}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
