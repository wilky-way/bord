import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createRoot } from "solid-js";

// Mock playSound before importing the store
mock.module("./sounds", () => ({
  playSound: () => {},
}));

import {
  notifications,
  addNotification,
  markViewed,
  markAllViewedForWorkspace,
  pruneStaleNotifications,
  clearForTerminal,
  getSettings,
  updateSettings,
} from "./store";

const storage = (globalThis as any).__testStorage as Map<string, string>;

// Helper to clear all notifications by pruning with an empty set of live terminals,
// then re-adding to start fresh
function clearNotifications() {
  pruneStaleNotifications(new Set());
}

function addTestNotification(overrides: Partial<Parameters<typeof addNotification>[0]> = {}) {
  addNotification({
    type: "turn-complete",
    terminalId: "term-1",
    workspaceId: "ws-1",
    title: "Agent idle",
    isActiveTerminal: false,
    isAppFocused: false,
    ...overrides,
  });
}

describe("notification store", () => {
  beforeEach(() => {
    storage.clear();
    clearNotifications();
  });

  test("addNotification creates a notification", () => {
    createRoot((dispose) => {
      addTestNotification();
      const list = notifications();
      expect(list.length).toBe(1);
      expect(list[0].type).toBe("turn-complete");
      expect(list[0].terminalId).toBe("term-1");
      expect(list[0].viewed).toBe(false);
      dispose();
    });
  });

  test("suppresses when terminal is active AND focused", () => {
    createRoot((dispose) => {
      addTestNotification({ isActiveTerminal: true, isAppFocused: true });
      expect(notifications().length).toBe(0);
      dispose();
    });
  });

  test("does not suppress when terminal is active but app not focused", () => {
    createRoot((dispose) => {
      addTestNotification({ isActiveTerminal: true, isAppFocused: false });
      expect(notifications().length).toBe(1);
      dispose();
    });
  });

  test("does not suppress when app is focused but terminal not active", () => {
    createRoot((dispose) => {
      addTestNotification({ isActiveTerminal: false, isAppFocused: true });
      expect(notifications().length).toBe(1);
      dispose();
    });
  });

  test("deduplicates same terminal+type while unviewed", () => {
    createRoot((dispose) => {
      addTestNotification({ terminalId: "term-1", type: "turn-complete" });
      addTestNotification({ terminalId: "term-1", type: "turn-complete" });
      expect(notifications().length).toBe(1);
      dispose();
    });
  });

  test("allows different types for same terminal", () => {
    createRoot((dispose) => {
      addTestNotification({ terminalId: "term-1", type: "turn-complete" });
      addTestNotification({ terminalId: "term-1", type: "error" });
      expect(notifications().length).toBe(2);
      dispose();
    });
  });

  test("allows same type for different terminals", () => {
    createRoot((dispose) => {
      addTestNotification({ terminalId: "term-1", type: "turn-complete" });
      addTestNotification({ terminalId: "term-2", type: "turn-complete" });
      expect(notifications().length).toBe(2);
      dispose();
    });
  });

  test("allows duplicate after marking viewed", () => {
    createRoot((dispose) => {
      addTestNotification({ terminalId: "term-1", type: "turn-complete" });
      markViewed("term-1");
      addTestNotification({ terminalId: "term-1", type: "turn-complete" });
      expect(notifications().length).toBe(2);
      dispose();
    });
  });

  test("caps at MAX_NOTIFICATIONS (200)", () => {
    createRoot((dispose) => {
      for (let i = 0; i < 210; i++) {
        addTestNotification({ terminalId: `term-${i}` });
      }
      expect(notifications().length).toBe(200);
      dispose();
    });
  });

  test("TTL pruning removes old notifications", () => {
    createRoot((dispose) => {
      // Inject a notification with old createdAt directly via localStorage,
      // then add a fresh one to trigger the prune
      const oldNotif = {
        id: "old-1",
        type: "turn-complete",
        terminalId: "term-old",
        workspaceId: "ws-1",
        title: "Old",
        createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
        viewed: false,
      };
      storage.set("bord:notifications", JSON.stringify([oldNotif]));

      // The prune happens inside addNotification (setNotifications callback filters by TTL)
      addTestNotification({ terminalId: "term-fresh" });

      const list = notifications();
      // Old notification should have been pruned by the addNotification TTL filter
      expect(list.some((n) => n.id === "old-1")).toBe(false);
      expect(list.some((n) => n.terminalId === "term-fresh")).toBe(true);
      dispose();
    });
  });

  test("markViewed marks all notifications for a terminal as viewed", () => {
    createRoot((dispose) => {
      addTestNotification({ terminalId: "term-1", type: "turn-complete" });
      addTestNotification({ terminalId: "term-1", type: "error" });
      addTestNotification({ terminalId: "term-2", type: "turn-complete" });

      markViewed("term-1");

      const list = notifications();
      const term1 = list.filter((n) => n.terminalId === "term-1");
      const term2 = list.filter((n) => n.terminalId === "term-2");
      expect(term1.every((n) => n.viewed)).toBe(true);
      expect(term2.every((n) => !n.viewed)).toBe(true);
      dispose();
    });
  });

  test("markAllViewedForWorkspace marks all in workspace as viewed", () => {
    createRoot((dispose) => {
      addTestNotification({ terminalId: "term-1", workspaceId: "ws-1" });
      addTestNotification({ terminalId: "term-2", workspaceId: "ws-1" });
      addTestNotification({ terminalId: "term-3", workspaceId: "ws-2" });

      markAllViewedForWorkspace("ws-1");

      const list = notifications();
      const ws1 = list.filter((n) => n.workspaceId === "ws-1");
      const ws2 = list.filter((n) => n.workspaceId === "ws-2");
      expect(ws1.every((n) => n.viewed)).toBe(true);
      expect(ws2.every((n) => !n.viewed)).toBe(true);
      dispose();
    });
  });

  test("pruneStaleNotifications removes terminals not in live set", () => {
    createRoot((dispose) => {
      addTestNotification({ terminalId: "term-1" });
      addTestNotification({ terminalId: "term-2" });
      addTestNotification({ terminalId: "term-3" });

      pruneStaleNotifications(new Set(["term-1", "term-3"]));

      const list = notifications();
      expect(list.length).toBe(2);
      expect(list.some((n) => n.terminalId === "term-2")).toBe(false);
      dispose();
    });
  });

  test("clearForTerminal removes all notifications for a terminal", () => {
    createRoot((dispose) => {
      addTestNotification({ terminalId: "term-1" });
      addTestNotification({ terminalId: "term-1", type: "error" });
      addTestNotification({ terminalId: "term-2" });

      clearForTerminal("term-1");

      const list = notifications();
      expect(list.length).toBe(1);
      expect(list[0].terminalId).toBe("term-2");
      dispose();
    });
  });

  test("updateSettings persists to localStorage", () => {
    createRoot((dispose) => {
      updateSettings({ soundEnabled: false });
      const raw = storage.get("bord:notification-settings");
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw!);
      expect(parsed.soundEnabled).toBe(false);
      dispose();
    });
  });

  test("updateSettings merges with defaults", () => {
    createRoot((dispose) => {
      updateSettings({ soundEnabled: false });
      const s = getSettings();
      expect(s.soundEnabled).toBe(false);
      // Other defaults should remain
      expect(s.errorSoundEnabled).toBe(true);
      expect(s.osNotificationsEnabled).toBe(false);
      expect(s.idleThresholdMs).toBe(8000);
      dispose();
    });
  });

  test("addNotification saves to localStorage", () => {
    createRoot((dispose) => {
      addTestNotification();
      const raw = storage.get("bord:notifications");
      expect(raw).toBeDefined();
      const parsed = JSON.parse(raw!);
      expect(parsed.length).toBe(1);
      dispose();
    });
  });

  test("markViewed saves to localStorage", () => {
    createRoot((dispose) => {
      addTestNotification({ terminalId: "term-1" });
      markViewed("term-1");
      const raw = storage.get("bord:notifications");
      const parsed = JSON.parse(raw!);
      expect(parsed[0].viewed).toBe(true);
      dispose();
    });
  });
});
