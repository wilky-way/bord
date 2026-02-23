import { createMemo } from "solid-js";
import { state } from "../../store/core";
import { notifications, pruneStaleNotifications } from "./store";

export interface NotificationIndexEntry {
  unseen: number;
  hasError: boolean;
}

export interface NotificationIndex {
  byTerminal: Map<string, NotificationIndexEntry>;
  byWorkspace: Map<string, NotificationIndexEntry>;
}

/** @internal — exported for testing */
export function buildNotificationIndex(
  liveTerminalIds: Set<string>,
  notifs: import("./types").Notification[],
): NotificationIndex {
  const byTerminal = new Map<string, NotificationIndexEntry>();
  const byWorkspace = new Map<string, NotificationIndexEntry>();

  for (const n of notifs) {
    if (n.viewed) continue;
    if (!liveTerminalIds.has(n.terminalId)) continue;

    // Index by terminal
    const tEntry = byTerminal.get(n.terminalId);
    if (tEntry) {
      tEntry.unseen++;
      if (n.type === "error") tEntry.hasError = true;
    } else {
      byTerminal.set(n.terminalId, {
        unseen: 1,
        hasError: n.type === "error",
      });
    }

    // Index by workspace
    const wEntry = byWorkspace.get(n.workspaceId);
    if (wEntry) {
      wEntry.unseen++;
      if (n.type === "error") wEntry.hasError = true;
    } else {
      byWorkspace.set(n.workspaceId, {
        unseen: 1,
        hasError: n.type === "error",
      });
    }
  }

  return { byTerminal, byWorkspace };
}

export const notificationIndex = createMemo<NotificationIndex>(() => {
  const liveTerminals = new Set(state.terminals.map((t) => t.id));
  return buildNotificationIndex(liveTerminals, notifications());
});

export { notifications, addNotification, markViewed, markAllViewedForWorkspace, clearForTerminal, pruneStaleNotifications, getSettings, updateSettings } from "./store";
export type { Notification, NotificationType, NotificationSettings } from "./types";
