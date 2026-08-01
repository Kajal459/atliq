"use client";

import { useState } from "react";
import { ConfirmButton } from "../_components/ConfirmButton";
import { sendTestDigest } from "./digest-test-actions";

export function SendTestDigestButton() {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function run() {
    const outcome = await sendTestDigest();
    setResult(outcome);
  }

  return (
    <div className="mt-4">
      <ConfirmButton
        label="Send test digest now"
        confirmText="Send the daily digest email right now, to everyone on the recipient list above? This is the real email, not a preview."
        confirmLabel="Send it"
        onConfirm={run}
        className="rounded-full bg-forest-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-forest-700"
      />
      {result && <p className={`mt-2 text-sm ${result.ok ? "text-forest-700" : "text-warn"}`}>{result.message}</p>}
    </div>
  );
}
