import { mkdirSync, copyFileSync, existsSync } from "fs";
import { join } from "path";

const isWindows = process.platform === "win32";
const serverName = isWindows ? "bord-server.exe" : "bord-server";
const dest = join("src-tauri/resources", serverName);

mkdirSync("src-tauri/resources", { recursive: true });

// Skip server binary copy if already present (CI pre-signs it)
if (!existsSync(dest)) {
  copyFileSync(join("dist", serverName), dest);
}
copyFileSync("server/schema.sql", "src-tauri/resources/schema.sql");
