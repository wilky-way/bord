import { existsSync, statSync, readdirSync } from "fs";
import { homedir } from "os";
import { resolve, dirname } from "path";

export async function fsRoutes(req: Request, url: URL): Promise<Response | null> {
  // GET /api/fs/browse?path=...
  if (req.method === "GET" && url.pathname === "/api/fs/browse") {
    const requestedPath = url.searchParams.get("path") || homedir();
    const resolved = resolve(requestedPath);

    if (!existsSync(resolved)) {
      return Response.json({ error: "Path does not exist" }, { status: 400 });
    }

    const stat = statSync(resolved);
    if (!stat.isDirectory()) {
      return Response.json({ error: "Path is not a directory" }, { status: 400 });
    }

    const parent = resolved === "/" ? null : dirname(resolved);

    let dirs: Array<{ name: string; path: string }> = [];
    try {
      const entries = readdirSync(resolved, { withFileTypes: true });
      dirs = entries
        .filter((e: { isDirectory(): boolean; name: string }) => e.isDirectory() && !e.name.startsWith("."))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
        .map((e: { name: string }) => ({ name: e.name, path: resolve(resolved, e.name) }));
    } catch {
      // Permission denied or similar - return empty
    }

    return Response.json({ current: resolved, parent, dirs });
  }

  return null;
}
