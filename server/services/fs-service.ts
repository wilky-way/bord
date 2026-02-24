import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, extname } from "path";

const EXT_LANG: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript",
  ".json": "json", ".md": "markdown", ".css": "css", ".html": "html", ".xml": "xml",
  ".yaml": "yaml", ".yml": "yaml", ".toml": "toml", ".sh": "bash", ".bash": "bash",
  ".zsh": "bash", ".py": "python", ".rs": "rust", ".go": "go", ".sql": "sql",
  ".graphql": "graphql", ".svelte": "xml", ".vue": "xml", ".scss": "scss",
  ".less": "less", ".java": "java", ".kt": "kotlin", ".swift": "swift",
  ".rb": "ruby", ".php": "php", ".c": "c", ".cpp": "cpp", ".h": "c",
  ".zig": "zig", ".lua": "lua", ".txt": "plaintext", ".env": "plaintext",
  ".dockerfile": "dockerfile", ".csv": "plaintext", ".lock": "plaintext",
};

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".zip", ".tar", ".gz", ".bz2", ".xz",
  ".pdf", ".exe", ".dll", ".so", ".dylib",
  ".wasm", ".mp3", ".mp4", ".wav", ".ogg",
]);

export interface DirEntry {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink";
  size: number;
  modified: number;
  isHidden: boolean;
}

export function listDir(dirPath: string): { entries: DirEntry[] } {
  const resolved = resolve(dirPath);
  const raw = readdirSync(resolved, { withFileTypes: true });
  const entries: DirEntry[] = raw.map((e) => {
    const fullPath = resolve(resolved, e.name);
    let size = 0, modified = 0;
    try { const s = statSync(fullPath); size = s.size; modified = s.mtimeMs; } catch {}
    return {
      name: e.name,
      path: fullPath,
      type: e.isSymbolicLink() ? "symlink" : e.isDirectory() ? "dir" : "file",
      size,
      modified,
      isHidden: e.name.startsWith("."),
    };
  });
  // Sort: dirs first, then alpha (case-insensitive)
  entries.sort((a, b) => {
    if (a.type === "dir" && b.type !== "dir") return -1;
    if (a.type !== "dir" && b.type === "dir") return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  return { entries };
}

export function readFile(filePath: string, maxBytes = 1024 * 1024): {
  content: string; truncated: boolean; size: number; language: string; binary: boolean;
} {
  const resolved = resolve(filePath);
  const stat = statSync(resolved);
  const ext = extname(resolved).toLowerCase();
  const language = EXT_LANG[ext] ?? "plaintext";
  if (BINARY_EXTENSIONS.has(ext)) {
    return { content: "", truncated: false, size: stat.size, language, binary: true };
  }
  const buf = readFileSync(resolved);
  const truncated = buf.length > maxBytes;
  const content = (truncated ? buf.subarray(0, maxBytes) : buf).toString("utf-8");
  return { content, truncated, size: stat.size, language, binary: false };
}

export function writeFile(filePath: string, content: string): { ok: boolean; error?: string } {
  try {
    writeFileSync(resolve(filePath), content, "utf-8");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
