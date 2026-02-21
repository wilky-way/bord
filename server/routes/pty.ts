import { createPty, destroyPty, listPtySessions } from "../services/pty-manager";
import { validateCwd } from "../services/git-service";
import { randomUUID } from "crypto";

export async function ptyRoutes(req: Request, url: URL): Promise<Response | null> {
  // POST /api/pty - create a new PTY session
  if (req.method === "POST" && url.pathname === "/api/pty") {
    const body = await req.json().catch(() => ({}));
    const { cwd: rawCwd, cols, rows, command } = body as {
      cwd?: string;
      cols?: number;
      rows?: number;
      command?: string[];
    };
    const cwd = rawCwd ?? process.env.HOME ?? "/";

    // Validate cwd
    const check = validateCwd(cwd);
    if (!check.valid) {
      return Response.json({ error: check.error }, { status: 400 });
    }

    // Validate command if present
    if (
      command !== undefined &&
      (!Array.isArray(command) || !command.every((c) => typeof c === "string"))
    ) {
      return Response.json({ error: "command must be string[]" }, { status: 400 });
    }

    const id = randomUUID();
    createPty(id, cwd, cols ?? 80, rows ?? 24, command);
    return Response.json({ id, cwd });
  }

  // GET /api/pty - list active PTY sessions
  if (req.method === "GET" && url.pathname === "/api/pty") {
    return Response.json(listPtySessions());
  }

  // DELETE /api/pty/:id - destroy a PTY session
  const deleteMatch = url.pathname.match(/^\/api\/pty\/(.+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const id = deleteMatch[1];
    const destroyed = destroyPty(id);
    if (!destroyed) {
      return Response.json({ error: "PTY session not found" }, { status: 404 });
    }
    return Response.json({ ok: true });
  }

  return null;
}
