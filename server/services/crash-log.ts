import { join, dirname } from "path";
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "fs";

const MAX_FILE_SIZE = 512 * 1024; // 512KB
const MAX_MEMORY_ENTRIES = 100;

export interface CrashLogEntry {
  timestamp: string;
  level: "error" | "warn" | "fatal";
  source: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

const recentEntries: CrashLogEntry[] = [];
let logPath: string | null = null;

function resolveLogPath(): string {
  if (logPath) return logPath;

  const dbPath = process.env.BORD_DB_PATH;
  if (dbPath) {
    logPath = join(dirname(dbPath), "crash.log");
  } else {
    logPath = join(process.cwd(), "crash.log");
  }
  return logPath;
}

export function logCrash(entry: Omit<CrashLogEntry, "timestamp">) {
  const full: CrashLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  // In-memory ring
  recentEntries.push(full);
  if (recentEntries.length > MAX_MEMORY_ENTRIES) {
    recentEntries.shift();
  }

  const path = resolveLogPath();
  const line = JSON.stringify(full) + "\n";

  try {
    // Rotate if file exists and is too large
    if (existsSync(path)) {
      const stat = Bun.file(path);
      if (stat.size > MAX_FILE_SIZE) {
        try {
          const text = readFileSync(path, "utf-8");
          const lines = text.split("\n").filter(Boolean);
          const half = Math.floor(lines.length / 2);
          writeFileSync(path, lines.slice(half).join("\n") + "\n");
        } catch {
          // Rotation failed — continue writing anyway
        }
      }
    }

    appendFileSync(path, line);
  } catch {
    // Last resort — at least log to console
    console.error("[bord][crash-log] failed to write crash log:", full);
  }
}

export function getRecentCrashes(limit = 50): CrashLogEntry[] {
  return recentEntries.slice(-limit).reverse();
}

export function getCrashLogPath(): string {
  return resolveLogPath();
}
