import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { MAX_CLIPBOARD_IMAGE_SIZE } from "../lib/validate";

const PASTE_DIR = join(tmpdir(), "bord-paste");

// Ensure paste directory exists
let dirReady: Promise<void> | null = null;
function ensureDir(): Promise<void> {
  dirReady ??= mkdir(PASTE_DIR, { recursive: true }).then(() => {});
  return dirReady;
}

export async function clipboardRoutes(req: Request, url: URL): Promise<Response | null> {
  if (url.pathname === "/api/clipboard/image" && req.method === "POST") {
    try {
      const body = await req.json() as { base64: string; mimeType?: string };
      if (!body.base64 || typeof body.base64 !== "string") {
        return Response.json({ error: "Missing base64 data" }, { status: 400 });
      }

      const mimeType = body.mimeType ?? "image/png";
      const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg"
        : mimeType.includes("gif") ? "gif"
        : mimeType.includes("webp") ? "webp"
        : "png";

      await ensureDir();
      const filename = `bord-paste-${randomUUID()}.${ext}`;
      const filePath = join(PASTE_DIR, filename);

      const buffer = Buffer.from(body.base64, "base64");
      if (buffer.byteLength > MAX_CLIPBOARD_IMAGE_SIZE) {
        return Response.json(
          { error: `Image exceeds maximum size of ${MAX_CLIPBOARD_IMAGE_SIZE} bytes` },
          { status: 400 },
        );
      }
      await writeFile(filePath, buffer);

      return Response.json({ path: filePath });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Failed to save image" },
        { status: 500 },
      );
    }
  }

  return null;
}
