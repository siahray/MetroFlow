"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard behaviour every portal dialog needs: focus lands on the first field,
 * Tab and Shift+Tab stay inside the dialog, Escape closes it, and focus returns
 * to whatever opened it.
 *
 * The close callback and the disabled flag live in refs so a parent re-render
 * (the queue refreshes every few seconds) does not move focus out of the field
 * an operator is typing in.
 */
export function useDialogFocus(
  first: RefObject<HTMLElement | null>,
  onClose: () => void,
  closeDisabled = false,
) {
  const close = useRef(onClose);
  const disabled = useRef(closeDisabled);

  useEffect(() => {
    close.current = onClose;
    disabled.current = closeDisabled;
  }, [onClose, closeDisabled]);

  useEffect(() => {
    const trigger = document.activeElement;
    first.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!disabled.current) close.current();
        return;
      }
      if (event.key !== "Tab" || !first.current) return;
      const dialog = first.current.closest('[role="dialog"]');
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [first]);
}
