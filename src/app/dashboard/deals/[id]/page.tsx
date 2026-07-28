import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { HandoffBriefButton } from "../../_components/HandoffBriefButton";

export const dynamic = "force-dynamic";

export default async function DealTimelinePage({ params }: { params: { id: string } }) {
  const deal = await prisma.deal.findUnique({
    where: { id: params.id },
    include: {
      sourceEvents: { orderBy: { occurredAt: "asc" }, include: { signals: true } },
      auditLogs: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!deal) notFound();

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
      <div className="rounded-2xl bg-cream-50 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink">{deal.company}</h1>
            <p className="text-sm text-gray-500">{deal.leadId} - {deal.serviceInterest ?? "unknown service interest"}</p>
          </div>
          {deal.stale && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              Stale since {deal.staleSince?.toISOString().slice(0, 10)}
            </span>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Field label="Stage" value={deal.stage} />
          <Field label="Owner" value={deal.owner ?? "unassigned"} />
          <Field label="Value" value={deal.estValueUsd ? `$${deal.estValueUsd.toLocaleString()}` : "-"} />
          <Field label="Next follow-up" value={deal.nextFollowupDate?.toISOString().slice(0, 10) ?? "-"} />
          <Field label="Contact" value={deal.contactName ?? "-"} />
          <Field label="Source" value={deal.source ?? "-"} />
          <Field label="Created" value={deal.createdDate?.toISOString().slice(0, 10) ?? "-"} />
          <Field label="Last contact" value={deal.lastContactDate?.toISOString().slice(0, 10) ?? "-"} />
        </dl>
        <div className="mt-4 border-t border-cream-100 pt-4">
          <HandoffBriefButton scope="deal" dealId={deal.id} label="Generate handoff brief" />
        </div>
      </div>

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
            <p className="rounded-xl bg-cream-50 p-4 text-sm text-gray-500">
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
    <div className="rounded-2xl bg-cream-50 p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600">
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
              className="rounded-full bg-white px-2.5 py-0.5 text-xs text-accent"
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
    <div className="rounded-2xl bg-gray-50 p-3 text-xs text-gray-600">
      <span className="font-medium text-gray-700">{audit.actor}</span> - {audit.action.replace(/_/g, " ")}:{" "}
      {audit.detail}
      <span className="ml-2 text-gray-400">{audit.createdAt.toISOString().slice(0, 10)}</span>
    </div>
  );
}
