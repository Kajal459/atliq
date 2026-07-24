import { prisma } from "@/lib/db";

// FR-2: auto-assign a blank owner field based on current workload, without
// waiting for approval. "Current workload" = number of that person's deals
// that aren't Won or Lost yet (an open pipeline count).

// Matches the exact owner values used in crm_export.csv (the CEO's CRM owner
// value is the full "Karandeep", not the short "Karan" used in conversation).
export const OWNERS = ["Dhaval", "Bhavin", "Karandeep", "Jay"] as const;

export async function assignOwnerIfBlank(dealId: string): Promise<string | null> {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal || deal.owner) return null;

  const openCounts = await Promise.all(
    OWNERS.map(async (owner) => {
      const count = await prisma.deal.count({
        where: { owner, stage: { notIn: ["Won", "Lost"] } },
      });
      return { owner, count };
    })
  );

  openCounts.sort((a, b) => a.count - b.count);
  const chosen = openCounts[0].owner;

  await prisma.$transaction([
    prisma.deal.update({ where: { id: dealId }, data: { owner: chosen } }),
    prisma.auditLog.create({
      data: {
        dealId,
        action: "owner_assigned",
        detail: `Auto-assigned to ${chosen} (lightest open pipeline: ${openCounts[0].count} open deals at assignment time).`,
        actor: "AI",
      },
    }),
    prisma.signal.create({
      data: {
        sourceEventId: (await ensurePlaceholderSourceEvent(dealId)).id,
        dealId,
        type: "owner_assignment",
        field: "owner",
        proposedValue: chosen,
        previousValue: null,
        citationQuote: "(deterministic rule - new record created with a blank owner field)",
        confidence: "high",
        tier: "auto_apply",
        status: "auto_applied",
        reasoning: `Workload-based auto-assignment: ${chosen} had the fewest open deals.`,
        resolvedAt: new Date(),
        resolvedBy: "AI",
      },
    }),
  ]);

  return chosen;
}

/** Owner assignment and merges are deterministic actions, not tied to a
 * specific inbound email/note, but the Signal model requires a sourceEventId
 * for citation purposes. We create one lightweight synthetic SourceEvent per
 * deal on first use rather than making the field optional everywhere. */
async function ensurePlaceholderSourceEvent(dealId: string) {
  const existing = await prisma.sourceEvent.findFirst({
    where: { dealId, filename: "(system)" },
  });
  if (existing) return existing;
  return prisma.sourceEvent.create({
    data: {
      dealId,
      type: "email",
      filename: "(system)",
      body: "System-generated placeholder source event for deterministic automation actions (owner assignment, duplicate merge).",
      processedAt: new Date(),
    },
  });
}
