import { prisma } from "@/lib/db";
import { OWNERS } from "@/lib/automation/owner";
import { SIGNAL_TYPE_PRIORITY, headlineForSignal } from "@/lib/automation/describe-signal";
import { ApprovalInboxClient, type PendingSignal } from "./ApprovalInboxClient";

export const dynamic = "force-dynamic";

type SignalWithRelations = Awaited<ReturnType<typeof prisma.signal.findMany>>[number] & {
  deal: { company: string } | null;
  sourceEvent: { filename: string | null; subject: string | null } | null;
};

export default async function ApprovalInboxPage() {
  const signals = (await prisma.signal.findMany({
    where: { status: "pending" },
    include: { deal: true, sourceEvent: { select: { filename: true, subject: true } } },
    orderBy: { createdAt: "asc" },
  })) as SignalWithRelations[];

  signals.sort((a, b) => {
    const pa = SIGNAL_TYPE_PRIORITY[a.type] ?? 9;
    const pb = SIGNAL_TYPE_PRIORITY[b.type] ?? 9;
    return pa !== pb ? pa - pb : a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Flatten to plain, serializable data (no Date/Decimal objects) before
  // handing off to the client component that owns filtering/sorting state.
  const plainSignals: PendingSignal[] = signals.map((s) => ({
    id: s.id,
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
    company: s.deal?.company ?? null,
    sourceFilename: s.sourceEvent?.filename ?? null,
    sourceSubject: s.sourceEvent?.subject ?? null,
    headline: headlineForSignal(s),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl italic text-ink">Approval Inbox</h1>
        <p className="mt-1 text-sm text-gray-500">
          Nothing is written, sent, or scheduled until someone taps Approve. Sorted so the highest-value items -
          new leads and due reminders - come first.
        </p>
      </div>

      <ApprovalInboxClient signals={plainSignals} owners={OWNERS} />
    </div>
  );
}
