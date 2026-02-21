import { scanSessions } from "../services/session-scanner";

export async function sessionRoutes(req: Request, url: URL): Promise<Response | null> {
  // GET /api/sessions
  if (req.method === "GET" && url.pathname === "/api/sessions") {
    const projectPath = url.searchParams.get("project") ?? undefined;
    const sessions = await scanSessions(projectPath);
    return Response.json(sessions);
  }

  return null;
}
