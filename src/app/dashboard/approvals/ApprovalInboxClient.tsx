"use client";

import { useEffect, useMemo, useState } from "react";
import { SIGNAL_TYPE_META } from "@/lib/automation/describe-signal";
import { submitApproval } from "./actions";

export interface PendingSignal {
  id: string;
  type: string;
  field: string | null;
  proposedValue: string | null;
  previousValue: string | null;
  citationQuote: string;
  confidence: string;
  reasoning: string | null;
  suggestedServiceLine: string | null;
  leadSource: string | null;
  company: string | null;
  sourceFilename: string | null;
  sourceSubject: string | null;
  headline: string;
}

const ACTOR_STORAGE_KEY = "atliq-actor";

export function ApprovalInboxClient({ signals, owners }: { signals: PendingSignal[]; owners: readonly string[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [actor, setActor] = useState<string>("");

  // Remembers "Acting as" in this browser so it isn't re-picked on every
  // single approval - read once on mount, persisted on every change.
  useEffect(() => {
    const saved = window.localStorage.getItem(ACTOR_STORAGE_KEY);
    if (saved) setActor(saved);
  }, []);

  useEffect(() => {
    if (actor) window.localStorage.setItem(ACTOR_STORAGE_KEY, actor);
  }, [actor]);

  const counts = useMemo(() => {
    return signals.reduce<Record<string, number>>((acc, s) => {
      acc[s.type] = (acc[s.type] ?? 0) + 1;
      return acc;
    }, {});
  }, [signals]);

  const filtered = useMemo(
    () => (filter === "all" ? signals : signals.filter((s) => s.type === filter)),
    [signals, filter]
  );

  if (signals.length === 0) {
    return (
      <p className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-500">
        Nothing pending right now.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 font-medium transition-colors ${
            filter === "all" ? "bg-forest-600 text-white" : "border border-gray-200 bg-white text-gray-600 hover:border-forest-300"
          }`}
        >
          All ({signals.length})
        </button>
        {Object.entries(counts).map(([type, count]) => (
          <button
            key={type}
            type="button"
            onClick={() => setFilter(type)}
            className={`rounded-full px-3 py-1 font-medium transition-colors ${
              filter === type ? "bg-forest-600 text-white" : "border border-gray-200 bg-white text-gray-600 hover:border-forest-300"
            }`}
          >
            {SIGNAL_TYPE_META[type]?.icon ?? "•"} {count} {SIGNAL_TYPE_META[type]?.label.toLowerCase() ?? type}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-500">
            Nothing waiting in this filter right now.
          </p>
        ) : (
          filtered.map((signal) => (
            <ApprovalCard key={signal.id} signal={signal} owners={owners} actor={actor} onActorChange={setActor} />
          ))
        )}
      </div>
    </div>
  );
}

function ApprovalCard({
  signal,
  owners,
  actor,
  onActorChange,
}: {
  signal: PendingSignal;
  owners: readonly string[];
  actor: string;
  onActorChange: (value: string) => void;
}) {
  const meta = SIGNAL_TYPE_META[signal.type] ?? { icon: "•", label: signal.type.replace(/_/g, " ") };
  const hasEditableField = Boolean(signal.field);
  const hasEditableDraft = !signal.field && signal.type === "deferral_reminder" && Boolean(signal.proposedValue);

  return (
    <form action={submitApproval} className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
      <input type="hidden" name="signalId" value={signal.id} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 text-base">{meta.icon}</span>
          <div>
            <span className="mr-2 rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-forest-700">
              {meta.label}
            </span>
            <p className="mt-1 font-medium leading-snug text-ink">{signal.headline}</p>
          </div>
        </div>
        {signal.confidence === "low" && (
          <span className="whitespace-nowrap rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            low confidence
          </span>
        )}
      </div>

      <details className="mt-2 ml-7">
        <summary className="cursor-pointer text-xs font-medium text-forest-600">Why is this here?</summary>
        <div className="mt-2 space-y-1.5">
          <p className="rounded bg-gray-50 p-2 text-gray-700">&ldquo;{signal.citationQuote}&rdquo;</p>
          {signal.reasoning && <p className="text-xs text-gray-500">{signal.reasoning}</p>}
          <p className="text-xs text-gray-400">Source: {signal.sourceFilename ?? "system"}</p>
        </div>
      </details>

      {hasEditableField && (
        <div className="mt-3 ml-7 flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">{signal.field}:</label>
          <input
            name="editedValue"
            defaultValue={signal.proposedValue ?? ""}
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
      )}

      {hasEditableDraft && (
        <div className="mt-3 ml-7 space-y-1">
          <label className="text-xs font-medium text-gray-500">Drafted email (edit before sending yourself):</label>
          <textarea
            name="editedValue"
            defaultValue={signal.proposedValue ?? ""}
            rows={5}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
      )}

      <div className="mt-3 ml-7 flex items-center justify-between border-t border-gray-100 pt-3">
        <select
          name="actor"
          required
          value={actor}
          onChange={(e) => onActorChange(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-xs"
        >
          <option value="" disabled>
            Acting as...
          </option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <button
            type="submit"
            name="action"
            value="reject"
            className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Reject
          </button>
          {(hasEditableField || hasEditableDraft) && (
            <button
              type="submit"
              name="action"
              value="edit"
              className="rounded-full border border-forest-600 px-3 py-1.5 text-xs font-medium text-forest-600 hover:bg-forest-50"
            >
              Edit &amp; Approve
            </button>
          )}
          <button
            type="submit"
            name="action"
            value="approve"
            className="rounded-full bg-forest-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-700"
          >
            Approve
          </button>
        </div>
      </div>
    </form>
  );
}
