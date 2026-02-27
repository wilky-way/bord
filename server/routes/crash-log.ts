import { getRecentCrashes, getCrashLogPath } from "../services/crash-log";

export function crashLogRoutes(req: Request, url: URL): Response | null {
  if (url.pathname === "/api/crash-log" && req.method === "GET") {
    return Response.json({
      entries: getRecentCrashes(50),
      logPath: getCrashLogPath(),
    });
  }
  return null;
}
