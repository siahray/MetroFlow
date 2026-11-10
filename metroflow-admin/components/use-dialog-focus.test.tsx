import { afterEach, expect, test } from "bun:test";
import { useRef, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { useDialogFocus } from "./use-dialog-focus";

afterEach(cleanup);

function Dialog({ onClose, closeDisabled }: { onClose: () => void; closeDisabled?: boolean }) {
  const firstRef = useRef<HTMLInputElement>(null);
  useDialogFocus(firstRef, onClose, closeDisabled);
  return (
    <div role="dialog">
      <input ref={firstRef} aria-label="first" />
      <button type="button">last</button>
    </div>
  );
}

test("focus lands on the first field when the dialog opens", () => {
  render(<Dialog onClose={() => {}} />);
  expect(document.activeElement).toBe(screen.getByLabelText("first"));
});

test("Escape closes the dialog", () => {
  let closed = 0;
  render(<Dialog onClose={() => closed++} />);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(closed).toBe(1);
});

test("Escape does nothing while closing is disabled", () => {
  let closed = 0;
  render(<Dialog onClose={() => closed++} closeDisabled />);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(closed).toBe(0);
});

test("Tab from the last field wraps back to the first", () => {
  render(<Dialog onClose={() => {}} />);
  screen.getByText("last").focus();
  fireEvent.keyDown(window, { key: "Tab" });
  expect(document.activeElement).toBe(screen.getByLabelText("first"));
});

test("Shift+Tab from the first field wraps to the last", () => {
  render(<Dialog onClose={() => {}} />);
  expect(document.activeElement).toBe(screen.getByLabelText("first"));
  fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(screen.getByText("last"));
});

test("closing the dialog returns focus to whatever opened it", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)}>
          open
        </button>
        {open && <Dialog onClose={() => setOpen(false)} />}
      </div>
    );
  }
  render(<Harness />);
  const trigger = screen.getByText("open");
  trigger.focus();
  fireEvent.click(trigger);
  expect(document.activeElement).toBe(screen.getByLabelText("first"));
  fireEvent.keyDown(window, { key: "Escape" });
  expect(document.activeElement).toBe(trigger);
});
