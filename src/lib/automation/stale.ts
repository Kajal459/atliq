import { prisma } from "@/lib/db";

// Decided: no activity (no email, note, or CRM touch) for 30 days
// auto-triggers a "Stale" state, separate from the normal stage taxonomy and
// separate from Lost - Stale just means nobody has acted, not that the deal
// is dead.

const STALE_DAYS = 30;

export async function refreshStaleFlags(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const deals = await prisma.deal.findMany({
    where: { mergedIntoDealId: null, stage: { notIn: ["Won", "Lost"] } },
    include: { sourceEvents: { orderBy: { occurredAt: "desc" }, take: 1 } },
  });

  let flagged = 0;
  for (const deal of deals) {
    const lastTouch = mostRecentDate([
      deal.lastContactDate,
      deal.sourceEvents[0]?.occurredAt ?? null,
      deal.updatedAt,
    ]);
    const isStale = !!lastTouch && lastTouch < cutoff;

    if (isStale !== deal.stale) {
      await prisma.$transaction([
        prisma.deal.update({
          where: { id: deal.id },
          data: { stale: isStale, staleSince: isStale ? lastTouch : null },
        }),
        prisma.auditLog.create({
          data: {
            dealId: deal.id,
            action: isStale ? "marked_stale" : "unmarked_stale",
            detail: isStale
              ? `No activity since ${lastTouch?.toISOString().slice(0, 10)} (${STALE_DAYS}+ days).`
              : "New activity detected - stale flag cleared.",
            actor: "AI",
          },
        }),
      ]);
      if (isStale) flagged++;
    }
  }
  return flagged;
}

function mostRecentDate(dates: (Date | null)[]): Date | null {
  const valid = dates.filter((d): d is Date => !!d);
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid.map((d) => d.getTime())));
}
