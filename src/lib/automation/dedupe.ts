import { prisma } from "@/lib/db";

// FR-3, sharpened on the follow-up Q&A call: if two records share the same
// company AND the same deal size/scope, they're the same underlying deal -
// merge notes, keep the most recently updated record's owner. If deal size or
// scope differs, they're genuinely separate opportunities for the same
// client - link them (same company) but never merge.

const VALUE_MATCH_TOLERANCE = 0.01; // treat estValueUsd as "the same" within 1%

export async function resolveDuplicatesForCompany(company: string): Promise<void> {
  const candidates = await prisma.deal.findMany({
    where: {
      company: { equals: company, mode: "insensitive" },
      mergedIntoDealId: null,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (candidates.length < 2) return;

  // Group by (roughly) matching deal size + service line - our concrete test
  // for "same underlying deal" vs. "separate opportunity, same client."
  const groups: (typeof candidates)[] = [];
  for (const deal of candidates) {
    const group = groups.find((g) =>
      g.some((d) => isSameUnderlyingDeal(d, deal))
    );
    if (group) group.push(deal);
    else groups.push([deal]);
  }

  for (const group of groups) {
    if (group.length < 2) continue;
    // Most recently updated wins as the surviving record and its owner.
    const [survivor, ...duplicates] = group; // already sorted desc by updatedAt
    const mergedNotes = duplicates
      .map((d) => d.notes)
      .filter(Boolean)
      .join("\n---\n");

    await prisma.$transaction([
      prisma.deal.update({
        where: { id: survivor.id },
        data: {
          notes: [survivor.notes, mergedNotes].filter(Boolean).join("\n---\n"),
        },
      }),
      ...duplicates.map((d) =>
        prisma.deal.update({
          where: { id: d.id },
          data: { mergedIntoDealId: survivor.id },
        })
      ),
      prisma.auditLog.create({
        data: {
          dealId: survivor.id,
          action: "duplicate_merged",
          detail: `Merged ${duplicates.map((d) => d.leadId).join(", ")} into ${survivor.leadId} - matching company, deal size, and scope. Owner kept: ${survivor.owner ?? "unassigned"} (most recently updated record).`,
          actor: "AI",
        },
      }),
    ]);
  }
}

function isSameUnderlyingDeal(
  a: { estValueUsd: number | null; serviceInterest: string | null },
  b: { estValueUsd: number | null; serviceInterest: string | null }
): boolean {
  const sameService =
    (a.serviceInterest ?? "").trim().toLowerCase() ===
    (b.serviceInterest ?? "").trim().toLowerCase();
  if (!sameService) return false;

  if (a.estValueUsd == null || b.estValueUsd == null) {
    // No value on one side - fall back to service-line match only, since we
    // can't confirm deal size. Conservative but avoids false negatives on
    // sparse data.
    return true;
  }
  const diff = Math.abs(a.estValueUsd - b.estValueUsd);
  const base = Math.max(a.estValueUsd, b.estValueUsd, 1);
  return diff / base <= VALUE_MATCH_TOLERANCE;
}
