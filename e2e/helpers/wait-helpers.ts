import type { Page, Locator } from "@playwright/test";

/** Wait for a locator count to reach a specific number. */
export async function waitForCount(
  locator: Locator,
  count: number,
  timeout = 10_000,
): Promise<void> {
  await locator.first().page().waitForFunction(
    ({ selector, expected }) => document.querySelectorAll(selector).length === expected,
    { selector: await resolveSelector(locator), expected: count },
    { timeout },
  );
}

/** Poll until a condition is true. */
export async function pollUntil(
  fn: () => Promise<boolean>,
  timeout = 10_000,
  interval = 200,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`pollUntil timed out after ${timeout}ms`);
}

/** Wait for the page to stabilize (no new network requests for a period). */
export async function waitForNetworkIdle(page: Page, timeout = 5_000): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout });
}

async function resolveSelector(locator: Locator): Promise<string> {
  // Use the locator's string representation for simple selectors
  const str = locator.toString();
  // Extract the selector from "locator('...')" format
  const match = str.match(/locator\('(.+?)'\)/);
  return match?.[1] ?? str;
}
