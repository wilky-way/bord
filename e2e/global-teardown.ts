const SERVER_URL = process.env.BORD_SERVER_URL ?? "http://localhost:4200";

export default async function globalTeardown() {
  // Clean up PTY sessions to avoid orphaned processes
  try {
    const res = await fetch(`${SERVER_URL}/api/pty`);
    if (res.ok) {
      const sessions: Array<{ id: string }> = await res.json();
      for (const session of sessions) {
        try {
          await fetch(`${SERVER_URL}/api/pty/${session.id}`, { method: "DELETE" });
        } catch {
          // Best-effort cleanup
        }
      }
      if (sessions.length > 0) {
        console.log(`[e2e] Cleaned up ${sessions.length} PTY session(s)`);
      }
    }
  } catch {
    // Server may already be down
  }
}
