"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SIGNAL_TYPE_META } from "@/lib/automation/describe-signal";
import { submitApproval, submitBulkApproval, submitBulkReject, saveReviewerNote } from "./actions";
import { ConfirmButton } from "../_components/ConfirmButton";

export interface PendingSignal {
  id: string;
  dealId: string | null;
  type: string;
  field: string | null;
  proposedValue: string | null;
  previousValue: string | null;
  citationQuote: string;
  confidence: string;
  reasoning: string | null;
  suggestedServiceLine: string | null;
  leadSource: string | null;
  reviewerNote: string | null;
  company: string | null;
  successScore: number | null;
  successScoreRationale: string | null;
  lastActivityDate: string | null;
  source: string | null;
  serviceInterest: string | null;
  sourceFilename: string | null;
  sourceSubject: string | null;
  headline: string;
}

const ACTOR_STORAGE_KEY = "atliq-actor";

// Friendly labels for the raw snake_case CRM field names a signal can
// propose changing - "next_followup_date" in particular gets its own date
// input below rather than a plain text box, since that's the field the
// Deferral & Reach-Back Scheduler and the digest both key off of.
function formatFieldLabel(field: string): string {
  if (field === "next_followup_date") return "Next follow-up date";
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Info icon next to a deal name - click to see the AI success score and its
// one-line reason (same wording as the deal page). A click-to-open popover
// rather than a bare title tooltip, since title tooltips are easy to miss
// and don't work at all on touch devices.
function ScoreInfoIcon({ score, rationale }: { score: number | null; rationale: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="AI success score"
        className="inline-flex shrink-0 items-center justify-center rounded-full text-gray-400 hover:text-forest-600"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a1 1 0 0 0 0 2h.01v3a1 1 0 0 0 1 1H11a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-cream-100 bg-white p-3 text-left text-xs normal-case shadow-lg"
        >
          {score != null ? (
            <>
              <p className="font-bold text-ink">AI success score: {score}/100</p>
              {rationale && <p className="mt-1 text-gray-600">{rationale}</p>}
            </>
          ) : (
            <p className="text-gray-500">No AI success score yet - open the deal to generate one.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Inline "Assigned to" picker shown in place of a plain disabled hint - lets
// someone assign themselves right where they are (inside an actions menu or
// edit popup) instead of having to scroll back up to the toolbar control.
function AssignedToPicker({
  actor,
  owners,
  onActorChange,
}: {
  actor: string;
  owners: readonly string[];
  onActorChange: (value: string) => void;
}) {
  return (
    <div className="px-3 py-1.5">
      <label className="block text-[11px] text-gray-400">Assigned to</label>
      <select
        value={actor}
        onChange={(e) => onActorChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
      >
        <option value="" disabled>
          Choose...
        </option>
        {owners.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

// Everything a search should be able to match against - not just the deal
// name and headline, but the raw material behind the signal (the citation,
// reasoning, source file, proposed/previous values, notes) so a founder can
// paste in a phrase they remember and find the item it came from.
function searchableText(s: PendingSignal): string {
  return [
    s.company,
    s.headline,
    s.citationQuote,
    s.reasoning,
    s.field,
    s.proposedValue,
    s.previousValue,
    s.leadSource,
    s.suggestedServiceLine,
    s.reviewerNote,
    s.source,
    s.serviceInterest,
    s.sourceFilename,
    s.sourceSubject,
  ]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
}

export function ApprovalInboxClient({ signals, owners }: { signals: PendingSignal[]; owners: readonly string[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [actor, setActor] = useState<string>("");
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("signal");

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

  const sources = useMemo(() => {
    return Array.from(new Set(signals.map((s) => s.source).filter((v): v is string => Boolean(v)))).sort();
  }, [signals]);

  const serviceInterests = useMemo(() => {
    return Array.from(new Set(signals.map((s) => s.serviceInterest).filter((v): v is string => Boolean(v)))).sort();
  }, [signals]);

  const filtered = useMemo(() => {
    const byType = filter === "all" ? signals : signals.filter((s) => s.type === filter);
    const bySource = sourceFilter === "all" ? byType : byType.filter((s) => s.source === sourceFilter);
    const byService = serviceFilter === "all" ? bySource : bySource.filter((s) => s.serviceInterest === serviceFilter);
    const q = search.trim().toLowerCase();
    if (!q) return byService;
    return byService.filter((s) => searchableText(s).includes(q));
  }, [signals, filter, sourceFilter, serviceFilter, search]);

  // Multiple pending signals on the same client collapse into one summary
  // row here - the full per-message list (with individual approve/reject/
  // edit) lives on that deal's own page instead. Signals with no matched
  // deal yet (e.g. a brand-new lead) can't be grouped, so they still show
  // individually, in full. Order follows `filtered`, which is already
  // most-recent-first, so each group appears at its most recent signal's
  // position.
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const result: (
      | { kind: "group"; key: string; group: PendingSignal[] }
      | { kind: "single"; key: string; signal: PendingSignal }
    )[] = [];
    for (const signal of filtered) {
      if (signal.dealId) {
        if (seen.has(signal.dealId)) continue;
        seen.add(signal.dealId);
        result.push({
          kind: "group",
          key: signal.dealId,
          group: filtered.filter((s) => s.dealId === signal.dealId),
        });
      } else {
        result.push({ kind: "single", key: signal.id, signal });
      }
    }
    return result;
  }, [filtered]);

  if (signals.length === 0) {
    return (
      <p className="border-l-2 border-forest-600 py-1 pl-4 text-sm text-gray-500">
        Nothing pending right now.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Big search first - matches raw source data, not just the deal name,
          so a remembered phrase can find the item it came from. */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search deals, messages, citations, notes..."
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:border-forest-500 focus:outline-none"
      />

      {/* Filters in one line, with the global "Acting as" selector every
          row's actions use, instead of re-picking it per card. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-full border px-3 py-1.5 font-medium transition-colors ${
              filter === "all" ? "border-forest-600 bg-forest-600 text-white" : "border-cream-200 bg-white text-ink hover:border-forest-300"
            }`}
          >
            All ({signals.length})
          </button>
          {Object.entries(counts).map(([type, count]) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilter(type)}
              className={`rounded-full border px-3 py-1.5 font-medium transition-colors ${
                filter === type ? "border-forest-600 bg-forest-600 text-white" : "border-cream-200 bg-white text-ink hover:border-forest-300"
              }`}
            >
              {SIGNAL_TYPE_META[type]?.icon ?? "•"} {count} {SIGNAL_TYPE_META[type]?.label.toLowerCase() ?? type}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {sources.length > 0 && (
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
            >
              <option value="all">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {serviceInterests.length > 0 && (
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
            >
              <option value="all">All service interests</option>
              {serviceInterests.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          <select
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
          >
            <option value="">All</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="border-l-2 border-forest-600 py-1 pl-4 text-sm text-gray-500">
          Nothing waiting in this filter right now.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-cream-100 bg-white shadow-sm">
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
              {rows.map((row) =>
                row.kind === "group" ? (
                  <GroupedDealRow
                    key={row.key}
                    signals={row.group}
                    actor={actor}
                    onActorChange={setActor}
                    owners={owners}
                    highlightId={highlightId}
                  />
                ) : (
                  <ApprovalRow
                    key={row.key}
                    signal={row.signal}
                    actor={actor}
                    onActorChange={setActor}
                    owners={owners}
                    autoExpand={row.signal.id === highlightId}
                  />
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// One row per client on the main Approval Inbox - the "what needs to be
// done" summary, not the individual messages themselves. "Approve all"
// submits every pending signal for this deal exactly as AI-proposed; anyone
// who wants to edit or reject just one of them clicks through to the deal
// page instead, where each message keeps its own full row.
function GroupedDealRow({
  signals,
  actor,
  onActorChange,
  owners,
  highlightId,
}: {
  signals: PendingSignal[];
  actor: string;
  onActorChange: (value: string) => void;
  owners: readonly string[];
  highlightId: string | null;
}) {
  // "Most recent" - signals arrive here already sorted most-recent-first, so
  // the first one drives the Type and Message columns, same as an
  // individual row. The rest of the group is summarized as a count.
  const first = signals[0];
  const dealId = first.dealId!;
  const meta = SIGNAL_TYPE_META[first.type] ?? { icon: "•", label: first.type.replace(/_/g, " ") };
  const extraCount = signals.length - 1;
  const isHighlighted = signals.some((s) => s.id === highlightId);
  const [submitting, startSubmitting] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const rowRef = useRef<HTMLTableRowElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHighlighted) {
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function approveAll() {
    startSubmitting(async () => {
      await submitBulkApproval(
        signals.map((s) => s.id),
        actor
      );
      setMenuOpen(false);
    });
  }

  function rejectAll() {
    startSubmitting(async () => {
      await submitBulkReject(
        signals.map((s) => s.id),
        actor
      );
      setMenuOpen(false);
    });
  }

  // Disabled state is spelled out with an explicit gray text color, not just
  // reduced opacity - a lighter color like the "Approve edit" forest-600
  // washed out to gray at 50% opacity, while a bolder one like "Approve"
  // stayed legible, making the two look inconsistently disabled even though
  // both are equally blocked on picking "Acting as" first.
  const menuItemClass =
    "block w-full rounded-lg px-3 py-2 text-left text-xs font-medium disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent";

  return (
    <tr
      ref={rowRef}
      className={`border-b border-cream-100 align-top transition-colors last:border-b-0 hover:bg-cream-50/40 ${
        isHighlighted ? "bg-forest-50/60 ring-1 ring-inset ring-forest-200" : ""
      }`}
    >
      <td className="px-4 py-3.5 font-medium text-ink">
        <div className="flex items-center gap-1.5">
          <Link href={`/dashboard/deals/${dealId}`} className="hover:underline">
            {first.company ?? "Unmatched"}
          </Link>
          <ScoreInfoIcon score={first.successScore} rationale={first.successScoreRationale} />
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-forest-700">
          {meta.icon} {meta.label}
        </span>
        {first.confidence === "low" && (
          <span className="mt-1 block whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            low confidence
          </span>
        )}
      </td>
      <td className="min-w-[220px] max-w-xs px-4 py-3.5">
        <p className="leading-snug text-ink">{first.headline}</p>
        {extraCount > 0 && (
          <p className="mt-1 text-xs text-gray-500">
            +{extraCount} more item{extraCount === 1 ? "" : "s"} waiting
          </p>
        )}
        <Link
          href={`/dashboard/deals/${dealId}`}
          className="mt-1.5 inline-block text-xs font-medium text-forest-600 hover:underline"
        >
          Review individually →
        </Link>
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-gray-600">{formatDate(first.lastActivityDate)}</td>
      <td className="whitespace-nowrap px-4 py-3.5 text-gray-600">{first.source ?? "—"}</td>
      <td className="max-w-[160px] truncate px-4 py-3.5 text-gray-600" title={first.serviceInterest ?? undefined}>
        {first.serviceInterest ?? "—"}
      </td>
      <td className="px-4 py-3.5 text-right">
        <div className="relative inline-block text-left" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Actions"
            className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <circle cx="10" cy="4" r="1.5" />
              <circle cx="10" cy="10" r="1.5" />
              <circle cx="10" cy="16" r="1.5" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-xl border border-cream-100 bg-white p-1.5 shadow-lg">
              {!actor && <AssignedToPicker actor={actor} owners={owners} onActorChange={onActorChange} />}
              <Link
                href={`/dashboard/deals/${dealId}`}
                className={`${menuItemClass} text-gray-600 hover:bg-gray-50`}
              >
                ↗ Review individually
              </Link>
              <ConfirmButton
                label={submitting ? "Working..." : `✕ Reject all (${signals.length})`}
                confirmText={`Reject all ${signals.length} pending item${signals.length === 1 ? "" : "s"} for ${
                  first.company ?? "this deal"
                }${actor ? ` as ${actor}` : ""}? Each is removed from the queue and logged either way.`}
                confirmLabel="Reject all"
                tone="danger"
                disabled={!actor || submitting}
                onConfirm={rejectAll}
                className={`${menuItemClass} text-coral-700 hover:bg-coral-50`}
              />
              <ConfirmButton
                label={submitting ? "Working..." : `✓ Approve all (${signals.length})`}
                confirmText={`Approve all ${signals.length} pending item${signals.length === 1 ? "" : "s"} for ${
                  first.company ?? "this deal"
                }${actor ? ` as ${actor}` : ""}? Each applies with its own AI-proposed value - review individually on the deal page instead if any need edits first.`}
                confirmLabel="Approve all"
                disabled={!actor || submitting}
                onConfirm={approveAll}
                className={`${menuItemClass} font-semibold text-forest-700 hover:bg-forest-50`}
              />
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export function ApprovalRow({
  signal,
  actor,
  onActorChange,
  owners,
  autoExpand,
}: {
  signal: PendingSignal;
  actor: string;
  onActorChange: (value: string) => void;
  owners: readonly string[];
  autoExpand?: boolean;
}) {
  const meta = SIGNAL_TYPE_META[signal.type] ?? { icon: "•", label: signal.type.replace(/_/g, " ") };
  const hasEditableField = Boolean(signal.field);
  const isDateField = signal.field === "next_followup_date";
  const hasEditableDraft = !signal.field && signal.type === "deferral_reminder" && Boolean(signal.proposedValue);
  const [expanded, setExpanded] = useState(Boolean(autoExpand));
  const [editedValue, setEditedValue] = useState(signal.proposedValue ?? signal.headline);
  const [note, setNote] = useState(signal.reviewerNote ?? "");
  const [draftNote, setDraftNote] = useState(note);
  const [commentOpen, setCommentOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [savingNote, startSavingNote] = useTransition();
  const [submittingEdit, startSubmittingEdit] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  // Deep-linked from the dashboard's "highest priority" card - land on this
  // exact row already expanded, scrolled into view.
  useEffect(() => {
    if (autoExpand) {
      document.getElementById(`signal-${signal.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the actions menu on an outside click.
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function openCommentModal() {
    setDraftNote(note);
    setCommentOpen(true);
    setMenuOpen(false);
  }

  function openEditModal() {
    setEditedValue(signal.proposedValue ?? signal.headline);
    setEditOpen(true);
    setMenuOpen(false);
  }

  function handleApproveEdit() {
    startSubmittingEdit(async () => {
      await submit("edit");
      setEditOpen(false);
    });
  }

  function handleSaveNote() {
    startSavingNote(async () => {
      await saveReviewerNote(signal.id, draftNote);
      setNote(draftNote);
      setNoteSaved(true);
      setCommentOpen(false);
      setTimeout(() => setNoteSaved(false), 2000);
    });
  }

  async function submit(action: "approve" | "reject" | "edit") {
    const formData = new FormData();
    formData.set("signalId", signal.id);
    formData.set("action", action);
    formData.set("actor", actor);
    if (action === "edit") formData.set("editedValue", editedValue);
    await submitApproval(formData);
    setMenuOpen(false);
  }

  // Disabled state is spelled out with an explicit gray text color, not just
  // reduced opacity - a lighter color like the "Approve edit" forest-600
  // washed out to gray at 50% opacity, while a bolder one like "Approve"
  // stayed legible, making the two look inconsistently disabled even though
  // both are equally blocked on picking "Acting as" first.
  const menuItemClass =
    "block w-full rounded-lg px-3 py-2 text-left text-xs font-medium disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent";

  return (
    <>
      <tr
        id={`signal-${signal.id}`}
        className={`border-b border-cream-100 align-top transition-colors last:border-b-0 hover:bg-cream-50/40 ${
          autoExpand ? "bg-forest-50/60 ring-1 ring-inset ring-forest-200" : ""
        }`}
      >
        <td className="px-4 py-3.5 font-medium text-ink">
          <div className="flex items-center gap-1.5">
            {signal.dealId ? (
              <Link href={`/dashboard/deals/${signal.dealId}`} className="hover:underline">
                {signal.company ?? "Unmatched"}
              </Link>
            ) : (
              <span className="text-gray-400">{signal.company ?? "Unmatched"}</span>
            )}
            {signal.dealId && <ScoreInfoIcon score={signal.successScore} rationale={signal.successScoreRationale} />}
          </div>
        </td>
        <td className="whitespace-nowrap px-4 py-3.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-forest-700">
            {meta.icon} {meta.label}
          </span>
          {signal.confidence === "low" && (
            <span className="mt-1 block whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              low confidence
            </span>
          )}
        </td>
        <td className="min-w-[220px] max-w-xs px-4 py-3.5">
          <p className="leading-snug text-ink">{signal.headline}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs font-medium text-forest-600">
              {expanded ? "Show less" : "Read More"}
            </button>
            {note && (
              <button
                type="button"
                onClick={openCommentModal}
                className="max-w-[180px] truncate text-xs text-gray-500 hover:text-forest-600"
                title={note}
              >
                💬 {note}
              </button>
            )}
          </div>
        </td>
        <td className="whitespace-nowrap px-4 py-3.5 text-gray-600">{formatDate(signal.lastActivityDate)}</td>
        <td className="whitespace-nowrap px-4 py-3.5 text-gray-600">{signal.source ?? "—"}</td>
        <td className="max-w-[160px] truncate px-4 py-3.5 text-gray-600" title={signal.serviceInterest ?? undefined}>
          {signal.serviceInterest ?? "—"}
        </td>
        <td className="px-4 py-3.5 text-right">
          <div className="relative inline-block text-left" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Actions"
              className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <circle cx="10" cy="4" r="1.5" />
                <circle cx="10" cy="10" r="1.5" />
                <circle cx="10" cy="16" r="1.5" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-cream-100 bg-white p-1.5 shadow-lg">
                {!actor && <AssignedToPicker actor={actor} owners={owners} onActorChange={onActorChange} />}
                <button type="button" onClick={openCommentModal} className={`${menuItemClass} text-gray-600 hover:bg-gray-50`}>
                  💬 Comment
                </button>
                <ConfirmButton
                  label="✕ Reject"
                  confirmText={`Reject this ${meta.label.toLowerCase()}${actor ? ` as ${actor}` : ""}? It's removed from the queue and logged either way.`}
                  confirmLabel="Reject"
                  tone="danger"
                  disabled={!actor}
                  onConfirm={() => submit("reject")}
                  className={`${menuItemClass} text-coral-700 hover:bg-coral-50`}
                />
                <button
                  type="button"
                  onClick={openEditModal}
                  disabled={!actor}
                  className={`${menuItemClass} text-forest-600 hover:bg-forest-50`}
                >
                  ✎ Approve edit
                </button>
                <ConfirmButton
                  label="✓ Approve"
                  confirmText={`Approve this ${meta.label.toLowerCase()}${actor ? ` as ${actor}` : ""}? This applies the change to the CRM.`}
                  confirmLabel="Approve"
                  disabled={!actor}
                  onConfirm={() => submit("approve")}
                  className={`${menuItemClass} font-semibold text-forest-700 hover:bg-forest-50`}
                />
              </div>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-cream-100 bg-cream-50/50 last:border-b-0">
          <td colSpan={7} className="px-4 py-3">
            <div className="space-y-1.5">
              <p className="border-l-2 border-cream-200 pl-3 font-serif italic text-gray-700">
                &ldquo;{signal.citationQuote}&rdquo;
              </p>
              {signal.reasoning && <p className="text-xs text-gray-500">{signal.reasoning}</p>}
              <p className="text-xs text-gray-400">Source: {signal.sourceFilename ?? "system"}</p>
            </div>
          </td>
        </tr>
      )}
      {commentOpen && (
        <tr>
          <td colSpan={7} className="p-0">
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
              onClick={() => !savingNote && setCommentOpen(false)}
            >
              <div
                className="w-full max-w-sm rounded-xl border border-cream-100 bg-white p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm font-medium text-ink">Comment on {signal.company ?? "this item"}</p>
                <textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  rows={4}
                  autoFocus
                  placeholder="Anything worth remembering about this one - context, why you're waiting, who to loop in..."
                  className="mt-2 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCommentOpen(false)}
                    disabled={savingNote}
                    className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    disabled={savingNote}
                    className="rounded-full bg-forest-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-700 disabled:opacity-50"
                  >
                    {savingNote ? "Saving..." : "Save & submit"}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
      {editOpen && (
        <tr>
          <td colSpan={7} className="p-0">
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
              onClick={() => !submittingEdit && setEditOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-xl border border-cream-100 bg-white p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm font-medium text-ink">Edit before approving</p>
                <p className="mt-1 text-xs text-gray-500">{signal.company ?? "Unmatched"} - {signal.headline}</p>

                {isDateField ? (
                  <>
                    <label className="mt-3 block text-xs font-medium text-gray-500">
                      {formatFieldLabel(signal.field!)}
                    </label>
                    <input
                      type="date"
                      value={editedValue}
                      onChange={(e) => setEditedValue(e.target.value)}
                      autoFocus
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <p className="mt-1 text-[11px] text-gray-400">currently: {signal.previousValue || "none set"}</p>
                  </>
                ) : hasEditableField ? (
                  <>
                    <label className="mt-3 block text-xs font-medium text-gray-500">
                      {formatFieldLabel(signal.field!)}
                    </label>
                    <input
                      type="text"
                      value={editedValue}
                      onChange={(e) => setEditedValue(e.target.value)}
                      autoFocus
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </>
                ) : hasEditableDraft ? (
                  <>
                    <label className="mt-3 block text-xs font-medium text-gray-500">Drafted email</label>
                    <textarea
                      value={editedValue}
                      onChange={(e) => setEditedValue(e.target.value)}
                      rows={6}
                      autoFocus
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </>
                ) : (
                  <>
                    <label className="mt-3 block text-xs font-medium text-gray-500">Message</label>
                    <textarea
                      value={editedValue}
                      onChange={(e) => setEditedValue(e.target.value)}
                      rows={3}
                      autoFocus
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </>
                )}

                <div className="mt-4 flex items-center justify-between gap-2">
                  {!actor ? (
                    <AssignedToPicker actor={actor} owners={owners} onActorChange={onActorChange} />
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditOpen(false)}
                      disabled={submittingEdit}
                      className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApproveEdit}
                      disabled={submittingEdit || !actor}
                      className="rounded-full bg-forest-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submittingEdit ? "Approving..." : "Approve"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
