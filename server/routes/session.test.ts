import { describe, test, expect, mock, beforeEach } from "bun:test";
import type { SessionInfo } from "../services/session-scanner";

const scanSessionsMock = mock();

mock.module("../services/session-scanner", () => ({
  scanSessions: scanSessionsMock,
  isProvider: (v: string) => ["claude", "codex", "opencode", "gemini"].includes(v),
  PROVIDERS: ["claude", "codex", "opencode", "gemini"],
  normalizeSessionTitle: (t: string) => t.trim() || "Untitled Session",
  normalizeSessionTime: (raw: unknown, fb: string) => (typeof raw === "string" && raw.trim() ? raw : fb),
  decodeDirToPath: (d: string) => d.replace(/-/g, "/"),
  _readSessionIndex: async () => new Map(),
}));

const { sessionRoutes } = await import("./session");

function makeReq(method: string, urlStr: string): [Request, URL] {
  const url = new URL(urlStr, "http://localhost");
  return [new Request(url.toString(), { method }), url];
}

const fakeSessions: SessionInfo[] = [
  {
    id: "sess-1",
    title: "Fix auth bug",
    projectPath: "/home/project",
    startedAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T01:00:00Z",
    messageCount: 10,
    provider: "claude",
  },
  {
    id: "sess-2",
    title: "Add tests",
    projectPath: "/home/other",
    startedAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T01:00:00Z",
    messageCount: 5,
    provider: "claude",
  },
];

beforeEach(() => {
  scanSessionsMock.mockReset();
  scanSessionsMock.mockResolvedValue(fakeSessions);
});

describe("sessionRoutes", () => {
  test("GET /api/sessions returns session list", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/sessions");
    const res = await sessionRoutes(req, url);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe("sess-1");
  });

  test("GET /api/sessions?provider=claude filters by provider", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/sessions?provider=claude");
    await sessionRoutes(req, url);
    expect(scanSessionsMock).toHaveBeenCalledWith(undefined, "claude");
  });

  test("GET /api/sessions?project=/path filters by cwd", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/sessions?project=/home/project");
    await sessionRoutes(req, url);
    expect(scanSessionsMock).toHaveBeenCalledWith("/home/project", undefined);
  });

  test("GET /api/sessions with missing params returns all", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/sessions");
    const res = await sessionRoutes(req, url);
    expect(res!.status).toBe(200);
    expect(scanSessionsMock).toHaveBeenCalledWith(undefined, undefined);
  });

  test("GET /api/sessions handles scanner error", async () => {
    scanSessionsMock.mockRejectedValue(new Error("scan failed"));
    const [req, url] = makeReq("GET", "http://localhost/api/sessions");
    try {
      await sessionRoutes(req, url);
    } catch (e) {
      // Expected: unhandled error propagates
      expect((e as Error).message).toBe("scan failed");
    }
  });

  test("response includes correct session shape", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/sessions");
    const res = await sessionRoutes(req, url);
    const body = await res!.json();
    const session = body[0];
    expect(session).toHaveProperty("id");
    expect(session).toHaveProperty("title");
    expect(session).toHaveProperty("projectPath");
    expect(session).toHaveProperty("startedAt");
    expect(session).toHaveProperty("updatedAt");
    expect(session).toHaveProperty("messageCount");
    expect(session).toHaveProperty("provider");
  });

  test("invalid provider parameter returns 400", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/sessions?provider=invalid");
    const res = await sessionRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("Invalid provider");
  });
});
