import type { Provider } from "../../store/types";

export type NotificationType = "turn-complete" | "error";

export interface Notification {
  id: string;
  type: NotificationType;
  terminalId: string;
  workspaceId: string;
  provider?: Provider;
  title: string;
  body?: string;
  createdAt: number;
  viewed: boolean;
}

export interface NotificationSettings {
  soundEnabled: boolean;
  errorSoundEnabled: boolean;
  osNotificationsEnabled: boolean;
  idleThresholdMs: number;
}

export const DEFAULT_SETTINGS: NotificationSettings = {
  soundEnabled: true,
  errorSoundEnabled: true,
  osNotificationsEnabled: false,
  idleThresholdMs: 8000,
};
