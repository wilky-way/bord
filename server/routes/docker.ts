import * as docker from "../services/docker-service";

export async function dockerRoutes(req: Request, url: URL): Promise<Response | null> {
  // GET /api/docker/discover?paths=path1,path2
  if (req.method === "GET" && url.pathname === "/api/docker/discover") {
    const pathsParam = url.searchParams.get("paths") || "";
    const paths = pathsParam.split(",").filter(Boolean);
    if (paths.length === 0) {
      return Response.json({ error: "paths query parameter required" }, { status: 400 });
    }
    const files = await docker.discoverComposeFiles(paths);
    return Response.json({ files });
  }

  // GET /api/docker/containers?composePath=...
  if (req.method === "GET" && url.pathname === "/api/docker/containers") {
    const composePath = url.searchParams.get("composePath");
    if (!composePath) {
      return Response.json({ error: "composePath query parameter required" }, { status: 400 });
    }
    const containers = await docker.getContainers(composePath);
    return Response.json({ containers });
  }

  // POST /api/docker/up { composePath, service? }
  if (req.method === "POST" && url.pathname === "/api/docker/up") {
    const body = await req.json();
    const { composePath, service } = body;
    if (!composePath) {
      return Response.json({ error: "composePath required" }, { status: 400 });
    }
    const result = await docker.composeUp(composePath, service);
    return Response.json(result, { status: result.ok ? 200 : 500 });
  }

  // POST /api/docker/down { composePath, service? }
  if (req.method === "POST" && url.pathname === "/api/docker/down") {
    const body = await req.json();
    const { composePath, service } = body;
    if (!composePath) {
      return Response.json({ error: "composePath required" }, { status: 400 });
    }
    const result = await docker.composeDown(composePath, service);
    return Response.json(result, { status: result.ok ? 200 : 500 });
  }

  // GET /api/docker/logs?containerId=...&tail=50
  if (req.method === "GET" && url.pathname === "/api/docker/logs") {
    const containerId = url.searchParams.get("containerId");
    if (!containerId) {
      return Response.json({ error: "containerId query parameter required" }, { status: 400 });
    }
    const tail = parseInt(url.searchParams.get("tail") || "50");
    const logs = await docker.getContainerLogs(containerId, tail);
    return Response.json({ logs });
  }

  return null;
}
