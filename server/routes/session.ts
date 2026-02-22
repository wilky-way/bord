import { scanSessions, isProvider } from "../services/session-scanner";
import type { Provider } from "../services/session-scanner";

export async function sessionRoutes(req: Request, url: URL): Promise<Response | null> {
  // GET /api/sessions
  if (req.method === "GET" && url.pathname === "/api/sessions") {
    const projectPath = url.searchParams.get("project") ?? undefined;
    const providerParam = url.searchParams.get("provider");
    let provider: Provider | undefined;
    if (providerParam) {
      if (!isProvider(providerParam)) {
        return Response.json({ error: `Invalid provider: ${providerParam}` }, { status: 400 });
      }
      provider = providerParam;
    }
    const sessions = await scanSessions(projectPath, provider);
    return Response.json(sessions);
  }

  return null;
}
