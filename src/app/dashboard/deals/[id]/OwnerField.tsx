"use client";

import { useEffect, useState } from "react";
import { setDealOwner } from "./actions";
import { ConfirmButton } from "../../_components/ConfirmButton";

const ACTOR_STORAGE_KEY = "atliq-actor";

// Lets a founder actually assign or reassign which team member owns this
// deal - the "Owner" field used to be read-only display text. Uses the same
// "Acting as" localStorage key as the rest of the deal page so the audit
// log always records who made the change.
export function OwnerField({
  dealId,
  initialValue,
  owners,
}: {
  dealId: string;
  initialValue: string | null;
  owners: readonly string[];
}) {
  const [owner, setOwner] = useState(initialValue ?? "");
  const [actor, setActor] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(ACTOR_STORAGE_KEY);
    if (saved) setActor(saved);
  }, []);

  async function save() {
    const outcome = await setDealOwner(dealId, owner, actor);
    setResult(outcome);
  }

  const changed = owner !== (initialValue ?? "");

  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-400">Owner</dt>
      <dd className="mt-0.5 flex flex-wrap items-center gap-1.5">
        <select
          value={owner}
          onChange={(e) => {
            setOwner(e.target.value);
            setResult(null);
          }}
          className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-ink"
        >
          <option value="">unassigned</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {changed && (
          <ConfirmButton
            label="Save"
            confirmLabel="Save"
            confirmText={
              owner
                ? `Assign this deal to ${owner}${actor ? ` (as ${actor})` : ""}?`
                : `Unassign this deal's owner${actor ? ` (as ${actor})` : ""}?`
            }
            disabled={!actor}
            onConfirm={save}
            className="rounded-full border border-forest-600 px-2.5 py-1 text-xs font-medium text-forest-600 hover:bg-forest-50 disabled:cursor-not-allowed disabled:opacity-40"
          />
        )}
      </dd>
      {!actor && changed && <p className="mt-1 text-[11px] text-gray-400">Pick who you are (top right) to save this.</p>}
      {result && <p className={`mt-1 text-xs ${result.ok ? "text-forest-600" : "text-warn"}`}>{result.message}</p>}
    </div>
  );
}
