import { openInEditor, type EditorType } from "../services/editor-service";

export async function editorRoutes(req: Request, url: URL): Promise<Response | null> {
  if (req.method === "POST" && url.pathname === "/api/editor/open") {
    const body = (await req.json()) as { cwd?: string; editor?: string };
    if (!body.cwd) {
      return Response.json({ error: "cwd is required" }, { status: 400 });
    }
    if (!body.editor || !["vscode", "cursor"].includes(body.editor)) {
      return Response.json({ error: "editor must be 'vscode' or 'cursor'" }, { status: 400 });
    }
    const result = await openInEditor(body.cwd, body.editor as EditorType);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }
  return null;
}
