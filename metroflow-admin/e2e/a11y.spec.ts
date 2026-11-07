import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { seedSession, stubApi } from "./api-stub";

/**
 * Accessibility smoke (BACKLOG U-2).
 *
 * axe-core checks what can be checked without a person: accessible names for
 * form fields and buttons, colour contrast, landmarks, heading order and ARIA
 * misuse. It does not replace listening to a screen reader, but it fails the
 * build on the regressions that are cheap to catch here.
 */

async function scan(page: import("@playwright/test").Page) {
  return new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
}

test("the login screen has no accessibility violations", async ({ page }) => {
  await stubApi(page);
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /Sign in to Dispatch Operations/ })).toBeVisible();

  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

test("the triage queue has no accessibility violations", async ({ page }) => {
  await stubApi(page);
  await seedSession(page);
  await page.goto("/triage");
  await expect(page.getByText("#FR-0001").first()).toBeVisible();

  const results = await scan(page);
  expect(results.violations).toEqual([]);
});

test("the call-in dialog keeps keyboard focus inside and hands it back", async ({ page }) => {
  await stubApi(page);
  await seedSession(page);
  await page.goto("/triage");

  const trigger = page.getByRole("button", { name: "Log a call-in distress signal" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Log a call-in distress signal" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Latitude")).toBeFocused();

  // Tab out of the last control wraps to the first, Shift+Tab wraps back.
  await page.getByRole("button", { name: "Log incident" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Log incident" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
