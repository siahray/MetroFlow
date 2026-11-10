import { afterEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { UnitFormModal } from "./unit-form-modal";

function renderModal(onSubmit = async () => {}, onClose = () => {}) {
  return render(
    <UnitFormModal
      title="Add Unit"
      submitLabel="Create unit"
      onSubmit={onSubmit}
      onClose={onClose}
    />,
  );
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Call sign"), { target: { value: "RU-07" } });
  fireEvent.change(screen.getByLabelText("Unit type"), { target: { value: "Rescue Utility" } });
  fireEvent.change(screen.getByLabelText("Ground clearance (cm)"), { target: { value: "45" } });
}

afterEach(() => {
  cleanup();
});

test("an empty submit shows field errors and does not call onSubmit", async () => {
  let submitted = false;
  renderModal(async () => {
    submitted = true;
  });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create unit" }));
  });

  expect(screen.getByText("Enter a call sign.")).toBeTruthy();
  expect(screen.getByText("Enter a unit type.")).toBeTruthy();
  expect(screen.getByText("Enter the ground clearance in cm.")).toBeTruthy();
  expect(submitted).toBe(false);
});

test("a valid submit passes the parsed payload to onSubmit", async () => {
  const payloads: unknown[] = [];
  renderModal(async (payload) => {
    payloads.push(payload);
  });
  fillValidForm();

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create unit" }));
  });

  await waitFor(() => expect(payloads).toHaveLength(1));
  expect(payloads[0]).toMatchObject({
    call_sign: "RU-07",
    vehicle_type: "Rescue Utility",
    clearance_cm: 45,
    status: "AVAILABLE",
  });
});

test("a rejected onSubmit shows the server message and keeps the modal open", async () => {
  renderModal(async () => {
    throw new Error("Call sign already in use");
  });
  fillValidForm();

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create unit" }));
  });

  expect(await screen.findByText("Call sign already in use")).toBeTruthy();
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("the close button calls onClose", () => {
  let closed = false;
  renderModal(
    async () => {},
    () => {
      closed = true;
    },
  );

  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(closed).toBe(true);
});
