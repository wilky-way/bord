import { getDb } from "./db";

export interface FeatureFlags {
  git: boolean;
  docker: boolean;
  sessions: boolean;
  providers: Record<string, boolean>;
}

const DEFAULT_FLAGS: FeatureFlags = {
  git: true,
  docker: true,
  sessions: true,
  providers: {
    claude: true,
    codex: true,
    opencode: true,
    gemini: true,
  },
};

export function getFeatureFlags(): FeatureFlags {
  const db = getDb();
  const row = db.query<{ value: string }, []>("SELECT value FROM app_state WHERE key = 'feature_flags'").get();
  if (!row) return { ...DEFAULT_FLAGS, providers: { ...DEFAULT_FLAGS.providers } };
  try {
    const parsed = JSON.parse(row.value);
    return {
      git: typeof parsed.git === "boolean" ? parsed.git : DEFAULT_FLAGS.git,
      docker: typeof parsed.docker === "boolean" ? parsed.docker : DEFAULT_FLAGS.docker,
      sessions: typeof parsed.sessions === "boolean" ? parsed.sessions : DEFAULT_FLAGS.sessions,
      providers: { ...DEFAULT_FLAGS.providers, ...(parsed.providers ?? {}) },
    };
  } catch {
    return { ...DEFAULT_FLAGS, providers: { ...DEFAULT_FLAGS.providers } };
  }
}

export function updateFeatureFlags(patch: Partial<FeatureFlags>): FeatureFlags {
  const current = getFeatureFlags();
  const updated: FeatureFlags = {
    git: patch.git ?? current.git,
    docker: patch.docker ?? current.docker,
    sessions: patch.sessions ?? current.sessions,
    providers: { ...current.providers, ...(patch.providers ?? {}) },
  };
  const db = getDb();
  db.run(
    "INSERT INTO app_state (key, value, updated_at) VALUES ('feature_flags', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [JSON.stringify(updated)],
  );
  return updated;
}

export function isFeatureEnabled(name: string): boolean {
  const flags = getFeatureFlags();
  if (name in flags && name !== "providers") return (flags as any)[name] as boolean;
  return true;
}

export function isProviderEnabled(id: string): boolean {
  const flags = getFeatureFlags();
  return flags.providers[id] ?? true;
}
