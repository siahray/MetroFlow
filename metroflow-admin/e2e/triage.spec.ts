import { expect, test } from "@playwright/test";

import { seedSession, stubApi } from "./api-stub";

/**
 * The portal smoke test Q-1 asked for: the two things an operator must never
 * lose — the sign-in gate, and the triage queue actually rendering an incident.
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

test.describe("triage", () => {
  test("a dispatcher signs in and the pending incident appears in the queue", async ({ page }) => {
    await stubApi(page);

    await page.goto("/login");
    await page.getByLabel("Email / Username").fill("dispatcher@metroflow.test");
    await page.getByLabel("Password", { exact: true }).fill("correct-password");
    await page.getByRole("button", { name: /Sign in to Dispatch Operations/ }).click();

    await page.waitForURL("**/triage");
    // The queue item and the auto-selected detail both carry the id.
    await expect(page.getByText("#FR-0001").first()).toBeVisible();
    await expect(page.getByText("Pending Triage")).toBeVisible();
    await expect(page.getByText("No incidents in queue")).toHaveCount(0);
  });

  test("a stored session reopens triage without signing in again", async ({ page }) => {
    await stubApi(page);
    await seedSession(page);

    await page.goto("/triage");

    await expect(page).toHaveURL(/\/triage$/);
    await expect(page.getByText("#FR-0001").first()).toBeVisible();
  });
});
