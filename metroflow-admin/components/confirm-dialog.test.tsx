import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ConfirmDialog } from "./confirm-dialog";

afterEach(cleanup);

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const calls: string[] = [];
  render(
    <ConfirmDialog
      title="Dismiss this incident?"
      confirmLabel="Dismiss incident"
      onConfirm={() => calls.push("confirm")}
      onClose={() => calls.push("close")}
      {...overrides}
    >
      It leaves the queue.
    </ConfirmDialog>,
  );
  return calls;
}

test("shows the title, body and both actions", () => {
  renderDialog();
  expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  expect(screen.getByText("Dismiss this incident?")).toBeTruthy();
  expect(screen.getByText("It leaves the queue.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Dismiss incident" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
});

test("confirm and cancel call their handlers", () => {
  const calls = renderDialog();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss incident" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(calls).toEqual(["confirm", "close"]);
});

test("Escape closes, and a busy dialog ignores it", () => {
  const calls = renderDialog();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(calls).toEqual(["close"]);

  cleanup();
  const busyCalls = renderDialog({ busy: true });
  fireEvent.keyDown(window, { key: "Escape" });
  expect(busyCalls).toEqual([]);
  expect(screen.getByRole("button", { name: "Working…" }).hasAttribute("disabled")).toBe(true);
});

test("an error is announced", () => {
  renderDialog({ error: "Could not reach the API." });
  expect(screen.getByRole("alert").textContent).toBe("Could not reach the API.");
});
