import { prisma } from "@/lib/db";
import { generateDeferralTrigger } from "@/lib/extraction/deferral-trigger";

// FR-8, the part that actually fires on a date rather than at extraction
// time: for every deal whose next_followup_date has arrived (set earlier
// from an approved deferral signal), generate the reminder + drafted email +
// recommended action and drop it in the Approval Inbox. Meant to run daily
// via the Vercel Cron job (see src/app/api/cron/route.ts).

export async function checkDueDeferrals(now: Date = new Date()): Promise<number> {
  const dueDeals = await prisma.deal.findMany({
    where: {
      mergedIntoDealId: null,
      stage: { notIn: ["Won", "Lost"] },
      nextFollowupDate: { lte: now },
    },
  });

  let created = 0;

  for (const deal of dueDeals) {
    // Don't re-fire if there's already an unresolved reminder for this deal -
    // avoids spamming the Approval Inbox with a fresh one every day the
    // founder hasn't gotten to the last one yet.
    const alreadyPending = await prisma.signal.findFirst({
      where: { dealId: deal.id, type: "deferral_reminder", status: { in: ["pending", "needs_review"] } },
    });
    if (alreadyPending) continue;

    // Find the approved deferral signal that set this date, for context and
    // citation - falls back to a generic note if we can't find one (e.g. the
    // date was set manually rather than via an approved signal).
    const originatingSignal = await prisma.signal.findFirst({
      where: { dealId: deal.id, type: "deferral", field: "next_followup_date", status: { in: ["approved", "edited"] } },
      orderBy: { resolvedAt: "desc" },
    });

    const originalQuote = originatingSignal?.citationQuote ?? `${deal.company} was due for a follow-up on ${deal.nextFollowupDate?.toISOString().slice(0, 10)}.`;

    try {
      const trigger = await generateDeferralTrigger({
        company: deal.company,
        contactName: deal.contactName,
        serviceInterest: deal.serviceInterest,
        owner: deal.owner,
        originalQuote,
      });

      await prisma.$transaction([
        prisma.signal.create({
          data: {
            sourceEventId: originatingSignal?.sourceEventId ?? (await placeholderSourceEvent(deal.id)).id,
            dealId: deal.id,
            type: "deferral_reminder",
            field: null,
            proposedValue: trigger.draft_email,
            citationQuote: originalQuote,
            confidence: "high",
            tier: "approval_required",
            status: "pending",
            reasoning: trigger.recommended_action,
          },
        }),
        prisma.auditLog.create({
          data: {
            dealId: deal.id,
            action: "deferral_reminder_generated",
            detail: `Reach-back date arrived (${deal.nextFollowupDate?.toISOString().slice(0, 10)}) - drafted reminder for ${deal.owner ?? "unassigned"}.`,
            actor: "AI",
          },
        }),
      ]);
      created++;
    } catch (err) {
      console.error(`Deferral trigger failed for ${deal.company}:`, err instanceof Error ? err.message : err);
    }
  }

  return created;
}

async function placeholderSourceEvent(dealId: string) {
  const existing = await prisma.sourceEvent.findFirst({ where: { dealId, filename: "(system)" } });
  if (existing) return existing;
  return prisma.sourceEvent.create({
    data: {
      dealId,
      type: "email",
      filename: "(system)",
      body: "System-generated placeholder source event for deterministic automation actions.",
      processedAt: new Date(),
    },
  });
}
