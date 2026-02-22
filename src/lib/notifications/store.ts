import { createSignal } from "solid-js";
import type { Notification, NotificationType, NotificationSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import type { Provider } from "../../store/types";
import { playSound } from "./sounds";

const STORAGE_KEY = "bord:notifications";
const SETTINGS_KEY = "bord:notification-settings";
const MAX_NOTIFICATIONS = 200;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function loadNotifications(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Notification[];
    const cutoff = Date.now() - TTL_MS;
    // Mark all as viewed on load — stale unviewed notifications from a previous
    // session shouldn't show badges after a page reload
    return parsed
      .filter((n) => n.createdAt > cutoff)
      .map((n) => (n.viewed ? n : { ...n, viewed: true }));
  } catch {
    return [];
  }
}

function saveNotifications(list: Notification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* quota exceeded — silently drop */ }
}

function loadSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: NotificationSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

const [notifications, setNotifications] = createSignal<Notification[]>(loadNotifications());
const [settings, setSettingsSignal] = createSignal<NotificationSettings>(loadSettings());

export { notifications };

export function getSettings() {
  return settings();
}

export function updateSettings(patch: Partial<NotificationSettings>) {
  setSettingsSignal((prev) => {
    const next = { ...prev, ...patch };
    saveSettings(next);
    return next;
  });
}

let idCounter = 0;

export function addNotification(opts: {
  type: NotificationType;
  terminalId: string;
  workspaceId: string;
  provider?: Provider;
  title: string;
  body?: string;
  isActiveTerminal: boolean;
  isAppFocused: boolean;
}) {
  // Suppress if terminal is active AND app is focused (user is watching)
  if (opts.isActiveTerminal && opts.isAppFocused) return;

  // Deduplicate: don't stack notifications for the same terminal+type if one is already unviewed
  const existing = notifications();
  if (existing.some((n) => n.terminalId === opts.terminalId && n.type === opts.type && !n.viewed)) return;

  const s = settings();

  const notification: Notification = {
    id: `n-${Date.now()}-${++idCounter}`,
    type: opts.type,
    terminalId: opts.terminalId,
    workspaceId: opts.workspaceId,
    provider: opts.provider,
    title: opts.title,
    body: opts.body,
    createdAt: Date.now(),
    viewed: false,
  };

  setNotifications((prev) => {
    const next = [notification, ...prev];
    // Cap + TTL prune
    const cutoff = Date.now() - TTL_MS;
    const pruned = next.filter((n) => n.createdAt > cutoff).slice(0, MAX_NOTIFICATIONS);
    saveNotifications(pruned);
    return pruned;
  });

  // Play sound
  if (opts.type === "turn-complete" && s.soundEnabled) {
    playSound("chime");
  } else if (opts.type === "error" && s.errorSoundEnabled) {
    playSound("error");
  }

  // OS notification when app not focused
  if (s.osNotificationsEnabled && !opts.isAppFocused) {
    sendOsNotification(notification);
  }
}

export function markViewed(terminalId: string) {
  setNotifications((prev) => {
    let changed = false;
    const next = prev.map((n) => {
      if (n.terminalId === terminalId && !n.viewed) {
        changed = true;
        return { ...n, viewed: true };
      }
      return n;
    });
    if (changed) saveNotifications(next);
    return changed ? next : prev;
  });
}

export function markAllViewedForWorkspace(workspaceId: string) {
  setNotifications((prev) => {
    let changed = false;
    const next = prev.map((n) => {
      if (n.workspaceId === workspaceId && !n.viewed) {
        changed = true;
        return { ...n, viewed: true };
      }
      return n;
    });
    if (changed) saveNotifications(next);
    return changed ? next : prev;
  });
}

/** Remove notifications whose terminalId no longer exists in the live terminal list. */
export function pruneStaleNotifications(liveTerminalIds: Set<string>) {
  setNotifications((prev) => {
    const next = prev.filter((n) => liveTerminalIds.has(n.terminalId));
    if (next.length !== prev.length) saveNotifications(next);
    return next;
  });
}

export function clearForTerminal(terminalId: string) {
  setNotifications((prev) => {
    const next = prev.filter((n) => n.terminalId !== terminalId);
    if (next.length !== prev.length) saveNotifications(next);
    return next;
  });
}

function sendOsNotification(n: Notification) {
  if (typeof Notification === "undefined") return;
  if (globalThis.Notification.permission !== "granted") return;

  try {
    const osNotif = new globalThis.Notification(n.title, {
      body: n.body ?? `${n.provider ?? "Terminal"} is idle`,
      tag: n.terminalId, // collapse per terminal
    });
    osNotif.onclick = () => {
      window.focus();
      // Dispatch a custom event that the app can listen for to switch terminals
      window.dispatchEvent(
        new CustomEvent("bord:focus-terminal", {
          detail: { terminalId: n.terminalId, workspaceId: n.workspaceId },
        }),
      );
      osNotif.close();
    };
  } catch { /* OS notification not available */ }
}

export function requestOsNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (globalThis.Notification.permission === "default") {
    globalThis.Notification.requestPermission();
  }
}
