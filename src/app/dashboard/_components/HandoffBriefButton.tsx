"use client";

import { useState } from "react";
import { ConfirmButton } from "./ConfirmButton";

export function HandoffBriefButton({
  scope,
  dealId,
  label,
}: {
  scope: "deal" | "pipeline";
  dealId?: string;
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/handoff-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, dealId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data = await res.json();
      setBrief(data.brief);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!brief) return;
    await navigator.clipboard.writeText(brief);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <ConfirmButton
        label={loading ? "Generating..." : label}
        confirmText={
          scope === "deal"
            ? "Generate a handoff brief for this deal? This runs a fresh AI summary of the timeline."
            : "Generate a pipeline handoff brief? This runs a fresh AI summary across the whole book."
        }
        confirmLabel="Generate"
        disabled={loading}
        onConfirm={generate}
        className="rounded-full border border-forest-600 px-4 py-1.5 text-sm font-medium text-forest-600 hover:bg-forest-50 disabled:opacity-50"
      />

      {error && <p className="mt-2 text-sm text-warn">{error}</p>}

      {brief && (
        <div className="mt-3 rounded-2xl bg-forest-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-forest-600">Handoff brief</p>
            <button type="button" onClick={copy} className="text-xs text-forest-600 hover:underline">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-ink">{brief}</p>
        </div>
      )}
    </div>
  );
}
