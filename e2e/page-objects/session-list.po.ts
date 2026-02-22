import type { Page, Locator } from "@playwright/test";

export class SessionListPO {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Get session card buttons from the sidebar session list. */
  sessionCards(): Locator {
    // SessionCard components are rendered as buttons inside the session list container
    return this.page.locator(
      '[data-bord-sidebar-panel="expanded"] .px-2.pb-2 button.w-full.text-left',
    );
  }

  /** Click a session card by index. */
  async clickSessionByIndex(index: number) {
    await this.sessionCards().nth(index).click();
  }

  /** Get the "No sessions found" message. */
  noSessionsMessage(): Locator {
    return this.page.locator("text=No sessions found");
  }

  /** Get the "Loading sessions..." message. */
  loadingMessage(): Locator {
    return this.page.locator("text=Loading sessions...");
  }
}
