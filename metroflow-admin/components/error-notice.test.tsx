import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ErrorNotice, OfflineBanner } from "./error-notice";

afterEach(cleanup);

test("shows the message and no retry button when none is given", () => {
  render(<ErrorNotice message="Could not load incidents" />);
  expect(screen.getByRole("alert").textContent).toContain("Could not load incidents");
  expect(screen.queryByRole("button")).toBeNull();
});

test("calls onRetry when the retry button is clicked", () => {
  let calls = 0;
  render(<ErrorNotice message="Could not load incidents" onRetry={() => calls++} />);
  fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(calls).toBe(1);
});

test("the offline banner announces itself as a status", () => {
  render(<OfflineBanner />);
  expect(screen.getByRole("status").textContent).toMatch(/offline/i);
});
