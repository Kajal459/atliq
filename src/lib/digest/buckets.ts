import { prisma } from "@/lib/db";

// FR-7, refined on the follow-up Q&A call: the weekly digest is grouped by
// time horizon rather than shown as one flat list - due today, due within
// two weeks, further out. Plus stale deals and needs-review items, which
// don't have a "due date" but still belong on the digest.

export type DigestBucket = "today" | "next2weeks" | "later" | "stale" | "needsReview";

export interface DigestItem {
  dealId: string;
  company: string;
  owner: string | null;
  reason: string;
  dueDate: Date | null;
  bucket: DigestBucket;
  estValueUsd: number | null;
}

export interface DigestSummary {
  buckets: Record<DigestBucket, DigestItem[]>;
  // "At risk" = today/overdue + stale + needs-review - the deals where
  // process failure (not fit or budget) is actively threatening the deal
  // right now, which is exactly what the North Star metric tracks.
  atRiskValueUsd: number;
  atRiskDealCount: number;
  totalOpenPipelineValueUsd: number;
}

export async function buildWeeklyDigest(now: Date = new Date()): Promise<DigestSummary> {
  const in2Weeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const deals = await prisma.deal.findMany({
    where: { mergedIntoDealId: null, stage: { notIn: ["Won", "Lost"] } },
  });

  const result: Record<DigestBucket, DigestItem[]> = {
    today: [],
    next2weeks: [],
    later: [],
    stale: [],
    needsReview: [],
  };

  const totalOpenPipelineValueUsd = deals.reduce((sum, d) => sum + (d.estValueUsd ?? 0), 0);

  for (const deal of deals) {
    if (deal.stale) {
      result.stale.push({
        dealId: deal.id,
        company: deal.company,
        owner: deal.owner,
        reason: `No activity since ${deal.staleSince?.toISOString().slice(0, 10) ?? "unknown"} (30+ days)`,
        dueDate: deal.staleSince,
        bucket: "stale",
        estValueUsd: deal.estValueUsd,
      });
      continue;
    }

    if (deal.nextFollowupDate) {
      const due = deal.nextFollowupDate;
      const bucket: DigestBucket = due < endOfToday && due >= startOfToday
        ? "today"
        : due < startOfToday
          ? "today" // overdue items surface with today's, not buried in "later"
          : due <= in2Weeks
            ? "next2weeks"
            : "later";
      result[bucket].push({
        dealId: deal.id,
        company: deal.company,
        owner: deal.owner,
        reason: `Follow-up due ${due.toISOString().slice(0, 10)}`,
        dueDate: due,
        bucket,
        estValueUsd: deal.estValueUsd,
      });
    }
  }

  const needsReviewSignals = await prisma.signal.findMany({
    where: { status: "needs_review" },
    include: { deal: true },
    orderBy: { createdAt: "desc" },
  });
  for (const s of needsReviewSignals) {
    if (!s.deal || s.deal.mergedIntoDealId) continue;
    result.needsReview.push({
      dealId: s.deal.id,
      company: s.deal.company,
      owner: s.deal.owner,
      reason: `${s.type.replace("_", " ")}: "${s.citationQuote}"`,
      dueDate: null,
      bucket: "needsReview",
      estValueUsd: s.deal.estValueUsd,
    });
  }

  // "At risk" = deals showing up in today/overdue, stale, or needs-review -
  // deduplicated, since a deal could theoretically land in more than one.
  const atRiskDealIds = new Set([
    ...result.today.map((i) => i.dealId),
    ...result.stale.map((i) => i.dealId),
    ...result.needsReview.map((i) => i.dealId),
  ]);
  const atRiskValueUsd = deals
    .filter((d) => atRiskDealIds.has(d.id))
    .reduce((sum, d) => sum + (d.estValueUsd ?? 0), 0);

  return {
    buckets: result,
    atRiskValueUsd,
    atRiskDealCount: atRiskDealIds.size,
    totalOpenPipelineValueUsd,
  };
}
