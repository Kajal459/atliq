"use server";

import { prisma } from "@/lib/db";
import { matchAllDealsByText } from "@/lib/deals/match-by-text";
import { answerDealQuestion } from "@/lib/extraction/assistant";

// Backs the "Ask AtliQ" chat launcher. Deliberately deterministic about
// which deal it's answering for - the company name has to actually appear
// in the question, same matching rule Quick Capture uses - so the AI call
// itself only ever sees one grounded deal's data, never a guess across the
// whole pipeline.
export async function askAboutDeal(question: string): Promise<{ ok: boolean; message: string }> {
  const trimmed = question.trim();
  if (!trimmed) {
    return { ok: false, message: 'Ask something first - e.g. "what\'s the status of Meridian?"' };
  }

  const deals = await prisma.deal.findMany({
    where: { mergedIntoDealId: null },
    select: { id: true, company: true },
  });
  const candidates = matchAllDealsByText(trimmed, deals);

  if (candidates.length === 0) {
    return {
      ok: false,
      message:
        "I couldn't find a deal matching a company name in that question - try including the company's name, e.g. \"what's the status of Meridian Healthcare?\"",
    };
  }
  if (candidates.length > 1) {
    return {
      ok: false,
      message: `That could mean more than one deal: ${candidates.map((d) => d.company).join(", ")}. Try being more specific.`,
    };
  }

  const deal = await prisma.deal.findUniqueOrThrow({
    where: { id: candidates[0].id },
    include: {
      sourceEvents: { where: { filename: { not: "(system)" } }, orderBy: { occurredAt: "desc" }, take: 6 },
      signals: { orderBy: { createdAt: "desc" }, take: 15 },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });

  try {
    const answer = await answerDealQuestion({
      question: trimmed,
      company: deal.company,
      stage: deal.stage,
      owner: deal.owner,
      estValueUsd: deal.estValueUsd,
      nextFollowupDate: deal.nextFollowupDate?.toISOString().slice(0, 10) ?? null,
      stale: deal.stale,
      recentActivity: [
        ...deal.sourceEvents.map(
          (e) => `${e.type} (${e.occurredAt?.toISOString().slice(0, 10) ?? "undated"}): ${e.subject ?? e.filename}`
        ),
        ...deal.auditLogs.map((a) => `${a.action.replace(/_/g, " ")} by ${a.actor}: ${a.detail}`),
      ],
      pendingApprovals: deal.signals
        .filter((s) => s.status === "pending")
        .map((s) => `${s.type.replace(/_/g, " ")}: "${s.citationQuote}"`),
      needsReviewItems: deal.signals
        .filter((s) => s.status === "needs_review")
        .map((s) => `${s.type.replace(/_/g, " ")}: "${s.citationQuote}"`),
    });
    return { ok: true, message: answer };
  } catch {
    return { ok: false, message: "Couldn't get an answer just now - try again in a moment." };
  }
}
