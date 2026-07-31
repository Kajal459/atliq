import { prisma } from "@/lib/db";
import { getValidAccessToken, listMessageIdsSince, getMessage } from "./client";
import { extractSignals } from "@/lib/extraction/extract";
import { applyExtractionResult } from "@/lib/automation/apply";
import { assignOwnerIfBlank } from "@/lib/automation/owner";

/** The live counterpart to the backfill script - same extraction pipeline,
 * same matching logic, just fed from a real inbox instead of the static
 * dataset. Called both by the daily cron and by the "Check inbox now"
 * button in Settings for the live demo. */
export async function syncGmailInbox(): Promise<{ found: number; processed: number; skipped: number }> {
  const auth = await getValidAccessToken();
  if (!auth) return { found: 0, processed: 0, skipped: 0 };

  const connection = await prisma.gmailConnection.findUniqueOrThrow({ where: { id: auth.connectionId } });
  const since = connection.lastSyncedInternalDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sinceEpoch = Math.floor(since.getTime() / 1000);

  const ids = await listMessageIdsSince(auth.token, sinceEpoch);

  const deals = await prisma.deal.findMany({ where: { mergedIntoDealId: null }, select: { id: true, company: true, stage: true, estValueUsd: true, owner: true, serviceInterest: true, notes: true } });

  let processed = 0;
  let skipped = 0;
  let newestSeen = connection.lastSyncedInternalDate ?? new Date(0);

  for (const id of ids) {
    const existing = await prisma.sourceEvent.findFirst({ where: { filename: `gmail:${id}` } });
    if (existing) {
      skipped++;
      continue;
    }

    const email = await getMessage(auth.token, id);
    if (email.date && email.date > newestSeen) newestSeen = email.date;

    const matchedDeal = matchDealByText(`${email.subject ?? ""}\n${email.body}`, deals);

    const sourceEvent = await prisma.sourceEvent.create({
      data: {
        type: "live_email",
        filename: `gmail:${id}`,
        occurredAt: email.date,
        fromWhom: email.from,
        subject: email.subject,
        body: email.body,
        dealId: matchedDeal?.id ?? null,
      },
    });

    try {
      const result = await extractSignals({
        sourceType: "live_email",
        filename: `gmail:${id}`,
        occurredAt: email.date?.toISOString() ?? null,
        fromWhom: email.from,
        subject: email.subject,
        body: email.body,
        dealContext: matchedDeal
          ? `lead_id: ${matchedDeal.id}\ncompany: ${matchedDeal.company}\ncurrent_stage: ${matchedDeal.stage}\nest_value_usd: ${matchedDeal.estValueUsd ?? "unknown"}\nowner: ${matchedDeal.owner ?? "unassigned"}\nservice_interest: ${matchedDeal.serviceInterest ?? "unknown"}\nexisting_notes: ${matchedDeal.notes ?? "(none)"}`
          : null,
      });
      const outcome = await applyExtractionResult(sourceEvent.id, result);
      if (outcome.dealId) await assignOwnerIfBlank(outcome.dealId);
      processed++;
    } catch (err) {
      console.error(`Live Gmail sync failed on message ${id}:`, err instanceof Error ? err.message : err);
    }
  }

  await prisma.gmailConnection.update({
    where: { id: connection.id },
    data: { lastSyncedAt: new Date(), lastSyncedInternalDate: newestSeen },
  });

  return { found: ids.length, processed, skipped };
}

function matchDealByText<T extends { company: string }>(text: string, deals: T[]): T | null {
  const lower = text.toLowerCase();
  const sorted = [...deals].sort((a, b) => b.company.length - a.company.length);
  return sorted.find((d) => lower.includes(d.company.toLowerCase())) ?? null;
}
