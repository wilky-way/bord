import { validateCwd } from "./git-service";

export type EditorType = "vscode" | "cursor";

const EDITOR_COMMANDS: Record<EditorType, string> = {
  vscode: "code",
  cursor: "cursor",
};

export async function openInEditor(
  cwd: string,
  editor: EditorType
): Promise<{ ok: boolean; error?: string }> {
  const check = validateCwd(cwd);
  if (!check.valid) return { ok: false, error: check.error };

  const cmd = EDITOR_COMMANDS[editor];
  if (!cmd) return { ok: false, error: `Unknown editor: ${editor}` };

  try {
    const proc = Bun.spawn([cmd, "."], {
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
