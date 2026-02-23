import { describe, test, expect, afterAll } from "bun:test";
import { mkdirSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { clipboardRoutes } from "./clipboard";

/**
 * Clipboard route tests. Uses real fs operations since the route
 * writes to tmpdir anyway.
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

describe("clipboardRoutes", () => {
  test("POST /api/clipboard/image requires base64 data", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/clipboard/image", {});
    const res = await clipboardRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("base64");
  });

  test("POST /api/clipboard/image rejects non-string base64", async () => {
    const [req, url] = makeReq("POST", "http://localhost/api/clipboard/image", { base64: 123 });
    const res = await clipboardRoutes(req, url);
    expect(res!.status).toBe(400);
  });

  test("POST /api/clipboard/image succeeds with valid data", async () => {
    const base64 = Buffer.from("tiny image data").toString("base64");
    const [req, url] = makeReq("POST", "http://localhost/api/clipboard/image", {
      base64,
      mimeType: "image/png",
    });
    const res = await clipboardRoutes(req, url);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.path).toContain("bord-paste-");
    expect(body.path).toContain(".png");
    // Verify file was actually written
    const written = readFileSync(body.path);
    expect(written.toString()).toBe("tiny image data");
    // Clean up
    rmSync(body.path, { force: true });
  });

  test("POST /api/clipboard/image rejects oversized image", async () => {
    // Create a base64 string that decodes to > 10MB
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024, "x");
    const base64 = largeBuffer.toString("base64");
    const [req, url] = makeReq("POST", "http://localhost/api/clipboard/image", {
      base64,
    });
    const res = await clipboardRoutes(req, url);
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toContain("maximum size");
  });

  test("POST /api/clipboard/image uses jpeg extension for jpeg mime", async () => {
    const base64 = Buffer.from("test").toString("base64");
    const [req, url] = makeReq("POST", "http://localhost/api/clipboard/image", {
      base64,
      mimeType: "image/jpeg",
    });
    const res = await clipboardRoutes(req, url);
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.path).toContain(".jpg");
    rmSync(body.path, { force: true });
  });

  test("returns null for unknown paths", async () => {
    const [req, url] = makeReq("GET", "http://localhost/api/clipboard/unknown");
    const res = await clipboardRoutes(req, url);
    expect(res).toBeNull();
  });
});
