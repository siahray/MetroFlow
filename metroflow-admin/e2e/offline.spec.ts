import { expect, test } from "@playwright/test";

import { seedSession, stubApi } from "./api-stub";

/**
 * Offline behaviour of the portal (BACKLOG Q-1: there was no offline run).
 *
 * Two things matter to a dispatcher when the link drops: the shell must say so
 * instead of showing silently stale numbers, and a failed load must name the
 * cause and offer a retry that works once the link is back.
 */

const banner = /You are offline\. Data shown may be out of date/;

test("the shell announces a dropped connection and clears it on reconnect", async ({
  page,
  context,
}) => {
  await stubApi(page);
  await seedSession(page);
  await page.goto("/triage");
  await expect(page.getByText("#FR-0001").first()).toBeVisible();
  await expect(page.getByText(banner)).toHaveCount(0);

  await context.setOffline(true);
  await expect(page.getByText(banner)).toBeVisible();
  // The last data stays on screen, which is why the banner says it may be stale.
  await expect(page.getByText("#FR-0001").first()).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(banner)).toHaveCount(0);
});

test("a load that fails while offline says so, and its retry recovers", async ({ page }) => {
  // The browser is left online at the protocol level because the stub already
  // answers from memory; `navigator.onLine` is what picks the offline copy.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
  });
  let offline = true;
  await stubApi(page, { fail: () => offline });
  await seedSession(page);

  await page.goto("/triage");
  await expect(page.getByText("You are offline. Check your connection and retry.")).toBeVisible();

  offline = false;
  await page.getByRole("button", { name: /Retry/ }).click();

  await expect(page.getByText("#FR-0001").first()).toBeVisible();
  await expect(page.getByText("You are offline. Check your connection and retry.")).toHaveCount(0);
});
