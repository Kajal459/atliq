"use client";

import { useState, useTransition } from "react";
import { generateDealScore } from "./score-actions";

function scoreTone(score: number) {
  if (score >= 70) return { border: "border-forest-200", bg: "bg-forest-50", text: "text-forest-700", bar: "bg-forest-600" };
  if (score >= 40) return { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-800", bar: "bg-amber-500" };
  return { border: "border-coral-200", bg: "bg-coral-50", text: "text-coral-700", bar: "bg-coral-600" };
}

export function DealScoreCard({
  dealId,
  score,
  rationale,
  updatedAt,
}: {
  dealId: string;
  score: number | null;
  rationale: string | null;
  updatedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateDealScore(dealId);
      if (!result.ok) setError(result.message ?? "Something went wrong.");
    });
  }

  if (score == null) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-gray-300 px-4 py-3">
        <p className="text-xs text-gray-500">
          No AI success score yet - estimated from this deal&apos;s full timeline.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={pending}
            className="whitespace-nowrap rounded-full border border-forest-600 px-3 py-1.5 text-xs font-medium text-forest-600 hover:bg-forest-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Scoring..." : "Generate success score"}
          </button>
          {error && <p className="text-xs text-warn">{error}</p>}
        </div>
      </div>
    );
  }

  const tone = scoreTone(score);

  return (
    <div className={`mb-4 rounded-xl border ${tone.border} ${tone.bg} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-xs font-bold uppercase tracking-wide ${tone.text}`}>AI success score</p>
          <p className="mt-1 font-serif text-3xl text-ink">
            {score}
            <span className="text-base text-gray-400">/100 likely to close Won</span>
          </p>
          {rationale && <p className="mt-1.5 text-sm text-gray-700">{rationale}</p>}
          {updatedAt && <p className="mt-1.5 text-[11px] text-gray-400">Updated {updatedAt}</p>}
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          className="whitespace-nowrap rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Scoring..." : "Refresh"}
        </button>
      </div>
      <div className="mt-3 h-1.5 w-full rounded-full bg-white/70">
        <div className={`h-1.5 rounded-full ${tone.bar}`} style={{ width: `${score}%` }} />
      </div>
      {error && <p className="mt-2 text-xs text-warn">{error}</p>}
    </div>
  );
}
