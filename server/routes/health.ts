export function healthRoute(_req: Request): Response {
  return Response.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}
