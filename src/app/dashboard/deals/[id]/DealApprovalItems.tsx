"use client";

import { useEffect, useState } from "react";
import { ApprovalRow, type PendingSignal } from "../../approvals/ApprovalInboxClient";

const ACTOR_STORAGE_KEY = "atliq-actor";

// Lets a founder approve/reject/edit/comment on this specific deal's pending
// items right from the Deal Timeline page - same row UI (and same editable
// message + full actions) as the Approval Inbox, just reused here so the two
// surfaces never drift apart.
export function DealApprovalItems({
  signals,
  owners,
  highlightId,
}: {
  signals: PendingSignal[];
  owners: readonly string[];
  highlightId?: string | null;
}) {
  const [actor, setActor] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(ACTOR_STORAGE_KEY);
    if (saved) setActor(saved);
  }, []);

  useEffect(() => {
    if (actor) window.localStorage.setItem(ACTOR_STORAGE_KEY, actor);
  }, [actor]);

  if (signals.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">
          Waiting on your approval ({signals.length})
        </h2>
        <select
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
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
      </div>
      <div className="overflow-x-auto rounded-xl border border-cream-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cream-100 bg-cream-50/50 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Deal</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Message</th>
              <th className="px-4 py-3 font-medium">Last activity</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Service interest</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => (
              <ApprovalRow
                key={signal.id}
                signal={signal}
                actor={actor}
                autoExpand={Boolean(highlightId) && signal.id === highlightId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
