import { getFeatureFlags, updateFeatureFlags } from "../services/feature-flags";

export async function featureRoutes(req: Request, url: URL): Promise<Response | null> {
  // GET /api/features
  if (req.method === "GET" && url.pathname === "/api/features") {
    return Response.json(getFeatureFlags());
  }

  // PUT /api/features
  if (req.method === "PUT" && url.pathname === "/api/features") {
    const body = await req.json();
    const updated = updateFeatureFlags(body);
    return Response.json(updated);
  }

  return null;
}
