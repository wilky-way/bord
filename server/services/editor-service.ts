import { existsSync } from "fs";
import { resolve } from "path";
import { validateCwd } from "./git-service";

export type EditorType = "vscode" | "cursor" | "zed";

const EDITOR_COMMANDS: Record<EditorType, { cli: string[]; apps: string[] }> = {
  vscode: {
    cli: [
      "code",
      "/usr/local/bin/code",
      "/opt/homebrew/bin/code",
      "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
      "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code",
    ],
    apps: ["Visual Studio Code", "Visual Studio Code - Insiders"],
  },
  cursor: {
    cli: [
      "cursor",
      "/usr/local/bin/cursor",
      "/opt/homebrew/bin/cursor",
      "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
      "/Applications/Cursor.app/Contents/Resources/app/bin/code",
    ],
    apps: ["Cursor"],
  },
  zed: {
    cli: [
      "zed",
      "/usr/local/bin/zed",
      "/opt/homebrew/bin/zed",
      "/Applications/Zed.app/Contents/MacOS/cli",
    ],
    apps: ["Zed"],
  },
};

function mergedPath(): string {
  const extra = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];
  const current = (process.env.PATH ?? "").split(":").filter(Boolean);
  return Array.from(new Set([...current, ...extra])).join(":");
}

async function runEditor(args: string[], cwd: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const proc = Bun.spawn(args, {
      cwd,
      env: {
        ...process.env,
        PATH: mergedPath(),
      },
      stdout: "ignore",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      return { ok: false, error: stderr || `${args[0]} exited with code ${exitCode}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Failed to spawn ${args[0]}: ${e}` };
  }
}

export async function openInEditor(
  cwd: string,
  editor: EditorType,
  file?: string
): Promise<{ ok: boolean; error?: string }> {
  const check = validateCwd(cwd);
  if (!check.valid) return { ok: false, error: check.error };

  const config = EDITOR_COMMANDS[editor];
  if (!config) return { ok: false, error: `Unknown editor: ${editor}` };

  const target = file ? resolve(cwd, file) : cwd;
  if (file && !existsSync(target)) {
    return { ok: false, error: `File does not exist: ${file}` };
  }

  // Prefer editor CLIs when available.
  let lastError: string | undefined;
  for (const cmd of config.cli) {
    if (cmd.includes("/") && !existsSync(cmd)) continue;
    const result = await runEditor([cmd, target], cwd);
    if (result.ok) return result;
    lastError = result.error;
  }

  // Fallback to macOS LaunchServices when CLI isn't on PATH.
  for (const appName of config.apps) {
    const result = await runEditor(["/usr/bin/open", "-a", appName, target], cwd);
    if (result.ok) return result;
    lastError = result.error;
  }

  return {
    ok: false,
    error:
      lastError ??
      `Could not launch ${editor}. Install the app or add its CLI to PATH.`,
  };
}
