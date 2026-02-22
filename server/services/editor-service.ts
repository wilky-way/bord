import { existsSync } from "fs";
import { resolve } from "path";
import { validateCwd } from "./git-service";

export type EditorType = "vscode" | "cursor" | "zed";

const EDITOR_COMMANDS: Record<EditorType, string> = {
  vscode: "code",
  cursor: "cursor",
  zed: "zed",
};

export async function openInEditor(
  cwd: string,
  editor: EditorType,
  file?: string
): Promise<{ ok: boolean; error?: string }> {
  const check = validateCwd(cwd);
  if (!check.valid) return { ok: false, error: check.error };

  const cmd = EDITOR_COMMANDS[editor];
  if (!cmd) return { ok: false, error: `Unknown editor: ${editor}` };

  const target = file ? resolve(cwd, file) : ".";
  if (file && !existsSync(target)) {
    return { ok: false, error: `File does not exist: ${file}` };
  }

  try {
    const proc = Bun.spawn([cmd, target], {
      cwd,
      stdout: "ignore",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      return { ok: false, error: stderr || `${cmd} exited with code ${exitCode}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Failed to spawn ${cmd}: ${e}` };
  }
}
