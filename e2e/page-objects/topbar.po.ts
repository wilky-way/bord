import type { Page, Locator } from "@playwright/test";
import { sel } from "../helpers/selectors";

export class TopBarPO {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Click a density button (1-4). */
  async setDensity(n: number) {
    await this.page.locator(sel.densityButton(n)).click();
  }

  /** Get the currently active density value (button with accent bg). */
  async getActiveDensity(): Promise<number | null> {
    for (let n = 1; n <= 4; n++) {
      const btn = this.page.locator(sel.densityButton(n));
      const classes = await btn.getAttribute("class");
      if (classes?.includes("bg-[var(--accent)]")) return n;
    }
    return null;
  }

  /** Click the add terminal button in the top bar. */
  async addTerminal() {
    await this.page.locator(sel.addTerminalButton).first().click();
  }

  /** Get the terminal count text from the badge. */
  async getTerminalCountText(): Promise<string> {
    const badge = this.page.locator("span").filter({ hasText: /\d+ terminals?/ });
    return badge.first().textContent() ?? "";
  }

  /** Get the density button locator. */
  densityButton(n: number): Locator {
    return this.page.locator(sel.densityButton(n));
  }
}
