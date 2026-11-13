import type { Page, Route } from "@playwright/test";

/**
 * A fake API for the portal smoke tests.
 *
 * The portal talks to `${NEXT_PUBLIC_API_BASE_URL}/api/v1/...`, which at build
 * time is the local default (`http://localhost:8000`) or the hosted API when
 * `.env.local` sets it. `page.route("**\/api/v1/**")` matches either, so the
 * tests stay deterministic without a database, a server or a dispatcher
 * password — and no request ever leaves the browser.
 */

export const adminUser = {
  user_id: 1,
  name: "Test Dispatcher",
  email: "dispatcher@metroflow.test",
  role: "ADMIN",
};

export const sosRow = {
  sos_id: 1,
  latitude: 14.6,
  longitude: 121.0,
  note: "Water at 60cm, one vehicle stalled",
  vehicle_id: null,
  status: "PENDING",
  created_at: "2026-11-05T10:00:00Z",
  dismissed_at: null,
};

const vehicleRow = {
  vehicle_id: 1,
  call_sign: "RESCUE-1",
  vehicle_type: "Truck",
  clearance_cm: 45,
  status: "AVAILABLE",
  current_location_lat: 14.6,
  current_location_lon: 121.0,
  speed_kmh: null,
};

const hazardRow = {
  hazard_id: 1,
  name: "Test flood",
  obstruction_level: "LEVEL_2",
  avg_depth_cm: 40,
  edge_id: null,
  notes: null,
  geometry: null,
  published_at: null,
  active: true,
  created_at: "2026-11-05T09:00:00Z",
  updated_at: null,
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/**
 * Sign the browser in before the page loads, the same way `login-screen.tsx`
 * does it: the token and user live in `localStorage` and the idle stamp must be
 * recent or `session.ts` treats the session as expired.
 */
export async function seedSession(page: Page): Promise<void> {
  await page.addInitScript((user) => {
    localStorage.setItem("metroflow_user", JSON.stringify(user));
    localStorage.setItem("metroflow_token", "e2e-token");
    localStorage.setItem("metroflow_last_active", String(Date.now()));
  }, adminUser);
}

/** Answer every API call the triage screen makes. `loginStatus` drives the sign-in test. */
export async function stubApi(
  page: Page,
  options: { loginStatus?: number; fail?: () => boolean } = {},
): Promise<void> {
  const loginStatus = options.loginStatus ?? 200;

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/api/v1/auth/login") {
      return loginStatus === 200
        ? json(route, { access_token: "e2e-token", user: adminUser })
        : json(route, { detail: "bad credentials" }, loginStatus);
    }

    // The change feeds stay open on the real server for ~45 s. Answering with an
    // empty stream keeps the client quiet instead of retrying a refused fetch.
    if (path.endsWith("/stream")) {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: ": e2e\n\n",
      });
    }

    // `fail` simulates a dead connection for the offline test; the streams above
    // are still answered so the page does not spin on a retry loop.
    if (options.fail?.()) return route.abort("internetdisconnected");

    if (path === "/api/v1/sos") {
      return json(route, url.searchParams.get("dismissed") === "true" ? [] : [sosRow]);
    }
    if (path === "/api/v1/reports") return json(route, []);
    if (path === "/api/v1/vehicles") return json(route, [vehicleRow]);
    if (path === "/api/v1/hazards") return json(route, [hazardRow]);

    return json(route, { detail: `no stub for ${path}` }, 404);
  });
}
