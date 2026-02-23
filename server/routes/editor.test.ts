import { describe, test, expect } from "bun:test";
import { editorRoutes } from "./editor";

/**
 * Editor route tests focused on input validation.
 */

function makeReq(method: string, urlStr: string, body?: unknown): [Request, URL] {
  const url = new URL(urlStr, "http://localhost");
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return [new Request(url.toString(), init), url];
}

describe("editorRoutes input validation", () => {
  test("POST /api/editor/open requires cwd", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/editor/open", {
      editor: "vscode",
    });
    const res = await editorRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("cwd");
  });

  test("POST /api/editor/open requires valid editor", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/editor/open", {
      cwd: "/tmp",
    });
    const res = await editorRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("editor");
  });

  test("POST /api/editor/open rejects unknown editor", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/editor/open", {
      cwd: "/tmp",
      editor: "vim",
    });
    const res = await editorRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("returns null for unknown paths", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/editor/unknown");
    const res = await editorRoutes(req, url);
    expect(res).toBeNull();
  });
});
