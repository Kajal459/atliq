"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { extractSignals } from "@/lib/extraction/extract";
import { applyExtractionResult } from "@/lib/automation/apply";

// The paste-in intake path (FR-13): a WhatsApp export, a written summary of a
// phone call, or any other note that never touched Gmail. Runs through the
// same single-pass extraction + tiering pipeline as the email backfill, just
// triggered from a one-line box on the Home dashboard instead of a nightly
// sync - so the founders can log a channel that isn't wired to a connector
// without waiting on one to exist.
//
// Deal linking has three modes, chosen via the "dealChoice" field from the
// form: "auto" (default - scan the text for a known company name, same as
// the backfill script), "new" (skip matching entirely - this is a lead that
// isn't in the CRM yet), or a specific deal id (the person picked the deal
// by hand, which wins over anything the text or the model would have
// guessed).

type MatchedDeal = {
  id: string;
  leadId: string;
  company: string;
  stage: string;
  estValueUsd: number | null;
  owner: string | null;
  serviceInterest: string | null;
  notes: string | null;
};

export async function submitQuickCapture(
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const text = String(formData.get("text") ?? "").trim();
  const actor = String(formData.get("actor") ?? "").trim();
  const dealChoice = String(formData.get("dealChoice") ?? "auto").trim();

  if (!text) {
    return { ok: false, message: "Nothing to capture - paste or type a note first." };
  }

  let matched: MatchedDeal | null = null;
  const forceUnmatched = dealChoice === "new";

  if (dealChoice === "new") {
    matched = null;
  } else if (dealChoice !== "auto") {
    // Picked a specific deal from the dropdown - that choice is authoritative,
    // no text scanning or model hint gets a vote.
    matched = await prisma.deal.findUnique({ where: { id: dealChoice } });
    if (!matched) {
      return { ok: false, message: "That deal couldn't be found - it may have been merged or removed. Try again." };
    }
  } else {
    // Best-effort deal match by scanning for an existing company name in the
    // text (same approach the backfill script uses) - gives the extraction
    // model grounded context instead of guessing cold, and links the
    // SourceEvent to a deal immediately when it's obvious.
    const deals = await prisma.deal.findMany({ where: { mergedIntoDealId: null } });
    matched = matchDealByText(text, deals);
  }

  const sourceEvent = await prisma.sourceEvent.create({
    data: {
      type: "quick_capture",
      filename: "(quick capture)",
      occurredAt: new Date(),
      fromWhom: actor || null,
      subject: null,
      body: text,
      dealId: matched?.id ?? null,
    },
  });

  try {
    const result = await extractSignals({
      sourceType: "quick_capture",
      filename: "(quick capture)",
      occurredAt: sourceEvent.occurredAt?.toISOString() ?? null,
      fromWhom: actor || null,
      subject: null,
      body: text,
      dealContext: matched ? dealContextString(matched) : null,
    });
    const outcome = await applyExtractionResult(sourceEvent.id, result, { forceUnmatched });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/approvals");
    revalidatePath("/dashboard/digest");
    revalidatePath("/dashboard/deals");
    if (outcome.dealId) revalidatePath(`/dashboard/deals/${outcome.dealId}`);

    const dealNote = matched
      ? matched.company
      : forceUnmatched
        ? "flagged as a new lead - review in the Approval Inbox"
        : "no matching deal found - logged for review in the Approval Inbox";
    if (result.signals.length === 0) {
      return { ok: true, message: `Captured. No actionable signals found (${dealNote}).` };
    }
    return {
      ok: true,
      message: `Captured. ${result.signals.length} signal${result.signals.length === 1 ? "" : "s"} found for ${dealNote} - ${outcome.autoApplied} auto-applied, the rest are waiting in the Approval Inbox.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Saved, but extraction failed: ${err instanceof Error ? err.message : "unknown error"}. The note is stored and can be reprocessed later.`,
    };
  }
}

function matchDealByText<T extends { company: string }>(text: string, deals: T[]): T | null {
  const lower = text.toLowerCase();
  const sorted = [...deals].sort((a, b) => b.company.length - a.company.length);
  return sorted.find((d) => lower.includes(d.company.toLowerCase())) ?? null;
}

function dealContextString(deal: {
  leadId: string;
  company: string;
  stage: string;
  estValueUsd: number | null;
  owner: string | null;
  serviceInterest: string | null;
  notes: string | null;
}) {
  return `lead_id: ${deal.leadId}\ncompany: ${deal.company}\ncurrent_stage: ${deal.stage}\nest_value_usd: ${deal.estValueUsd ?? "unknown"}\nowner: ${deal.owner ?? "unassigned"}\nservice_interest: ${deal.serviceInterest ?? "unknown"}\nexisting_notes: ${deal.notes ?? "(none)"}`;
}
