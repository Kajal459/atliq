import { prisma } from "@/lib/db";
import { STAGE_ORDER } from "@/lib/automation/tiers";
import { OWNERS } from "@/lib/automation/owner";
import { SIGNAL_TYPE_META, SIGNAL_TYPE_PRIORITY } from "@/lib/automation/describe-signal";

// One screen of "all the numbers" for the four people running sales - the
// homepage landing after login, separate from the Weekly Digest (which is
// about what needs attention this week, not the overall state of the book).

export interface StageBreakdown {
  stage: string;
  count: number;
  valueUsd: number;
}

export interface OwnerBreakdown {
  owner: string; // "Unassigned" for null
  count: number;
  valueUsd: number;
}

export interface SignalTypeBreakdown {
  type: string;
  icon: string;
  label: string;
  count: number;
}

export interface DashboardOverview {
  openDealCount: number;
  openPipelineValueUsd: number;
  staleCount: number;
  staleValueUsd: number;
  pendingApprovalCount: number;
  needsReviewCount: number;
  wonCount: number;
  lostCount: number;
  winRatePct: number | null; // null if no closed deals yet
  stageBreakdown: StageBreakdown[];
  ownerBreakdown: OwnerBreakdown[];
  signalTypeBreakdown: SignalTypeBreakdown[];
}

export async function buildDashboardOverview(): Promise<DashboardOverview> {
  const deals = await prisma.deal.findMany({ where: { mergedIntoDealId: null } });
  const activeDeals = deals.filter((d) => d.stage !== "Won" && d.stage !== "Lost");
  const wonDeals = deals.filter((d) => d.stage === "Won");
  const lostDeals = deals.filter((d) => d.stage === "Lost");

  const staleDeals = activeDeals.filter((d) => d.stale);

  const stageOrderFull = [...STAGE_ORDER];
  const stageBreakdown: StageBreakdown[] = stageOrderFull.map((stage) => {
    const inStage = activeDeals.filter((d) => d.stage === stage);
    return {
      stage,
      count: inStage.length,
      valueUsd: inStage.reduce((sum, d) => sum + (d.estValueUsd ?? 0), 0),
    };
  });

  const ownerBreakdown: OwnerBreakdown[] = [...OWNERS, null].map((owner) => {
    const forOwner = activeDeals.filter((d) => d.owner === owner);
    return {
      owner: owner ?? "Unassigned",
      count: forOwner.length,
      valueUsd: forOwner.reduce((sum, d) => sum + (d.estValueUsd ?? 0), 0),
    };
  });

  const [pendingApprovalCount, needsReviewCount, pendingByType] = await Promise.all([
    prisma.signal.count({ where: { status: "pending" } }),
    prisma.signal.count({ where: { status: "needs_review" } }),
    prisma.signal.groupBy({ by: ["type"], where: { status: "pending" }, _count: { _all: true } }),
  ]);

  const signalTypeBreakdown: SignalTypeBreakdown[] = pendingByType
    .map((row) => ({
      type: row.type,
      icon: SIGNAL_TYPE_META[row.type]?.icon ?? "•",
      label: SIGNAL_TYPE_META[row.type]?.label ?? row.type.replace(/_/g, " "),
      count: row._count._all,
    }))
    .sort((a, b) => (SIGNAL_TYPE_PRIORITY[a.type] ?? 9) - (SIGNAL_TYPE_PRIORITY[b.type] ?? 9));

  const closedCount = wonDeals.length + lostDeals.length;

  return {
    openDealCount: activeDeals.length,
    openPipelineValueUsd: activeDeals.reduce((sum, d) => sum + (d.estValueUsd ?? 0), 0),
    staleCount: staleDeals.length,
    staleValueUsd: staleDeals.reduce((sum, d) => sum + (d.estValueUsd ?? 0), 0),
    pendingApprovalCount,
    needsReviewCount,
    wonCount: wonDeals.length,
    lostCount: lostDeals.length,
    winRatePct: closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : null,
    stageBreakdown,
    ownerBreakdown,
    signalTypeBreakdown,
  };
}
