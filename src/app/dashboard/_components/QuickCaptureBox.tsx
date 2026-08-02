"use client";

import { useEffect, useState } from "react";
import { submitQuickCapture } from "../quick-capture-actions";
import { ConfirmButton } from "./ConfirmButton";

const ACTOR_STORAGE_KEY = "atliq-actor";

export interface DealOption {
  id: string;
  company: string;
}

// The actual form - reused both inline on the Home dashboard and inside the
// floating launcher's modal (see QuickCaptureLauncher) so there's exactly
// one place that knows how to log a note, however it's opened.
export function QuickCaptureForm({
  owners,
  deals,
  onLogged,
  autoFocus,
}: {
  owners: readonly string[];
  deals: readonly DealOption[];
  onLogged?: () => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [actor, setActor] = useState("");
  const [dealChoice, setDealChoice] = useState("auto");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Reuses the same "Acting as" choice remembered by the Approval Inbox,
  // so picking it once per browser covers both surfaces.
  useEffect(() => {
    const saved = window.localStorage.getItem(ACTOR_STORAGE_KEY);
    if (saved) setActor(saved);
  }, []);

  async function run() {
    const formData = new FormData();
    formData.set("text", text);
    formData.set("actor", actor);
    formData.set("dealChoice", dealChoice);
    const outcome = await submitQuickCapture(formData);
    setResult(outcome);
    if (outcome.ok) {
      setText("");
      setDealChoice("auto");
      onLogged?.();
    }
  }

  const ready = text.trim().length > 0 && actor.length > 0;

  const confirmText =
    dealChoice === "new"
      ? `Log this as a new lead${actor ? ` as ${actor}` : ""}? It won't be attached to any existing deal, even if the text mentions one.`
      : dealChoice === "auto"
        ? `Run this note through extraction${actor ? ` as ${actor}` : ""}? Any changes it finds will land as usual - auto-applied or waiting in the Approval Inbox.`
        : `Log this against ${deals.find((d) => d.id === dealChoice)?.company ?? "the selected deal"}${actor ? ` as ${actor}` : ""}?`;

  return (
    <div>
      <div className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          rows={3}
          placeholder="e.g. &quot;Called Meridian Healthcare - they want to push the demo to next Thursday, budget approved at $40k...&quot;"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-forest-600"
          autoFocus={autoFocus}
        />

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dealChoice}
            onChange={(e) => setDealChoice(e.target.value)}
            className="min-w-[180px] flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
          >
            <option value="auto">Auto-detect the deal from the text</option>
            <option value="new">New lead - not in the CRM yet</option>
            {deals.length > 0 && (
              <optgroup label="Or attach to a specific deal">
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.company}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <select
            value={actor}
            onChange={(e) => {
              setActor(e.target.value);
              window.localStorage.setItem(ACTOR_STORAGE_KEY, e.target.value);
            }}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
          >
            <option value="" disabled>
              Logged by...
            </option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <ConfirmButton
            label="Log note"
            confirmLabel="Log it"
            confirmText={confirmText}
            disabled={!ready}
            onConfirm={run}
            className="ml-auto rounded-full bg-forest-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>
      </div>

      {result && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
            result.ok ? "border-forest-100 bg-forest-50 text-forest-700" : "border-coral-100 bg-coral-50 text-coral-700"
          }`}
        >
          <span className="mt-0.5">{result.ok ? "✓" : "!"}</span>
          <p>{result.message}</p>
        </div>
      )}
    </div>
  );
}

// The Home dashboard's inline section - same form, framed with the page's
// usual section chrome.
export function QuickCaptureBox({ owners, deals }: { owners: readonly string[]; deals: readonly DealOption[] }) {
  return (
    <div id="quick-capture" className="border-t border-cream-100 pt-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Quick capture</h2>
      <p className="mt-1 text-xs text-gray-500">
        A WhatsApp message, a call summary, anything that didn&apos;t come in by email - paste it here and it runs
        through the same extraction as everything else.
      </p>
      <div className="mt-3">
        <QuickCaptureForm owners={owners} deals={deals} />
      </div>
    </div>
  );
}
