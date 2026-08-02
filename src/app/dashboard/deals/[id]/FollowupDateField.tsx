"use client";

import { useEffect, useState } from "react";
import { setDealFollowupDate } from "./actions";
import { ConfirmButton } from "../../_components/ConfirmButton";

const ACTOR_STORAGE_KEY = "atliq-actor";

// Manual calendar control for a deal's next-follow-up date - lives on the
// Deal Timeline page so setting or clearing it doesn't require waiting for
// the AI to infer a deferral signal from text first. Shares the same
// "Acting as" choice (and localStorage key) as the Approval Inbox and Quick
// Capture, so picking it once per browser covers every surface.
export function FollowupDateField({
  dealId,
  initialValue,
  owners,
}: {
  dealId: string;
  initialValue: string | null;
  owners: readonly string[];
}) {
  const [date, setDate] = useState(initialValue ?? "");
  const [actor, setActor] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(ACTOR_STORAGE_KEY);
    if (saved) setActor(saved);
  }, []);

  async function save() {
    const outcome = await setDealFollowupDate(dealId, date, actor);
    setResult(outcome);
  }

  const changed = date !== (initialValue ?? "");

  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-400">Next follow-up</dt>
      <dd className="mt-0.5 flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setResult(null);
          }}
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-ink"
        />
        <select
          value={actor}
          onChange={(e) => {
            setActor(e.target.value);
            window.localStorage.setItem(ACTOR_STORAGE_KEY, e.target.value);
          }}
          className="rounded-lg border border-gray-300 px-1.5 py-1 text-xs text-gray-600"
        >
          <option value="" disabled>
            Assigned to...
          </option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ConfirmButton
          label="Save"
          confirmLabel="Save"
          confirmText={
            date
              ? `Set this deal's next follow-up to ${date}${actor ? ` as ${actor}` : ""}?`
              : `Clear this deal's next follow-up date${actor ? ` as ${actor}` : ""}?`
          }
          disabled={!changed || !actor}
          onConfirm={save}
          className="rounded-full border border-forest-600 px-2.5 py-1 text-xs font-medium text-forest-600 hover:bg-forest-50 disabled:cursor-not-allowed disabled:opacity-40"
        />
      </dd>
      {result && <p className={`mt-1 text-xs ${result.ok ? "text-forest-600" : "text-warn"}`}>{result.message}</p>}
    </div>
  );
}
