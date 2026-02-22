import type { Page, Locator } from "@playwright/test";
import { sel } from "../helpers/selectors";

export class TerminalPanelPO {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Get all terminal panel locators. */
  allPanels(): Locator {
    return this.page.locator(sel.terminalPanel());
  }

  /** Get a specific panel by terminal ID. */
  panel(id: string): Locator {
    return this.page.locator(sel.terminalPanel(id));
  }

  /** Count visible terminal panels. */
  async visibleCount(): Promise<number> {
    return this.allPanels().count();
  }

  /** Click the stash button on the first terminal. */
  async stashFirst() {
    await this.allPanels()
      .first()
      .locator(sel.stashAction)
      .click();
  }

  /** Click the close button on the first terminal. */
  async closeFirst() {
    await this.allPanels()
      .first()
      .locator(sel.closeAction)
      .click();
  }

  /** Stash a terminal by ID. */
  async stash(id: string) {
    await this.panel(id).locator(sel.stashAction).click();
  }

  /** Close a terminal by ID. */
  async close(id: string) {
    await this.panel(id).locator(sel.closeAction).click();
  }

  /** Double-click the title to enter edit mode, type a new title, and press Enter. */
  async editTitle(id: string, newTitle: string) {
    const titleSpan = this.panel(id).locator(
      "[data-titlebar] span.text-xs.truncate.cursor-text",
    );
    await titleSpan.dblclick();
    const input = this.panel(id).locator("[data-titlebar] input");
    await input.fill(newTitle);
    await input.press("Enter");
  }

  /** Get the provider attribute of a terminal panel. */
  async getProvider(id: string): Promise<string> {
    return (await this.panel(id).getAttribute("data-provider")) ?? "";
  }

  /** Toggle the mute button on a terminal. */
  async toggleMute(id: string) {
    // Click the bell button (either mute or unmute)
    const muteBtn = this.panel(id).locator(
      'button[title="Mute notifications"], button[title="Unmute notifications"]',
    );
    await muteBtn.click();
  }

  /** Click the git panel toggle button on a terminal. */
  async openGitPanel() {
    await this.page.locator(sel.toggleGitPanel).first().click();
  }

  /** Get the terminal ID of the first visible panel. */
  async firstTerminalId(): Promise<string | null> {
    const first = this.allPanels().first();
    return first.getAttribute("data-terminal-id");
  }

  /** Get the terminal ID of the active (fully opaque) panel. */
  async activeTerminalId(): Promise<string | null> {
    const panels = this.allPanels();
    const count = await panels.count();
    for (let i = 0; i < count; i++) {
      const panel = panels.nth(i);
      // Check inline style first (SolidJS sets opacity as inline style)
      const inlineOpacity = await panel.evaluate((el) => (el as HTMLElement).style.opacity);
      if (inlineOpacity === "1") {
        return panel.getAttribute("data-terminal-id");
      }
    }
    // Fallback: check via box-shadow (active has --shadow-glow)
    for (let i = 0; i < count; i++) {
      const panel = panels.nth(i);
      const shadow = await panel.evaluate((el) => (el as HTMLElement).style.boxShadow);
      if (shadow && shadow.includes("glow")) {
        return panel.getAttribute("data-terminal-id");
      }
    }
    // Last fallback: return the first panel
    if (count > 0) return panels.first().getAttribute("data-terminal-id");
    return null;
  }

  /** Get all terminal IDs. */
  async allTerminalIds(): Promise<string[]> {
    const panels = this.allPanels();
    const count = await panels.count();
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = await panels.nth(i).getAttribute("data-terminal-id");
      if (id) ids.push(id);
    }
    return ids;
  }
}
