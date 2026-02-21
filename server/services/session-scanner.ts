import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

export interface SessionInfo {
  id: string;
  title: string;
  projectPath: string;
  startedAt: string;
  updatedAt: string;
  messageCount: number;
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

/** Decode Claude project dir name back to an absolute path */
function decodeDirToPath(dir: string): string {
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

export async function scanSessions(projectPath?: string): Promise<SessionInfo[]> {
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
      const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

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
            title = indexEntry.summary;
          } else if (indexEntry.firstPrompt) {
            title = indexEntry.firstPrompt.slice(0, 60);
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
                if (text) title = text.slice(0, 80);
              }
            } catch {
              // Skip malformed lines
            }
          }
          if (messageCount === 0) messageCount = jsonlCount;
        }

        sessions.push({
          id: sessionId,
          title,
          projectPath: indexEntry?.projectPath ?? decodeDirToPath(dir),
          startedAt: indexEntry?.created ?? fileStat.birthtime.toISOString(),
          updatedAt: indexEntry?.modified ?? indexEntry?.lastUpdated ?? fileStat.mtime.toISOString(),
          messageCount,
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
