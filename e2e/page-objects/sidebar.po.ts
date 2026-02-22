import type { Page, Locator } from "@playwright/test";
import { sel } from "../helpers/selectors";

export class SidebarPO {
  readonly page: Page;
  readonly root: Locator;
  readonly rail: Locator;
  readonly expandedPanel: Locator;
  readonly flyout: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator(sel.sidebar);
    this.rail = page.locator(sel.sidebarRail);
    this.expandedPanel = page.locator(sel.sidebarPanel);
    this.flyout = page.locator(sel.sidebarFlyout);
  }

  /** Toggle the sidebar open/closed via the hamburger button. */
  async toggle() {
    await this.rail.locator('button[title*="Toggle sidebar"]').click();
  }

  /** Ensure the sidebar expanded panel is visible. */
  async ensureExpanded() {
    if (!(await this.expandedPanel.isVisible())) {
      await this.toggle();
    }
    await this.expandedPanel.waitFor({ state: "visible" });
  }

  /** Ensure the sidebar is collapsed (no expanded panel). */
  async ensureCollapsed() {
    if (await this.expandedPanel.isVisible()) {
      await this.toggle();
    }
  }

  /** Select a workspace by clicking its rail button (matched by title). */
  async selectWorkspace(name: string) {
    await this.workspaceButton(name).click();
  }

  /** Get the locator for a workspace rail button by name. */
  workspaceButton(name: string): Locator {
    return this.rail.locator(`button[title="${name}"]`);
  }

  /** Select a provider tab (claude, codex, opencode, gemini). */
  async selectProvider(provider: string) {
    await this.page.locator(`button[title="${provider}"]`).first().click();
  }

  /** Click the refresh sessions button. */
  async clickRefreshSessions() {
    await this.page.locator('button[title="Refresh sessions"]').click();
  }

  /** Open the stash tray popup. */
  async openStashTray() {
    await this.page.locator(sel.stashTrayButton).click();
  }

  /** Check if the sidebar is currently expanded. */
  async isExpanded(): Promise<boolean> {
    return this.expandedPanel.isVisible();
  }

  /** Get the attention badge on a workspace rail button. */
  workspaceAttentionBadge(name: string): Locator {
    return this.workspaceButton(name).locator("span.bg-\\[var\\(--warning\\)\\]");
  }
}
