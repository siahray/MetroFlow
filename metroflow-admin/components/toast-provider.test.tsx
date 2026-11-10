import { afterEach, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ToastProvider, useToast } from "./toast-provider";

afterEach(cleanup);

function Trigger({ message }: { message: string }) {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show(message)}>
      notify
    </button>
  );
}

test("useToast throws outside a ToastProvider", () => {
  expect(() => render(<Trigger message="x" />)).toThrow(/ToastProvider/);
});

test("show() surfaces the message in the live region", () => {
  render(
    <ToastProvider>
      <Trigger message="Hazard published" />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByText("notify"));
  expect(screen.getByRole("status").textContent).toContain("Hazard published");
});
