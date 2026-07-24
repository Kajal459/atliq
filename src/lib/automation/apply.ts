import { prisma } from "@/lib/db";
import type { ExtractionResult } from "@/lib/extraction/types";
import { decideTier } from "./tiers";
import { assignOwnerIfBlank } from "./owner";

/**
 * Takes one source event's extraction result, finds/creates the matching
 * Deal, writes a Signal row per extracted item, and immediately applies the
 * auto_apply-tier ones (currently: forward stage progression only - owner
 * assignment and duplicate merge are handled separately as deterministic
 * post-processing, see owner.ts / dedupe.ts).
 */
export async function applyExtractionResult(
  sourceEventId: string,
  result: ExtractionResult
): Promise<{ dealId: string | null; created: number; autoApplied: number }> {
  const sourceEvent = await prisma.sourceEvent.findUniqueOrThrow({
    where: { id: sourceEventId },
  });

  const deal = await matchOrCreateDeal(sourceEvent.dealId, result.matched_deal_hint);

  if (deal && !sourceEvent.dealId) {
    await prisma.sourceEvent.update({ where: { id: sourceEventId }, data: { dealId: deal.id } });
  }

  let autoApplied = 0;

  for (const signal of result.signals) {
    const tier = decideTier(signal, deal?.stage);

    const created = await prisma.signal.create({
      data: {
        sourceEventId,
        dealId: deal?.id ?? null,
        type: signal.type,
        field: signal.field,
        proposedValue: signal.proposed_value,
        previousValue: signal.field && deal ? String((deal as Record<string, unknown>)[toDealField(signal.field)] ?? "") : null,
        citationQuote: signal.citation_quote,
        confidence: signal.confidence,
        tier,
        status: tier === "auto_apply" ? "auto_applied" : tier === "needs_review" ? "needs_review" : "pending",
        reasoning: signal.reasoning,
        suggestedServiceLine: signal.suggested_service_line,
        leadSource: signal.lead_source,
        resolvedAt: tier === "auto_apply" ? new Date() : null,
        resolvedBy: tier === "auto_apply" ? "AI" : null,
      },
    });

    if (tier === "auto_apply" && signal.type === "stage_change" && deal && signal.proposed_value) {
      await prisma.$transaction([
        prisma.deal.update({ where: { id: deal.id }, data: { stage: signal.proposed_value as never } }),
        prisma.auditLog.create({
          data: {
            dealId: deal.id,
            action: "stage_auto_applied",
            detail: `Stage moved to ${signal.proposed_value} - "${signal.citation_quote}"`,
            actor: "AI",
          },
        }),
      ]);
      autoApplied++;
    }
    void created; // row is persisted for the audit trail even though we only branch on tier/type above
  }

  await prisma.sourceEvent.update({ where: { id: sourceEventId }, data: { processedAt: new Date() } });

  if (deal) {
    await assignOwnerIfBlank(deal.id);
  }

  return { dealId: deal?.id ?? null, created: result.signals.length, autoApplied };
}

function toDealField(field: string): string {
  // Maps a few common human-readable field names to the Prisma Deal field name.
  const map: Record<string, string> = {
    stage: "stage",
    status: "stage",
    next_followup_date: "nextFollowupDate",
    owner: "owner",
  };
  return map[field] ?? field;
}

async function matchOrCreateDeal(existingDealId: string | null, hint: string | null) {
  if (existingDealId) {
    return prisma.deal.findUnique({ where: { id: existingDealId } });
  }
  if (!hint) return null;

  const existing = await prisma.deal.findFirst({
    where: {
      OR: [
        { company: { contains: hint, mode: "insensitive" } },
        { leadId: { equals: hint } },
      ],
      mergedIntoDealId: null,
    },
  });
  if (existing) return existing;

  // No matching deal - this looks like a genuinely new lead. We do NOT
  // create a live CRM record here; new_lead is approval_required (FR-1),
  // so record creation itself waits in the Signal row until a founder
  // approves it via the Approval Inbox action handler (see approvals.ts).
  return null;
}
