import { getDb } from "../services/db";
import { randomUUID } from "crypto";
import { existsSync, statSync } from "node:fs";

export async function workspaceRoutes(req: Request, url: URL): Promise<Response | null> {
  const db = getDb();

  // GET /api/workspaces
  if (req.method === "GET" && url.pathname === "/api/workspaces") {
    const rows = db.query("SELECT * FROM workspaces ORDER BY updated_at DESC").all();
    return Response.json(rows);
  }

  // POST /api/workspaces
  if (req.method === "POST" && url.pathname === "/api/workspaces") {
    const body = (await req.json()) as { name: string; path: string };
    if (!body.path || !existsSync(body.path) || !statSync(body.path).isDirectory()) {
      return Response.json({ error: "Path does not exist or is not a directory" }, { status: 400 });
    }
    const id = randomUUID();
    db.run(
      "INSERT INTO workspaces (id, name, path) VALUES (?, ?, ?)",
      [id, body.name, body.path]
    );
    return Response.json({ id, name: body.name, path: body.path }, { status: 201 });
  }

  // DELETE /api/workspaces/:id
  const deleteMatch = url.pathname.match(/^\/api\/workspaces\/(.+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const id = deleteMatch[1];
    const result = db.run("DELETE FROM workspaces WHERE id = ?", [id]);
    if (result.changes === 0) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json({ ok: true });
  }

  return null;
}
