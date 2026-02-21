import { createSignal } from "solid-js";
import { api } from "../lib/api";
import type { SessionInfo } from "./types";

const [sessions, setSessions] = createSignal<SessionInfo[]>([]);
const [sessionsLoading, setSessionsLoading] = createSignal(false);

export { sessions, sessionsLoading };

export async function loadSessions(project?: string) {
  setSessionsLoading(true);
  try {
    const data = await api.listSessions(project);
    setSessions(data);
  } catch {
    setSessions([]);
  } finally {
    setSessionsLoading(false);
  }
}
