"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { scoreDealSuccess } from "@/lib/extraction/success-score";

// Generates (or refreshes) a deal's AI success score on demand - not run
// automatically on every page view, since that would mean an API call per
// visit rather than per founder request. The result is persisted so it
// shows up immediately on future visits until someone asks for a refresh.
export async function generateDealScore(dealId: string): Promise<{ ok: boolean; message?: string }> {
  const deal = await prisma.deal.findUniqueOrThrow({
    where: { id: dealId },
    include: {
      sourceEvents: { where: { filename: { not: "(system)" } }, orderBy: { occurredAt: "asc" } },
      auditLogs: { orderBy: { createdAt: "asc" } },
    },
  });

  type TimelineEntry = { at: Date; line: string };
  const timeline: TimelineEntry[] = [
    ...deal.sourceEvents.map((e): TimelineEntry => ({
      at: e.occurredAt ?? e.createdAt,
      line: `${(e.occurredAt ?? e.createdAt).toISOString().slice(0, 10)} - ${e.type.replace(/_/g, " ")}: ${e.subject ?? e.filename ?? "note"}`,
    })),
    ...deal.auditLogs.map((a): TimelineEntry => ({
      at: a.createdAt,
      line: `${a.createdAt.toISOString().slice(0, 10)} - ${a.action.replace(/_/g, " ")} by ${a.actor}: ${a.detail}`,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  try {
    const { score, rationale } = await scoreDealSuccess({
      company: deal.company,
      stage: deal.stage,
      estValueUsd: deal.estValueUsd,
      stale: deal.stale,
      nextFollowupDate: deal.nextFollowupDate?.toISOString().slice(0, 10) ?? null,
      timeline: timeline.map((t) => t.line),
    });

    await prisma.deal.update({
      where: { id: dealId },
      data: { successScore: score, successScoreRationale: rationale, successScoreUpdatedAt: new Date() },
    });
    revalidatePath(`/dashboard/deals/${dealId}`);
    return { ok: true };
  } catch {
    return { ok: false, message: "Couldn't generate a score just now - try again in a moment." };
  }
}
