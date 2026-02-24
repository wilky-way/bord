import type { ILink, ILinkProvider, Terminal } from "ghostty-web";

const LOCAL_EDITOR_SCHEMES = new Set(["vscode:", "vscode-insiders:", "cursor:", "zed:"]);
const WRAP_LEADING = new Set(["(", "[", "{", "<", "\"", "'", "`"]);
const WRAP_TRAILING = new Set([")", "]", "}", ">", "\"", "'", "`", ",", ";", "!", "?", "."]);
const PATH_REFERENCE_REGEX = /(?:\.{1,2}[\\/]|[a-zA-Z]:[\\/]|\/)?(?:[\w.-]+[\\/])+[\w.~-]+(?::\d+(?::\d+)?)?(?:#L\d+(?:C\d+)?|#\d+(?::\d+)?)?/g;
const SPECIAL_FILENAMES = new Set([
  "Dockerfile",
  "Containerfile",
  "Makefile",
  "README",
  "LICENSE",
  "Gemfile",
  "Rakefile",
  "justfile",
]);

interface LinkPosition {
  line?: number;
  column?: number;
}

export interface ParsedTerminalFileLink extends LinkPosition {
  path: string;
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return num;
}

function decodeUriPath(pathname: string): string {
  const decoded = decodeURIComponent(pathname);
  if (/^\/[a-zA-Z]:[\\/]/.test(decoded)) return decoded.slice(1);
  return decoded;
}

function parseHashPosition(hash: string): LinkPosition {
  const lStyle = hash.match(/^#L(\d+)(?:C(\d+))?$/i);
  if (lStyle) {
    return {
      line: parsePositiveInt(lStyle[1] ?? null),
      column: parsePositiveInt(lStyle[2] ?? null),
    };
  }

  const plain = hash.match(/^#(\d+)(?::(\d+))?$/);
  if (!plain) return {};

  return {
    line: parsePositiveInt(plain[1] ?? null),
    column: parsePositiveInt(plain[2] ?? null),
  };
}

function parsePathSuffix(path: string): ParsedTerminalFileLink {
  const withPos = path.match(/^(.*?):(\d+)(?::(\d+))?$/);
  if (!withPos) return { path };

  const line = parsePositiveInt(withPos[2] ?? null);
  if (!line) return { path };

  return {
    path: withPos[1]!,
    line,
    column: parsePositiveInt(withPos[3] ?? null),
  };
}

function isAbsoluteFilePath(path: string): boolean {
  return path.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(path);
}

function parseUrl(url: URL): ParsedTerminalFileLink | null {
  const isFileUri = url.protocol === "file:";
  const isEditorUri = LOCAL_EDITOR_SCHEMES.has(url.protocol);
  if (!isFileUri && !isEditorUri) return null;

  if (isFileUri && url.hostname && url.hostname !== "localhost") return null;
  if (isEditorUri && url.hostname !== "file") return null;

  const suffix = parsePathSuffix(decodeUriPath(url.pathname));
  if (!isAbsoluteFilePath(suffix.path)) return null;

  const queryLine = parsePositiveInt(url.searchParams.get("line"));
  const queryColumn = parsePositiveInt(url.searchParams.get("column")) ?? parsePositiveInt(url.searchParams.get("col"));
  const hash = parseHashPosition(url.hash);

  return {
    path: suffix.path,
    line: queryLine ?? hash.line ?? suffix.line,
    column: queryColumn ?? hash.column ?? suffix.column,
  };
}

export function parseTerminalFileLink(value: string): ParsedTerminalFileLink | null {
  try {
    return parseUrl(new URL(value));
  } catch {
    return null;
  }
}

function normalizePosixPath(path: string): string {
  const parts = path.split("/");
  const stack: string[] = [];

  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }

  return `/${stack.join("/")}`;
}

function resolvePosixPath(cwd: string, relative: string): string {
  if (relative.startsWith("/")) return normalizePosixPath(relative);
  const cleanCwd = cwd.endsWith("/") ? cwd.slice(0, -1) : cwd;
  const cleanRelative = relative.startsWith("./") ? relative.slice(2) : relative;
  return normalizePosixPath(`${cleanCwd}/${cleanRelative}`);
}

function hasLikelyFilename(path: string): boolean {
  const basename = path.replace(/\\/g, "/").split("/").pop() ?? "";
  if (!basename || basename === "." || basename === "..") return false;
  if (SPECIAL_FILENAMES.has(basename)) return true;
  if (basename.startsWith(".")) return basename.length > 1;
  return basename.includes(".");
}

function parsePlainFileReference(token: string, cwd?: string): ParsedTerminalFileLink | null {
  if (token.includes("://") || token.startsWith("~/")) return null;

  let path = token;
  let line: number | undefined;
  let column: number | undefined;

  const hashMatch = path.match(/(#L\d+(?:C\d+)?|#\d+(?::\d+)?)$/i);
  if (hashMatch) {
    const hashPos = parseHashPosition(hashMatch[1]!);
    line = hashPos.line;
    column = hashPos.column;
    path = path.slice(0, -hashMatch[1]!.length);
  }

  const suffix = path.match(/:(\d+)(?::(\d+))?$/);
  if (suffix) {
    const suffixLine = parsePositiveInt(suffix[1] ?? null);
    if (suffixLine) {
      line = suffixLine;
      column = parsePositiveInt(suffix[2] ?? null) ?? column;
      path = path.slice(0, -suffix[0].length);
    }
  }

  if (!(path.includes("/") || path.includes("\\"))) return null;

  const normalizedPath = path.replace(/\\/g, "/");
  const cleanedPath = normalizedPath.startsWith("a/") || normalizedPath.startsWith("b/")
    ? normalizedPath.slice(2)
    : normalizedPath;
  const absolutePath = isAbsoluteFilePath(normalizedPath)
    ? normalizedPath
    : cwd
      ? resolvePosixPath(cwd, cleanedPath)
      : null;

  if (!absolutePath || !hasLikelyFilename(absolutePath)) return null;

  return { path: absolutePath, line, column };
}

function trimToken(raw: string): { value: string; lead: number; trail: number } {
  let start = 0;
  let end = raw.length;

  while (start < end && WRAP_LEADING.has(raw[start]!)) start++;
  while (end > start && WRAP_TRAILING.has(raw[end - 1]!)) end--;

  return {
    value: raw.slice(start, end),
    lead: start,
    trail: raw.length - end,
  };
}

function buildLink(
  row: number,
  start: number,
  end: number,
  parsed: ParsedTerminalFileLink,
  onOpen: (link: ParsedTerminalFileLink) => void,
): ILink {
  return {
    text: parsed.path,
    range: {
      start: { x: start, y: row },
      end: { x: end, y: row },
    },
    activate(event) {
      if (typeof event.button === "number" && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      onOpen(parsed);
    },
  };
}

function findRangeForHyperlinkId(terminal: Terminal, row: number, col: number, hyperlinkId: number) {
  const line = terminal.buffer.active.getLine(row);
  if (!line) {
    return {
      start: { x: col, y: row },
      end: { x: col, y: row },
    };
  }

  let start = col;
  while (start > 0) {
    const prev = line.getCell(start - 1);
    if (!prev || prev.getHyperlinkId() !== hyperlinkId) break;
    start--;
  }

  let end = col;
  while (end < line.length - 1) {
    const next = line.getCell(end + 1);
    if (!next || next.getHyperlinkId() !== hyperlinkId) break;
    end++;
  }

  return {
    start: { x: start, y: row },
    end: { x: end, y: row },
  };
}

function scanPlainTextLinks(
  terminal: Terminal,
  row: number,
  cwd: string | undefined,
  onOpen: (link: ParsedTerminalFileLink) => void,
  dedupe: Set<string>,
): ILink[] {
  const line = terminal.buffer.active.getLine(row);
  if (!line) return [];

  const text = line.translateToString(false, 0, line.length);
  const tokenRegex = /\S+/g;
  const links: ILink[] = [];

  for (const match of text.matchAll(tokenRegex)) {
    const rawToken = match[0];
    if (!rawToken) continue;

    const tokenIndex = match.index ?? 0;
    const trimmed = trimToken(rawToken);
    if (trimmed.value) {
      const parsedUri = parseTerminalFileLink(trimmed.value);
      if (parsedUri) {
        const start = tokenIndex + trimmed.lead;
        const end = tokenIndex + rawToken.length - trimmed.trail - 1;
        if (end >= start) {
          const key = `${start}:${end}:${parsedUri.path}:${parsedUri.line ?? ""}:${parsedUri.column ?? ""}`;
          if (!dedupe.has(key)) {
            dedupe.add(key);
            links.push(buildLink(row, start, end, parsedUri, onOpen));
          }
        }
      }
    }

    for (const pathMatch of rawToken.matchAll(PATH_REFERENCE_REGEX)) {
      const candidate = pathMatch[0];
      if (!candidate) continue;

      const candidateIndex = pathMatch.index ?? 0;
      const before = rawToken.slice(0, candidateIndex);
      if (before.includes("://")) continue;

      const parsed = parsePlainFileReference(candidate, cwd);
      if (!parsed) continue;

      const start = tokenIndex + candidateIndex;
      const end = start + candidate.length - 1;
      if (end < start) continue;

      const key = `${start}:${end}:${parsed.path}:${parsed.line ?? ""}:${parsed.column ?? ""}`;
      if (dedupe.has(key)) continue;

      dedupe.add(key);
      links.push(buildLink(row, start, end, parsed, onOpen));
    }
  }

  return links;
}

export function createTerminalFileLinkProvider(
  terminal: Terminal,
  onOpen: (link: ParsedTerminalFileLink) => void,
  getCwd?: () => string | undefined,
): ILinkProvider {
  return {
    provideLinks(row, callback) {
      const line = terminal.buffer.active.getLine(row);
      if (!line) {
        callback(undefined);
        return;
      }

      const links: ILink[] = [];
      const dedupe = new Set<string>();
      const seenHyperlinkIds = new Set<number>();

      if (terminal.wasmTerm) {
        for (let col = 0; col < line.length; col++) {
          const cell = line.getCell(col);
          const hyperlinkId = cell?.getHyperlinkId() ?? 0;
          if (hyperlinkId === 0 || seenHyperlinkIds.has(hyperlinkId)) continue;

          seenHyperlinkIds.add(hyperlinkId);
          const uri = terminal.wasmTerm.getHyperlinkUri(hyperlinkId);
          if (!uri) continue;

          const parsed = parseTerminalFileLink(uri);
          if (!parsed) continue;

          const range = findRangeForHyperlinkId(terminal, row, col, hyperlinkId);
          const key = `${range.start.x}:${range.end.x}:${parsed.path}:${parsed.line ?? ""}:${parsed.column ?? ""}`;
          if (dedupe.has(key)) continue;

          dedupe.add(key);
          links.push(buildLink(row, range.start.x, range.end.x, parsed, onOpen));
        }
      }

      links.push(...scanPlainTextLinks(terminal, row, getCwd?.(), onOpen, dedupe));
      callback(links.length > 0 ? links : undefined);
    },
  };
}
