import { existsSync } from "fs";
import { rm } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

const root = process.env.BORD_FIXTURE_ROOT ?? join(homedir(), "Developer", "bord-fixtures");

function ensureSafeRoot(path: string) {
  if (!path.includes("bord-fixtures")) {
    throw new Error(`Refusing to remove non-fixture path: ${path}`);
  }
}

async function main() {
  ensureSafeRoot(root);

  if (!existsSync(root)) {
    console.log(`Fixture root not found: ${root}`);
    return;
  }

  await rm(root, { recursive: true, force: true });
  console.log(`Removed fixture root: ${root}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
