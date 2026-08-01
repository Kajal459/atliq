"use client";

import { useState, useTransition, type ReactNode } from "react";

// Shared confirm-before-acting pattern: any button that changes data (approve,
// reject, sign out, generate a brief, log a quick capture) routes through
// this instead of firing immediately - a small popup names the exact action
// before it happens, per the "no surprise side effects" ask.
export function ConfirmButton({
  onConfirm,
  label,
  confirmText,
  confirmLabel = "Confirm",
  tone = "primary",
  className,
  disabled,
}: {
  onConfirm: () => void | Promise<void>;
  label: ReactNode;
  confirmText: string;
  confirmLabel?: string;
  tone?: "primary" | "neutral" | "danger";
  className: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await onConfirm();
      setOpen(false);
    });
  }

  const confirmClass =
    tone === "danger"
      ? "bg-warn hover:bg-coral-700"
      : tone === "neutral"
        ? "bg-ink hover:bg-black"
        : "bg-forest-600 hover:bg-forest-700";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={disabled} className={className}>
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-cream-100 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-ink">{confirmText}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending}
                className={`rounded-full px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 ${confirmClass}`}
              >
                {pending ? "Working..." : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
