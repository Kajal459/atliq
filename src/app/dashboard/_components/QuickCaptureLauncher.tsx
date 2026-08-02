"use client";

import { useState } from "react";
import { QuickCaptureForm, type DealOption } from "./QuickCaptureBox";

// Rendered inside the shared floating-launchers row in the dashboard layout
// (every page, not just Home) - the inline section on Home is easy to miss
// below the charts, so this gives a one-click way in from anywhere without
// scrolling or losing your place. That row is sticky rather than fixed to
// the viewport on purpose: it rides along near the bottom of the page while
// you scroll main content, but naturally stops before it can sit on top of
// the footer, since it's contained inside <main> rather than pinned to the
// whole screen.
export function QuickCaptureLauncher({
  owners,
  deals,
}: {
  owners: readonly string[];
  deals: readonly DealOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-forest-600 px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-forest-700"
      >
        <span aria-hidden className="text-base leading-none">
          +
        </span>
        Quick capture
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-cream-100 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-serif text-lg italic text-ink">Quick capture</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  A WhatsApp message, a call summary, anything that didn&apos;t come in by email.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="mt-4">
              <QuickCaptureForm owners={owners} deals={deals} autoFocus />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
