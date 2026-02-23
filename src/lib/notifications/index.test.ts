import { describe, test, expect } from "bun:test";
import { buildNotificationIndex } from "./index";
import type { Notification } from "./types";

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: `n-${Math.random()}`,
    type: "turn-complete",
    terminalId: "term-1",
    workspaceId: "ws-1",
    title: "Agent idle",
    createdAt: Date.now(),
    viewed: false,
    ...overrides,
  };
}

describe("buildNotificationIndex", () => {
  test("empty notifications produce empty maps", () => {
    const index = buildNotificationIndex(new Set(["term-1"]), []);
    expect(index.byTerminal.size).toBe(0);
    expect(index.byWorkspace.size).toBe(0);
  });

  test("counts unseen per terminal", () => {
    const notifs = [
      makeNotification({ terminalId: "term-1", workspaceId: "ws-1" }),
      makeNotification({ terminalId: "term-1", workspaceId: "ws-1", type: "error" }),
      makeNotification({ terminalId: "term-2", workspaceId: "ws-1" }),
    ];
    const live = new Set(["term-1", "term-2"]);
    const index = buildNotificationIndex(live, notifs);

    expect(index.byTerminal.get("term-1")!.unseen).toBe(2);
    expect(index.byTerminal.get("term-2")!.unseen).toBe(1);
  });

  test("counts unseen per workspace", () => {
    const notifs = [
      makeNotification({ terminalId: "term-1", workspaceId: "ws-1" }),
      makeNotification({ terminalId: "term-2", workspaceId: "ws-1" }),
      makeNotification({ terminalId: "term-3", workspaceId: "ws-2" }),
    ];
    const live = new Set(["term-1", "term-2", "term-3"]);
    const index = buildNotificationIndex(live, notifs);

    expect(index.byWorkspace.get("ws-1")!.unseen).toBe(2);
    expect(index.byWorkspace.get("ws-2")!.unseen).toBe(1);
  });

  test("viewed notifications are excluded from unseen counts", () => {
    const notifs = [
      makeNotification({ terminalId: "term-1", viewed: true }),
      makeNotification({ terminalId: "term-1", viewed: false }),
    ];
    const live = new Set(["term-1"]);
    const index = buildNotificationIndex(live, notifs);

    expect(index.byTerminal.get("term-1")!.unseen).toBe(1);
  });

  test("error type sets hasError on terminal entry", () => {
    const notifs = [
      makeNotification({ terminalId: "term-1", type: "error" }),
    ];
    const live = new Set(["term-1"]);
    const index = buildNotificationIndex(live, notifs);

    expect(index.byTerminal.get("term-1")!.hasError).toBe(true);
  });

  test("error type sets hasError on workspace entry", () => {
    const notifs = [
      makeNotification({ terminalId: "term-1", workspaceId: "ws-1", type: "error" }),
    ];
    const live = new Set(["term-1"]);
    const index = buildNotificationIndex(live, notifs);

    expect(index.byWorkspace.get("ws-1")!.hasError).toBe(true);
  });

  test("turn-complete type does not set hasError", () => {
    const notifs = [
      makeNotification({ terminalId: "term-1", type: "turn-complete" }),
    ];
    const live = new Set(["term-1"]);
    const index = buildNotificationIndex(live, notifs);

    expect(index.byTerminal.get("term-1")!.hasError).toBe(false);
  });

  test("notifications for non-live terminals are excluded", () => {
    const notifs = [
      makeNotification({ terminalId: "term-dead" }),
    ];
    const live = new Set(["term-1"]);
    const index = buildNotificationIndex(live, notifs);

    expect(index.byTerminal.size).toBe(0);
    expect(index.byWorkspace.size).toBe(0);
  });

  test("mixed viewed and unviewed across workspaces", () => {
    const notifs = [
      makeNotification({ terminalId: "term-1", workspaceId: "ws-1", viewed: false }),
      makeNotification({ terminalId: "term-2", workspaceId: "ws-1", viewed: true }),
      makeNotification({ terminalId: "term-3", workspaceId: "ws-2", viewed: false, type: "error" }),
    ];
    const live = new Set(["term-1", "term-2", "term-3"]);
    const index = buildNotificationIndex(live, notifs);

    expect(index.byWorkspace.get("ws-1")!.unseen).toBe(1);
    expect(index.byWorkspace.get("ws-1")!.hasError).toBe(false);
    expect(index.byWorkspace.get("ws-2")!.unseen).toBe(1);
    expect(index.byWorkspace.get("ws-2")!.hasError).toBe(true);
  });
});
