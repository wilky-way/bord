import { mkdirSync, copyFileSync } from "fs";
import { join } from "path";

const isWindows = process.platform === "win32";
const serverName = isWindows ? "bord-server.exe" : "bord-server";

mkdirSync("src-tauri/resources", { recursive: true });
copyFileSync(join("dist", serverName), join("src-tauri/resources", serverName));
copyFileSync("server/schema.sql", "src-tauri/resources/schema.sql");
