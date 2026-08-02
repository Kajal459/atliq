import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { HandoffBriefButton } from "../../_components/HandoffBriefButton";
import { FollowupDateField } from "./FollowupDateField";
import { DealApprovalItems } from "./DealApprovalItems";
import { DealScoreCard } from "./DealScoreCard";
import { OWNERS } from "@/lib/automation/owner";
import { headlineForSignal } from "@/lib/automation/describe-signal";
import type { PendingSignal } from "../../approvals/ApprovalInboxClient";

export const dynamic = "force-dynamic";

export default async function DealTimelinePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { signal?: string };
}) {
  const deal = await prisma.deal.findUnique({
    where: { id: params.id },
    include: {
      sourceEvents: { orderBy: { occurredAt: "asc" }, include: { signals: true } },
      auditLogs: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!deal) notFound();

  const pendingDealSignals = await prisma.signal.findMany({
    where: { dealId: deal.id, status: "pending" },
    include: { sourceEvent: { select: { filename: true, subject: true } } },
    orderBy: { createdAt: "desc" },
  });

  const pendingItems: PendingSignal[] = pendingDealSignals.map((s) => ({
    id: s.id,
    dealId: deal.id,
    type: s.type,
    field: s.field,
    proposedValue: s.proposedValue,
    previousValue: s.previousValue,
    citationQuote: s.citationQuote,
    confidence: s.confidence,
    reasoning: s.reasoning,
    suggestedServiceLine: s.suggestedServiceLine,
    leadSource: s.leadSource,
    reviewerNote: s.reviewerNote,
    company: deal.company,
    successScore: deal.successScore ?? null,
    successScoreRationale: deal.successScoreRationale ?? null,
    lastActivityDate: deal.lastContactDate?.toISOString().slice(0, 10) ?? null,
    source: deal.source ?? null,
    serviceInterest: deal.serviceInterest ?? null,
    sourceFilename: s.sourceEvent?.filename ?? null,
    sourceSubject: s.sourceEvent?.subject ?? null,
    headline: headlineForSignal({
      type: s.type,
      field: s.field,
      proposedValue: s.proposedValue,
      previousValue: s.previousValue,
      leadSource: s.leadSource,
      suggestedServiceLine: s.suggestedServiceLine,
      deal: { company: deal.company },
    }),
  }));

  type TimelineEntry =
    | { kind: "event"; at: Date; data: (typeof deal.sourceEvents)[number] }
    | { kind: "audit"; at: Date; data: (typeof deal.auditLogs)[number] };

  const timeline: TimelineEntry[] = [
    ...deal.sourceEvents
      .filter((e) => e.filename !== "(system)")
      .map((e): TimelineEntry => ({ kind: "event", at: e.occurredAt ?? e.createdAt, data: e })),
    ...deal.auditLogs.map((a): TimelineEntry => ({ kind: "audit", at: a.createdAt, data: a })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-cream-100 bg-white p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-serif text-2xl text-ink">{deal.company}</h1>
              <span
                title={
                  deal.successScore != null
                    ? `AI success score: ${deal.successScore}/100${
                        deal.successScoreRationale ? ` - ${deal.successScoreRationale}` : ""
                      }`
                    : "No AI success score yet - generate one below."
                }
                className="inline-flex cursor-help items-center justify-center rounded-full text-gray-400 hover:text-forest-600"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a1 1 0 0 0 0 2h.01v3a1 1 0 0 0 1 1H11a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9Z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </div>
            <p className="text-sm text-gray-500">{deal.leadId} - {deal.serviceInterest ?? "unknown service interest"}</p>
          </div>
          {deal.stale && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              Stale since {deal.staleSince?.toISOString().slice(0, 10)}
            </span>
          )}
        </div>

        <div className="mt-4">
          <DealScoreCard
            dealId={deal.id}
            score={deal.successScore}
            rationale={deal.successScoreRationale}
            updatedAt={deal.successScoreUpdatedAt?.toISOString().slice(0, 10) ?? null}
          />
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Field label="Stage" value={deal.stage} />
          <Field label="Owner" value={deal.owner ?? "unassigned"} />
          <Field label="Value" value={deal.estValueUsd ? `$${deal.estValueUsd.toLocaleString()}` : "-"} />
          <FollowupDateField
            dealId={deal.id}
            initialValue={deal.nextFollowupDate ? deal.nextFollowupDate.toISOString().slice(0, 10) : null}
            owners={OWNERS}
          />
          <Field label="Contact" value={deal.contactName ?? "-"} />
          <Field label="Source" value={deal.source ?? "-"} />
          <Field label="Created" value={deal.createdDate?.toISOString().slice(0, 10) ?? "-"} />
          <Field label="Last contact" value={deal.lastContactDate?.toISOString().slice(0, 10) ?? "-"} />
        </dl>
        <div className="mt-4 border-t border-cream-100 pt-4">
          <HandoffBriefButton scope="deal" dealId={deal.id} label="Generate handoff brief" />
        </div>
      </div>

      <DealApprovalItems signals={pendingItems} owners={OWNERS} highlightId={searchParams.signal ?? null} />

      <div>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">Timeline</h2>
        <div className="space-y-3">
          {timeline.map((entry, i) =>
            entry.kind === "event" ? (
              <EventCard key={`e-${i}`} event={entry.data} />
            ) : (
              <AuditCard key={`a-${i}`} audit={entry.data} />
            )
          )}
          {timeline.length === 0 && (
            <p className="border-l-2 border-forest-600 py-1 pl-4 text-sm text-gray-500">
              No email or meeting-note activity recorded for this deal yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function EventCard({
  event,
}: {
  event: {
    id: string;
    type: string;
    filename: string | null;
    subject: string | null;
    body: string;
    signals: { id: string; type: string; status: string; citationQuote: string }[];
  };
}) {
  return (
    <div className="rounded-xl border border-cream-100 bg-white p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {event.type === "email" ? "Email" : event.type === "meeting_note" ? "Meeting note" : "Reply"}
        </span>
        <span className="text-xs text-gray-400">{event.filename}</span>
      </div>
      {event.subject && <p className="mt-2 font-medium text-ink">{event.subject}</p>}
      <p className="mt-1 whitespace-pre-line text-gray-600 line-clamp-4">{event.body}</p>
      {event.signals.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {event.signals.map((s) => (
            <span
              key={s.id}
              title={s.citationQuote}
              className="rounded-full bg-forest-50 px-2.5 py-0.5 text-xs text-accent"
            >
              {s.type.replace(/_/g, " ")} · {s.status.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditCard({ audit }: { audit: { action: string; detail: string; actor: string; createdAt: Date } }) {
  return (
    <div className="border-l-2 border-gray-200 py-1.5 pl-4 text-xs text-gray-600">
      <span className="font-medium text-gray-700">{audit.actor}</span> - {audit.action.replace(/_/g, " ")}:{" "}
      {audit.detail}
      <span className="ml-2 text-gray-400">{audit.createdAt.toISOString().slice(0, 10)}</span>
    </div>
  );
}
