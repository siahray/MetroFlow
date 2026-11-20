import { expect, test } from "@playwright/test";

import { seedSession, stubApi } from "./api-stub";

/**
 * The portal smoke test Q-1 asked for: the two things an operator must never
 * lose — the sign-in gate, and the operations board actually rendering live data.
 *
 * CR-002 §2.1/§2.2 split the old triage screen: the dashboard is read-only
 * overview, SOS dispatch moved to the Dispatch Radar.
 *
 * The API is stubbed (`api-stub.ts`), so this runs in CI without Postgres, the
 * hosted API or the dispatcher password.
 */

test.describe("sign-in gate", () => {
  test("an unauthenticated visit to triage lands on the login screen", async ({ page }) => {
    await stubApi(page);

    await page.goto("/triage");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "MetroFlow Portal" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Sign in to Dispatch Operations/ }),
    ).toBeVisible();
  });

  test("a wrong password is reported on the form", async ({ page }) => {
    await stubApi(page, { loginStatus: 401 });

    await page.goto("/login");
    await page.getByLabel("Email / Username").fill("dispatcher@metroflow.test");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: /Sign in to Dispatch Operations/ }).click();

    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("operations dashboard", () => {
  test("a dispatcher signs in and the board shows the live SOS count", async ({ page }) => {
    await stubApi(page);

    await page.goto("/login");
    await page.getByLabel("Email / Username").fill("dispatcher@metroflow.test");
    await page.getByLabel("Password", { exact: true }).fill("correct-password");
    await page.getByRole("button", { name: /Sign in to Dispatch Operations/ }).click();

    await page.waitForURL("**/triage");
    await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Active SOS/ })).toBeVisible();
    // The oldest unassigned SOS is listed in the dashboard's SOS table.
    await expect(page.getByText("#FR-0001")).toBeVisible();
    // The dashboard map is read-only: no simulation panel.
    await expect(page.getByRole("button", { name: "Live Network Model" })).toHaveCount(0);
  });

  test("a stored session reopens triage without signing in again", async ({ page }) => {
    await stubApi(page);
    await seedSession(page);

    await page.goto("/triage");

    await expect(page).toHaveURL(/\/triage$/);
    await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  });
});

test.describe("dispatch radar", () => {
  test("the SOS queue and its docket render on the radar", async ({ page }) => {
    await stubApi(page);
    await seedSession(page);

    await page.goto("/radar");

    // The queue item and the auto-selected detail both carry the id.
    await expect(page.getByText("#FR-0001").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /SOS dispatch and responder tracking/ }),
    ).toBeVisible();
    await expect(page.getByText("No active distress signals in queue")).toHaveCount(0);
  });
});
