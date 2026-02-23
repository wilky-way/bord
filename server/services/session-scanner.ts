import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { registerServerProvider } from "./provider-registry";

export const PROVIDERS = ["claude", "codex", "opencode", "gemini"] as const;
export type Provider = (typeof PROVIDERS)[number];

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}

export interface SessionInfo {
  id: string;
  title: string;
  projectPath: string;
  startedAt: string;
  updatedAt: string;
  messageCount: number;
  provider: Provider;
}

interface IndexEntry {
  sessionId: string;
  summary?: string;
  firstPrompt?: string;
  messageCount?: number;
  created?: string;
  modified?: string;
  projectPath?: string;
  lastUpdated?: string;
}

const CLAUDE_PROJECTS_DIR = join(homedir(), ".claude", "projects");
const CODEX_SESSIONS_DIR = join(homedir(), ".codex", "sessions");
const OPENCODE_SESSIONS_DIRS = [
  join(homedir(), ".local", "share", "opencode", "storage", "session"),
  join(homedir(), "Library", "Application Support", "opencode", "storage", "session"),
];

export function normalizeSessionTitle(title: string, maxLength: number = 80): string {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled Session";
  return normalized.slice(0, maxLength);
}

export function normalizeSessionTime(raw: unknown, fallback: string): string {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

async function existingOpenCodeSessionDirs(): Promise<string[]> {
  const dirs: string[] = [];
  for (const dir of OPENCODE_SESSIONS_DIRS) {
    const dirStat = await stat(dir).catch(() => null);
    if (dirStat?.isDirectory()) {
      dirs.push(dir);
    }
  }
  return dirs;
}

/** Decode Claude project dir name back to an absolute path */
export function decodeDirToPath(dir: string): string {
  // Dir names use `-` as separator. A leading `-` encodes the root `/`,
  // so naive "/ " + dir.replace(/-/g, "/") produces "//Users/..." — collapse it.
  return ("/" + dir.replace(/-/g, "/")).replace(/\/+/g, "/");
}

async function readSessionIndex(
  projectDir: string,
): Promise<Map<string, IndexEntry>> {
  const map = new Map<string, IndexEntry>();
  try {
    const raw = await readFile(join(projectDir, "sessions-index.json"), "utf-8");
    const parsed = JSON.parse(raw);
    // Handle { version, entries: [...] } envelope, flat array, or object keyed by session id
    let entries: IndexEntry[];
    if (parsed.entries && Array.isArray(parsed.entries)) {
      entries = parsed.entries;
    } else if (Array.isArray(parsed)) {
      entries = parsed;
    } else {
      entries = Object.entries(parsed).map(([k, v]: [string, any]) => ({
        sessionId: k,
        ...(typeof v === "object" && v !== null ? v : {}),
      }));
    }
    for (const entry of entries) {
      if (entry.sessionId) {
        map.set(entry.sessionId, entry);
      }
    }
  } catch {
    // No index file or parse error — fall back to JSONL scanning
  }
  return map;
}

export async function scanCodexSessions(projectPath?: string): Promise<SessionInfo[]> {
  const sessions: SessionInfo[] = [];
  try {
    // Codex stores sessions under ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
    const years = await readdir(CODEX_SESSIONS_DIR).catch((): string[] => []);
    for (const year of years) {
      const months = await readdir(join(CODEX_SESSIONS_DIR, year)).catch((): string[] => []);
      for (const month of months) {
        const days = await readdir(join(CODEX_SESSIONS_DIR, year, month)).catch((): string[] => []);
        for (const day of days) {
          const dayDir = join(CODEX_SESSIONS_DIR, year, month, day);
          const dayStat = await stat(dayDir).catch(() => null);
          if (!dayStat?.isDirectory()) continue;

          const files = await readdir(dayDir).catch((): string[] => []);
          for (const file of files.filter((f: string) => f.endsWith(".jsonl"))) {
            const filePath = join(dayDir, file);
            const fileStat = await stat(filePath).catch(() => null);
            if (!fileStat) continue;

            let sessionId = "";
            let title = "Untitled Session";
            let cwd = "";
            let timestamp = "";
            let messageCount = 0;

            // Parse JSONL: first line is session_meta, then scan for user_message events
            try {
              const content = await readFile(filePath, "utf-8");
              const lines = content.split("\n").filter(Boolean);

              for (const line of lines) {
                try {
                  const obj = JSON.parse(line);
                  if (obj.type === "session_meta") {
                    const p = obj.payload ?? obj;
                    sessionId = p.id ?? "";
                    cwd = p.cwd ?? "";
                    timestamp = p.timestamp ?? "";
                  } else if (obj.type === "event_msg") {
                    const p = obj.payload ?? {};
                    if (p.type === "user_message") {
                      messageCount++;
                      if (title === "Untitled Session" && p.message) {
                        // Strip IDE context prefix, get the actual request
                        const msg = typeof p.message === "string" ? p.message : "";
                        const reqMatch = msg.match(/My request for Codex:\s*\n?([\s\S]*)/i);
                        const text = reqMatch ? reqMatch[1].trim() : msg.trim();
                        if (text) title = normalizeSessionTitle(text, 80);
                      }
                    } else if (p.type === "agent_message" || p.type === "agent_reasoning") {
                      messageCount++;
                    }
                  }
                } catch {
                  // Skip malformed lines
                }
              }
            } catch {
              // Skip unreadable files
            }

            if (!sessionId) {
              // Fallback: extract UUID from filename (rollout-YYYY-MM-DDTHH-MM-SS-UUID.jsonl)
              const match = file.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
              sessionId = match?.[1] ?? file.replace(".jsonl", "");
            }

            // Filter by projectPath using cwd
            if (projectPath && cwd) {
              const normalizedProject = projectPath.endsWith("/") ? projectPath : projectPath + "/";
              const normalizedCwd = cwd.endsWith("/") ? cwd : cwd + "/";
              if (cwd !== projectPath && !normalizedCwd.startsWith(normalizedProject) && !normalizedProject.startsWith(normalizedCwd)) {
                continue;
              }
            }

            // Skip sessions with no usable path
            if (!cwd) continue;

            sessions.push({
              id: sessionId,
              title: normalizeSessionTitle(title, 80),
              projectPath: cwd,
              startedAt: timestamp || fileStat.birthtime.toISOString(),
              updatedAt: fileStat.mtime.toISOString(),
              messageCount,
              provider: "codex",
            });
          }
        }
      }
    }
  } catch {
    // ~/.codex/sessions/ may not exist
  }
  sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return sessions;
}

export async function scanOpenCodeSessions(projectPath?: string): Promise<SessionInfo[]> {
  const sessions: SessionInfo[] = [];
  try {
    // OpenCode stores sessions as JSON files under .../storage/session/{projectHash}/*.json
    const baseDirs = await existingOpenCodeSessionDirs();
    for (const baseDir of baseDirs) {
      const projectDirs = await readdir(baseDir).catch((): string[] => []);
      for (const dir of projectDirs) {
        const dirPath = join(baseDir, dir);
        const dirStat = await stat(dirPath).catch(() => null);
        if (!dirStat?.isDirectory()) continue;

        const files = await readdir(dirPath).catch((): string[] => []);
        for (const file of files.filter((f: string) => f.endsWith(".json"))) {
          const filePath = join(dirPath, file);
          try {
            const fileStat = await stat(filePath).catch(() => null);
            if (!fileStat) continue;
            const raw = await readFile(filePath, "utf-8");
            const session = JSON.parse(raw);

            const cwd = session.directory ?? "";
            const title = normalizeSessionTitle(session.title || session.slug || "Untitled Session", 80);
            const sessionId = session.id ?? file.replace(".json", "");

            // Filter by projectPath
            if (projectPath && cwd) {
              const normalizedProject = projectPath.endsWith("/") ? projectPath : projectPath + "/";
              const normalizedCwd = cwd.endsWith("/") ? cwd : cwd + "/";
              if (cwd !== projectPath && !normalizedCwd.startsWith(normalizedProject) && !normalizedProject.startsWith(normalizedCwd)) {
                continue;
              }
            }

            if (!cwd) continue;

            const created = normalizeSessionTime(session.time?.created, fileStat.birthtime.toISOString());
            const updated = normalizeSessionTime(session.time?.updated, fileStat.mtime.toISOString());

            sessions.push({
              id: sessionId,
              title,
              projectPath: cwd,
              startedAt: created,
              updatedAt: updated,
              messageCount: (session.summary?.files ?? 0) > 0 ? 1 : 0,
              provider: "opencode",
            });
          } catch {
            // Skip unreadable files
          }
        }
      }
    }
  } catch {
    // OpenCode sessions dir may not exist
  }

  const deduped = new Map<string, SessionInfo>();
  for (const session of sessions) {
    const key = `${session.provider}:${session.id}:${session.projectPath}`;
    const existing = deduped.get(key);
    if (!existing || existing.updatedAt < session.updatedAt) {
      deduped.set(key, session);
    }
  }

  const result = [...deduped.values()];
  result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return result;
}

export async function scanGeminiSessions(_projectPath?: string): Promise<SessionInfo[]> {
  return [];
}

export async function scanClaudeSessions(projectPath?: string): Promise<SessionInfo[]> {
  const sessions: SessionInfo[] = [];

  try {
    const projectDirs = await readdir(CLAUDE_PROJECTS_DIR);

    for (const dir of projectDirs) {
      // Filter by project path if specified
      if (projectPath) {
        // Check index entries for projectPath match before falling back to dir decoding
        const index = await readSessionIndex(join(CLAUDE_PROJECTS_DIR, dir));
        const hasIndexMatch = [...index.values()].some((e) => e.projectPath === projectPath);
        if (!hasIndexMatch) {
          const decoded = decodeDirToPath(dir);
          if (!decoded.includes(projectPath)) continue;
        }
      }

      const projectDir = join(CLAUDE_PROJECTS_DIR, dir);
      const dirStat = await stat(projectDir).catch(() => null);
      if (!dirStat?.isDirectory()) continue;

      // Try reading the sessions index first
      const index = await readSessionIndex(projectDir);

      const files = await readdir(projectDir).catch((): string[] => []);
      const jsonlFiles = files.filter((f: string) => f.endsWith(".jsonl"));

      for (const file of jsonlFiles) {
        const sessionId = file.replace(".jsonl", "");
        const filePath = join(projectDir, file);
        const fileStat = await stat(filePath).catch(() => null);
        if (!fileStat) continue;

        const indexEntry = index.get(sessionId);

        let title = "Untitled Session";
        let messageCount = 0;

        if (indexEntry) {
          // Prefer index data: summary > firstPrompt (truncated) > fallback
          if (indexEntry.summary) {
            title = normalizeSessionTitle(indexEntry.summary, 80);
          } else if (indexEntry.firstPrompt) {
            title = normalizeSessionTitle(indexEntry.firstPrompt, 60);
          }
          if (indexEntry.messageCount != null) {
            messageCount = indexEntry.messageCount;
          }
        }

        // Fall back to JSONL parsing if index didn't provide a title
        if (title === "Untitled Session" || (messageCount === 0 && !indexEntry?.messageCount)) {
          const content = await readFile(filePath, "utf-8").catch(() => "");
          const lines = content.split("\n").filter(Boolean);

          let jsonlCount = 0;
          for (const line of lines) {
            try {
              const msg = JSON.parse(line);
              // Skip non-message entries (e.g. file-history-snapshot)
              if (msg.type === "user" || msg.type === "human" || msg.type === "assistant") {
                jsonlCount++;
              }
              if (title === "Untitled Session" && (msg.type === "user" || msg.type === "human")) {
                // Content can be: msg.message (string), msg.message.content (string or array), or msg.content
                let text = "";
                if (typeof msg.message === "string") {
                  text = msg.message;
                } else if (msg.message?.content) {
                  const c = msg.message.content;
                  if (typeof c === "string") {
                    text = c;
                  } else if (Array.isArray(c)) {
                    const first = c.find((item: any) => item.type === "text" || typeof item === "string");
                    text = typeof first === "string" ? first : first?.text ?? "";
                  }
                } else if (typeof msg.content === "string") {
                  text = msg.content;
                }
                if (text) title = normalizeSessionTitle(text, 80);
              }
            } catch {
              // Skip malformed lines
            }
          }
          if (messageCount === 0) messageCount = jsonlCount;
        }

        // Skip sessions with no actual conversation (only file-history-snapshot, system, etc.)
        if (messageCount === 0 && title === "Untitled Session") continue;

        sessions.push({
          id: sessionId,
          title: normalizeSessionTitle(title, 80),
          projectPath: indexEntry?.projectPath ?? decodeDirToPath(dir),
          startedAt: indexEntry?.created ?? fileStat.birthtime.toISOString(),
          updatedAt: indexEntry?.modified ?? indexEntry?.lastUpdated ?? fileStat.mtime.toISOString(),
          messageCount,
          provider: "claude",
        });
      }
    }
  } catch {
    // ~/.claude/projects/ may not exist
  }

  // Sort by most recently updated
  sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return sessions;
}

// Register all providers with the server registry
registerServerProvider({ id: "claude", scanSessions: scanClaudeSessions });
registerServerProvider({ id: "codex", scanSessions: scanCodexSessions });
registerServerProvider({ id: "opencode", scanSessions: scanOpenCodeSessions });
registerServerProvider({ id: "gemini", scanSessions: scanGeminiSessions });

export async function scanSessions(projectPath?: string, provider?: Provider): Promise<SessionInfo[]> {
  switch (provider) {
    case "claude": return scanClaudeSessions(projectPath);
    case "codex": return scanCodexSessions(projectPath);
    case "opencode": return scanOpenCodeSessions(projectPath);
    case "gemini": return scanGeminiSessions(projectPath);
    default: return scanClaudeSessions(projectPath);
  }
}

/** @internal — exported for testing */
export { readSessionIndex as _readSessionIndex };
