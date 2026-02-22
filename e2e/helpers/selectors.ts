/** Centralized selectors for E2E tests — sourced from actual component source. */

export const sel = {
  // TerminalPanel.tsx
  terminalPanel: (id?: string) =>
    id ? `[data-terminal-id="${id}"]` : "[data-terminal-id]",
  terminalProvider: (provider: string) => `[data-provider="${provider}"]`,
  titlebar: "[data-titlebar]",
  stashAction: '[data-action="stash-terminal"]',
  closeAction: '[data-action="close-terminal"]',
  toggleGitPanel: 'button[title="Toggle git panel"]',
  muteButton: 'button[title="Mute notifications"]',
  unmuteButton: 'button[title="Unmute notifications"]',

  // Sidebar.tsx
  sidebarRail: "[data-bord-sidebar-rail]",
  sidebarPanel: '[data-bord-sidebar-panel="expanded"]',
  sidebarFlyout: "[data-bord-sidebar-flyout]",
  stashTrayButton: "[data-stash-tray-button]",
  stashZone: "[data-stash-zone]",
  sidebarStashZone: "[data-sidebar-stash-zone]",
  previewTab: (tab: string) => `[data-preview-tab="${tab}"]`,
  panelSessionTab: (tab: string) => `[data-panel-session-tab="${tab}"]`,
  sidebar: "[data-bord-sidebar]",

  // TopBar.tsx
  addTerminalButton: 'button[title="Add terminal"]',
  densityButton: (n: number) =>
    `button[title="${n} terminal${n > 1 ? "s" : ""} per view"]`,

  // EditorButton.tsx
  chooseEditorButton: 'button[title="Choose editor"]',

  // GitPanel.tsx (Portal-rendered)
  gitPanelPortal: ".fixed.z-\\[9999\\]",

  // SettingsPanel.tsx
  settingsBackdrop: ".fixed.inset-0.z-50",
  settingsCloseButton: 'button[title="Close"]',
} as const;
