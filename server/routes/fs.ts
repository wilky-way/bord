import { existsSync, statSync, readdirSync } from "fs";
import { homedir } from "os";
import { resolve, dirname } from "path";
import { listDir, readFile, writeFile } from "../services/fs-service";

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

  // GET /api/fs/list?path=<dir>
  if (req.method === "GET" && url.pathname === "/api/fs/list") {
    const p = url.searchParams.get("path");
    if (!p) return Response.json({ error: "Missing path" }, { status: 400 });
    const resolvedPath = resolve(p);
    if (!existsSync(resolvedPath) || !statSync(resolvedPath).isDirectory()) {
      return Response.json({ error: "Not a directory" }, { status: 400 });
    }
    return Response.json(listDir(resolvedPath));
  }

  // GET /api/fs/read?path=<file>
  if (req.method === "GET" && url.pathname === "/api/fs/read") {
    const p = url.searchParams.get("path");
    if (!p) return Response.json({ error: "Missing path" }, { status: 400 });
    const resolvedPath = resolve(p);
    if (!existsSync(resolvedPath)) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }
    return Response.json(readFile(resolvedPath));
  }

  // POST /api/fs/write { path, content }
  if (req.method === "POST" && url.pathname === "/api/fs/write") {
    const body = await req.json() as { path?: string; content?: string };
    if (!body.path || typeof body.content !== "string") {
      return Response.json({ error: "Missing path or content" }, { status: 400 });
    }
    const resolvedPath = resolve(body.path);
    return Response.json(writeFile(resolvedPath, body.content));
  }

  return null;
}
