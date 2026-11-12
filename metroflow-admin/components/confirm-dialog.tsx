"use client";

import { AlertTriangle } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useDialogFocus } from "./use-dialog-focus";

type ConfirmDialogProps = {
  title: string;
  /** Plain statement of what the action does, shown under the title. */
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for destructive moves, `primary` for publishing/restoring. */
  tone?: "danger" | "primary";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * The one confirmation step for an immediate admin action.
 *
 * Actions that already collect a mandatory reason or run a multi-step wizard
 * keep their own dialog; this covers the moves that used to fire on a single
 * click (dismiss, restore, delete, publish, withdraw, undo) so none of them
 * commit without the operator confirming the consequence.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  error = null,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  // Focus lands on Cancel: a stray Enter must not commit a destructive action.
  const cancelRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(cancelRef, onClose, busy);

  return (
    <div
      className="fixed inset-0 z-50 flex animate-backdrop-in items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={children ? bodyId : undefined}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md animate-modal-in rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
              tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-sky-50 text-sky-700",
            )}
          >
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-bold text-slate-900">
              {title}
            </h2>
            {children ? (
              <div id={bodyId} className="mt-1 text-xs leading-relaxed text-slate-600">
                {children}
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              "rounded-lg px-4 py-1.5 text-xs font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              tone === "danger"
                ? "bg-rose-700 hover:bg-rose-800"
                : "bg-brand-primary hover:bg-slate-800",
            )}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
