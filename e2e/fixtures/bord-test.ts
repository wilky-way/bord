import { test as base } from "@playwright/test";
import { SidebarPO } from "../page-objects/sidebar.po";
import { TopBarPO } from "../page-objects/topbar.po";
import { TerminalPanelPO } from "../page-objects/terminal-panel.po";
import { GitPanelPO } from "../page-objects/git-panel.po";
import { SettingsPO } from "../page-objects/settings.po";
import { SessionListPO } from "../page-objects/session-list.po";
import { StashTrayPO } from "../page-objects/stash-tray.po";
import { FilePanelPO } from "../page-objects/file-panel.po";

interface BordFixtures {
  sidebar: SidebarPO;
  topbar: TopBarPO;
  terminalPanel: TerminalPanelPO;
  gitPanel: GitPanelPO;
  settings: SettingsPO;
  sessionList: SessionListPO;
  stashTray: StashTrayPO;
  filePanel: FilePanelPO;
}

export const test = base.extend<BordFixtures>({
  sidebar: async ({ page }, use) => {
    await use(new SidebarPO(page));
  },
  topbar: async ({ page }, use) => {
    await use(new TopBarPO(page));
  },
  terminalPanel: async ({ page }, use) => {
    await use(new TerminalPanelPO(page));
  },
  gitPanel: async ({ page }, use) => {
    await use(new GitPanelPO(page));
  },
  settings: async ({ page }, use) => {
    await use(new SettingsPO(page));
  },
  sessionList: async ({ page }, use) => {
    await use(new SessionListPO(page));
  },
  stashTray: async ({ page }, use) => {
    await use(new StashTrayPO(page));
  },
  filePanel: async ({ page }, use) => {
    await use(new FilePanelPO(page));
  },
});

export { expect } from "@playwright/test";
