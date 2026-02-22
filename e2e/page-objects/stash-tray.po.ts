import type { Page, Locator } from "@playwright/test";
import { sel } from "../helpers/selectors";

export class StashTrayPO {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Get the stash tray toggle button. */
  trayButton(): Locator {
    return this.page.locator(sel.stashTrayButton);
  }

  /** Open the stash tray popover. */
  async open() {
    await this.trayButton().click();
  }

  /** Check if the stash popover is visible. */
  async isPopoverVisible(): Promise<boolean> {
    // The stash popover is rendered inside [data-sidebar-stash-zone] with absolute positioning
    const popover = this.page.locator(
      "[data-sidebar-stash-zone] .absolute.left-0.right-0",
    );
    return popover.isVisible();
  }

  /** Get all terminal buttons inside the stash tray. */
  stashedTerminalButtons(): Locator {
    return this.page.locator("[data-sidebar-stash-zone] .absolute button.flex-1");
  }

  /** Unstash the first terminal in the stash tray. */
  async unstashFirst() {
    await this.stashedTerminalButtons().first().click();
  }
}
