import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createRoot } from "solid-js";

// ---- Mocks ----

const mockListSessions = mock(() =>
  Promise.resolve([
    {
      id: "s-1",
      title: "Fix bug",
      projectPath: "/project",
      startedAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T01:00:00Z",
      messageCount: 5,
      provider: "claude" as const,
    },
    {
      id: "s-2",
      title: "Add feature",
      projectPath: "/project",
      startedAt: "2025-01-02T00:00:00Z",
      updatedAt: "2025-01-02T01:00:00Z",
      messageCount: 10,
      provider: "claude" as const,
    },
  ])
);

mock.module("../lib/api", () => ({
  api: {
    listSessions: mockListSessions,
  },
}));

import { sessions, sessionsLoading, loadSessions } from "./sessions";

describe("sessions", () => {
  beforeEach(() => {
    mockListSessions.mockClear();
  });

  test("initially empty", () => {
    createRoot((dispose) => {
      // sessions signal starts as empty array
      expect(Array.isArray(sessions())).toBe(true);
      dispose();
    });
  });

  test("loadSessions populates on success", async () => {
    await loadSessions();
    createRoot((dispose) => {
      const s = sessions();
      expect(s.length).toBe(2);
      expect(s[0].id).toBe("s-1");
      expect(s[1].id).toBe("s-2");
      dispose();
    });
  });

  test("loadSessions handles error by setting empty array", async () => {
    mockListSessions.mockImplementationOnce(() =>
      Promise.reject(new Error("fail"))
    );
    await loadSessions();
    createRoot((dispose) => {
      expect(sessions().length).toBe(0);
      dispose();
    });
  });

  test("loadSessions clears loading state after success", async () => {
    await loadSessions();
    createRoot((dispose) => {
      expect(sessionsLoading()).toBe(false);
      dispose();
    });
  });

  test("loadSessions clears loading state after error", async () => {
    mockListSessions.mockImplementationOnce(() =>
      Promise.reject(new Error("fail"))
    );
    await loadSessions();
    createRoot((dispose) => {
      expect(sessionsLoading()).toBe(false);
      dispose();
    });
  });

  test("loadSessions passes project parameter", async () => {
    await loadSessions("/my/project");
    expect(mockListSessions).toHaveBeenCalledWith("/my/project");
  });
});
