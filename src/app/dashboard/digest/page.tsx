import Link from "next/link";
import { buildWeeklyDigest, type DigestBucket, type DigestItem } from "@/lib/digest/buckets";
import { HandoffBriefButton } from "../_components/HandoffBriefButton";
import { SIGNAL_TYPE_META, SIGNAL_TYPE_PRIORITY, headlineForSignal } from "@/lib/automation/describe-signal";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const BUCKET_LABELS: Record<DigestBucket, string> = {
  today: "Due today (or overdue)",
  next2weeks: "Due within 2 weeks",
  later: "Further out",
  stale: "Stale (30+ days no activity)",
  needsReview: "Needs Review (backward stage movement)",
};

const BUCKET_ORDER: DigestBucket[] = ["today", "next2weeks", "needsReview", "stale", "later"];

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default async function WeeklyDigestPage() {
  const digest = await buildWeeklyDigest();
  const totalItems = Object.values(digest.buckets).reduce((sum, items) => sum + items.length, 0);

  // The single most urgent item waiting in the Approval Inbox - highest
  // signal-type priority first, most recent as the tie-break - surfaced
  // here so it doesn't require a trip to the inbox to spot it.
  const pendingSignals = await prisma.signal.findMany({
    where: { status: "pending" },
    include: { deal: { select: { company: true } } },
    orderBy: { createdAt: "desc" },
  });
  let topSignal: (typeof pendingSignals)[number] | null = null;
  for (const s of pendingSignals) {
    if (!topSignal) {
      topSignal = s;
      continue;
    }
    const bestPriority = SIGNAL_TYPE_PRIORITY[topSignal.type] ?? 9;
    const priority = SIGNAL_TYPE_PRIORITY[s.type] ?? 9;
    if (priority < bestPriority || (priority === bestPriority && s.createdAt > topSignal.createdAt)) {
      topSignal = s;
    }
  }
  const topSignalMeta = topSignal ? SIGNAL_TYPE_META[topSignal.type] : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl italic text-ink">Weekly Digest</h1>
        <p className="mt-1 text-sm text-gray-500">
          What needs attention, grouped by time horizon instead of one flat list - the view that replaces ~2
          hours/month of manually reconciling the CRM against everyone&apos;s inboxes.
        </p>
        <div className="mt-3">
          <HandoffBriefButton scope="pipeline" label="Generate pipeline handoff brief" />
        </div>
      </div>

      {/* Highest priority - the one item most worth looking at right now.
          Clicking takes you straight to it in the Approval Inbox, already
          expanded, instead of leaving you to hunt for it in the list. */}
      {topSignal && (
        <Link
          href={`/dashboard/approvals?signal=${topSignal.id}`}
          className="block rounded-xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:bg-amber-100/60"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            {topSignalMeta?.icon ?? "•"} Highest priority
          </p>
          <p className="mt-1 font-medium text-ink">
            {headlineForSignal({
              type: topSignal.type,
              field: topSignal.field,
              proposedValue: topSignal.proposedValue,
              previousValue: topSignal.previousValue,
              leadSource: topSignal.leadSource,
              suggestedServiceLine: topSignal.suggestedServiceLine,
              deal: topSignal.deal,
            })}
          </p>
          <p className="mt-1 text-xs text-amber-700">Click to review and approve →</p>
        </Link>
      )}

      {digest.atRiskDealCount > 0 && (
        <div className="rounded-2xl bg-forest-700 p-5 text-white">
          <p className="text-xs font-medium uppercase tracking-wide text-forest-100">
            Pipeline value at risk this week
          </p>
          <p className="mt-1 font-serif text-3xl">
            {formatUsd(digest.atRiskValueUsd)}{" "}
            <span className="text-lg text-forest-100">
              across {digest.atRiskDealCount} deal{digest.atRiskDealCount === 1 ? "" : "s"}
            </span>
          </p>
          <p className="mt-1 text-sm text-forest-50">
            Overdue, stale, or flagged for review right now - not a fit or budget problem, a process one.{" "}
            {digest.totalOpenPipelineValueUsd > 0 && (
              <>That&apos;s {Math.round((digest.atRiskValueUsd / digest.totalOpenPipelineValueUsd) * 100)}% of the {formatUsd(digest.totalOpenPipelineValueUsd)} open pipeline.</>
            )}
          </p>
        </div>
      )}

      {totalItems === 0 && (
        <p className="border-l-2 border-forest-600 py-1 pl-4 text-sm text-gray-500">
          Nothing needs attention right now - or the backfill hasn&apos;t been run yet. See the README for{" "}
          <code className="text-forest-700">npm run backfill</code>.
        </p>
      )}

      {BUCKET_ORDER.map((bucket) =>
        digest.buckets[bucket].length > 0 ? (
          <section key={bucket}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              {BUCKET_LABELS[bucket]} ({digest.buckets[bucket].length})
            </h2>
            <div className="divide-y divide-cream-100 border-y border-cream-100">
              {digest.buckets[bucket].map((item, i) => (
                <DigestRow key={`${item.dealId}-${i}`} item={item} />
              ))}
            </div>
          </section>
        ) : null
      )}
    </div>
  );
}

function DigestRow({ item }: { item: DigestItem }) {
  return (
    <Link
      href={`/dashboard/deals/${item.dealId}`}
      className="flex items-center justify-between px-1 py-3 text-sm hover:bg-cream-50/60"
    >
      <div>
        <p className="font-medium text-ink">{item.company}</p>
        <p className="text-gray-500">{item.reason}</p>
      </div>
      <div className="flex items-center gap-3">
        {item.estValueUsd != null && <span className="text-sm text-forest-600">{formatUsd(item.estValueUsd)}</span>}
        <span className="text-xs text-gray-400">{item.owner ?? "unassigned"}</span>
      </div>
    </Link>
  );
}
