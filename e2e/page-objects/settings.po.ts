import type { Page, Locator } from "@playwright/test";
import { sel } from "../helpers/selectors";

export class SettingsPO {
  readonly page: Page;
  readonly modal: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator(sel.settingsBackdrop);
  }

  /** Check if the settings modal is open. */
  async isOpen(): Promise<boolean> {
    return this.modal.isVisible();
  }

  /** Open settings by clicking the Settings button in the sidebar rail. */
  async open() {
    if (await this.isOpen()) return;
    await this.page.locator('button[title="Settings"]').click();
    await this.modal.waitFor({ state: "visible", timeout: 5000 });
  }

  /** Close the settings modal via the X button. */
  async close() {
    await this.modal.locator(sel.settingsCloseButton).click();
    await this.modal.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
  }

  /** Close the settings modal via Escape key. */
  async pressEscapeToClose() {
    await this.page.keyboard.press("Escape");
  }

  /** Switch to a settings section. */
  async switchSection(name: "Appearance" | "Notifications" | "Features" | "About") {
    await this.modal.locator(`button:has-text("${name}")`).click();
  }

  /** Select a theme by name. */
  async selectTheme(name: string) {
    await this.modal.locator(`button[title="${name}"]`).click();
  }

  /** Get all theme swatch locators. */
  themeSwatches(): Locator {
    // Theme swatches are buttons inside the 3-column grid, each with a title attribute
    return this.modal.locator(".grid.grid-cols-3 button[title]");
  }

  /** Get the font picker select element. */
  fontSelect(): Locator {
    return this.modal.locator('label:has-text("Terminal Font") + div select');
  }

  /** Get notification toggle buttons. */
  notificationToggles(): Locator {
    // Toggle switches are rendered as buttons inside divs
    return this.modal.locator("div.cursor-pointer button");
  }

  /** Get the idle threshold slider. */
  idleSlider(): Locator {
    return this.modal.locator('input[type="range"]');
  }

  /** Get feature toggle buttons in the Features section. */
  featureToggles(): Locator {
    return this.modal.locator("div.cursor-pointer button");
  }

  /** Get provider toggle buttons in the Features section (inside the Providers sub-section). */
  providerToggles(): Locator {
    return this.modal.locator("div.cursor-pointer button");
  }
}
