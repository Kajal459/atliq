import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE_NAME, expectedSessionValue } from "@/lib/auth/session";
import { generateDealHandoffBrief, generatePipelineHandoffBrief } from "@/lib/extraction/handoff-brief";

// Not covered by middleware's matcher (that only guards /dashboard/*), so
// this route checks the same session cookie itself - only a signed-in
// founder should be able to trigger a real Claude call from this app.
function isAuthenticated(): boolean {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  try {
    return cookie === expectedSessionValue();
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const scope = body.scope as "deal" | "pipeline";

  try {
    if (scope === "deal") {
      const brief = await buildDealBrief(body.dealId as string);
      return NextResponse.json({ brief });
    }
    if (scope === "pipeline") {
      const brief = await buildPipelineBrief();
      return NextResponse.json({ brief });
    }
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  } catch (err) {
    console.error("Handoff brief generation failed:", err);
    return NextResponse.json({ error: "Failed to generate brief" }, { status: 500 });
  }
}

async function buildDealBrief(dealId: string): Promise<string> {
  const deal = await prisma.deal.findUniqueOrThrow({
    where: { id: dealId },
    include: {
      sourceEvents: { where: { filename: { not: "(system)" } }, orderBy: { occurredAt: "desc" }, take: 6 },
      signals: { orderBy: { createdAt: "desc" }, take: 15 },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });

  return generateDealHandoffBrief({
    company: deal.company,
    stage: deal.stage,
    owner: deal.owner,
    estValueUsd: deal.estValueUsd,
    nextFollowupDate: deal.nextFollowupDate?.toISOString().slice(0, 10) ?? null,
    stale: deal.stale,
    recentActivity: [
      ...deal.sourceEvents.map((e) => `${e.type} (${e.occurredAt?.toISOString().slice(0, 10) ?? "undated"}): ${e.subject ?? e.filename}`),
      ...deal.auditLogs.map((a) => `${a.action.replace(/_/g, " ")} by ${a.actor}: ${a.detail}`),
    ],
    pendingApprovals: deal.signals
      .filter((s) => s.status === "pending")
      .map((s) => `${s.type.replace(/_/g, " ")}: "${s.citationQuote}"`),
    needsReviewItems: deal.signals
      .filter((s) => s.status === "needs_review")
      .map((s) => `${s.type.replace(/_/g, " ")}: "${s.citationQuote}"`),
  });
}

async function buildPipelineBrief(): Promise<string> {
  const [openDeals, pendingApprovals] = await Promise.all([
    prisma.deal.findMany({ where: { mergedIntoDealId: null, stage: { notIn: ["Won", "Lost"] } } }),
    prisma.signal.findMany({
      where: { status: "pending" },
      include: { deal: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const atRisk = openDeals.filter(
    (d) => d.stale || (d.nextFollowupDate && d.nextFollowupDate <= new Date())
  );
  const atRiskValueUsd = atRisk.reduce((sum, d) => sum + (d.estValueUsd ?? 0), 0);

  const topPriorityDeals = atRisk
    .sort((a, b) => (b.estValueUsd ?? 0) - (a.estValueUsd ?? 0))
    .slice(0, 5)
    .map((d) => `${d.company} ($${(d.estValueUsd ?? 0).toLocaleString()}, ${d.owner ?? "unassigned"}) - ${d.stale ? "stale" : "overdue follow-up"}`);

  return generatePipelineHandoffBrief({
    openDealCount: openDeals.length,
    atRiskValueUsd,
    atRiskDealCount: atRisk.length,
    topPriorityDeals,
    pendingApprovalCount: pendingApprovals.length,
    pendingApprovalHighlights: pendingApprovals
      .slice(0, 6)
      .map((s) => `${s.deal?.company ?? "unmatched"}: ${s.type.replace(/_/g, " ")}`),
  });
}
