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
  gitPanelPortal: "[data-git-panel]",

  // TopBar.tsx — global mute
  globalMuteButton: 'button[title="Mute notifications"], button[title="Unmute notifications"]',

  // Sidebar.tsx — add workspace
  addWorkspaceButton: 'button[title="Open project"]',

  // SettingsPanel.tsx
  settingsBackdrop: ".fixed.inset-0.z-50",
  settingsCloseButton: 'button[title="Close"]',

  // SettingsPanel.tsx — Features section
  featureToggle: (name: string) => `label:has-text("${name}") button`,

  // GitPanel.tsx — branch switch
  branchSwitchButton: 'button[title="Switch branch"]',

  // FileTree / FileViewer
  fileTreeButton: 'button[title="File tree"]',
  fileTreeRoot: "[data-file-tree]",
  fileTreeToolbar: "[data-file-tree-toolbar]",
  fileViewerRoot: "[data-file-viewer]",
  fileViewerTabs: "[data-file-viewer-tabs]",
  fileTab: (name: string) => `[data-file-tab="${name}"]`,
  mdPreviewToggle: "[data-md-preview-toggle]",
  backToTreeButton: 'button[title="Back to file tree"]',
  closeViewerButton: 'button[title="Close file viewer"]',
  proseViewer: ".prose-viewer",
} as const;
