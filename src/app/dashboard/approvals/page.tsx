import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { OWNERS } from "@/lib/automation/owner";
import { headlineForSignal } from "@/lib/automation/describe-signal";
import { ApprovalInboxClient, type PendingSignal } from "./ApprovalInboxClient";

export const dynamic = "force-dynamic";

type SignalWithRelations = Awaited<ReturnType<typeof prisma.signal.findMany>>[number] & {
  deal: {
    company: string;
    lastContactDate: Date | null;
    nextFollowupDate: Date | null;
    source: string | null;
    serviceInterest: string | null;
    successScore: number | null;
    successScoreRationale: string | null;
  } | null;
  sourceEvent: { filename: string | null; subject: string | null } | null;
};

export default async function ApprovalInboxPage() {
  const signals = (await prisma.signal.findMany({
    where: { status: "pending" },
    include: { deal: true, sourceEvent: { select: { filename: true, subject: true } } },
    orderBy: { createdAt: "desc" },
  })) as SignalWithRelations[];

  // Most recent first - whatever just came in is what a founder is most
  // likely checking on right after logging or receiving it.
  signals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Flatten to plain, serializable data (no Date/Decimal objects) before
  // handing off to the client component that owns filtering/sorting state.
  const plainSignals: PendingSignal[] = signals.map((s) => ({
    id: s.id,
    dealId: s.dealId,
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
    successScore: s.deal?.successScore ?? null,
    successScoreRationale: s.deal?.successScoreRationale ?? null,
    lastActivityDate: s.deal?.lastContactDate?.toISOString().slice(0, 10) ?? null,
    source: s.deal?.source ?? null,
    serviceInterest: s.deal?.serviceInterest ?? null,
    sourceFilename: s.sourceEvent?.filename ?? null,
    sourceSubject: s.sourceEvent?.subject ?? null,
    headline: headlineForSignal(s),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl italic text-ink">Approval Inbox</h1>
        <p className="mt-1 text-sm text-gray-500">
          Nothing is written, sent, or scheduled until someone taps Approve. Most recent items come first.
        </p>
      </div>

      {/* useSearchParams (for the ?signal= deep link from the dashboard's
          "highest priority" card) requires a Suspense boundary in the parent
          server component. */}
      <Suspense fallback={null}>
        <ApprovalInboxClient signals={plainSignals} owners={OWNERS} />
      </Suspense>
    </div>
  );
}
