import { defineConfig, devices } from "@playwright/test";

/**
 * Portal end-to-end smoke (BACKLOG Q-1).
 *
 * The API is stubbed inside the browser (see `e2e/api-stub.ts`), so this needs
 * nothing but the portal itself — no database, no hosted API, no credentials.
 * Port 3100 keeps a running `bun run dev` (3000) untouched.
 */

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bun run build && PORT=${PORT} bun run start`,
    url: `http://127.0.0.1:${PORT}/login`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
