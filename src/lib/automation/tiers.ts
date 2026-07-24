import type { ExtractedSignal } from "@/lib/extraction/types";

// The three-tier automation model, straight from the PRD / architecture doc:
//   auto_apply         - deterministic, low-risk: owner assignment on a blank
//                         field, merging confirmed duplicates, forward stage
//                         progression with clear evidence. Written with an
//                         audit trail, no approval wait.
//   approval_required   - anything that changes deal content, drafts
//                         client-facing text, or makes a judgment call: new
//                         leads, deadlines, negotiation flags, cross-sell,
//                         disqualification, drafted follow-ups, any move to
//                         Won/Lost.
//   needs_review        - backward stage movement only: never auto-applied,
//                         never forced into an approval decision either, just
//                         surfaced on the digest.

export type Tier = "auto_apply" | "approval_required" | "needs_review";

export const STAGE_ORDER = [
  "New",
  "Contacted",
  "Qualified",
  "ProposalSent",
  "Negotiation",
  "ComplianceProcurement",
  "VerbalAgreement",
] as const;

export function stageRank(stage: string): number {
  const idx = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  return idx === -1 ? -1 : idx;
}

/**
 * Decides which tier an extracted signal belongs to. `currentStage` is the
 * deal's stage before this signal, only relevant for stage_change signals.
 */
export function decideTier(signal: ExtractedSignal, currentStage?: string | null): Tier {
  switch (signal.type) {
    case "stage_change": {
      const proposed = signal.proposed_value ?? "";
      // Any move to Won or Lost always requires explicit approval - every
      // report and metric depends on this field, so a wrong auto-close is
      // the one error that can't be silent (FR-4).
      if (proposed === "Won" || proposed === "Lost") {
        return "approval_required";
      }
      if (!currentStage) {
        return "approval_required";
      }
      const from = stageRank(currentStage);
      const to = stageRank(proposed);
      if (from === -1 || to === -1) {
        // Unrecognized stage label - don't guess, let a founder confirm.
        return "approval_required";
      }
      // Forward progression with clear textual evidence: auto-apply (FR-4).
      // Backward movement: never auto-applied, never forces approval either.
      return to > from ? "auto_apply" : "needs_review";
    }

    case "new_lead":
    case "deadline":
    case "negotiation_flag":
    case "deferral":
    case "cross_sell":
    case "disqualification":
      return "approval_required";

    default:
      return "approval_required";
  }
}

/** Owner-assignment and duplicate-merge decisions aren't produced by the LLM
 * extraction call - they're deterministic logic run separately (see
 * src/lib/automation/apply.ts) - but they share the same tier vocabulary. */
export const DETERMINISTIC_AUTO_APPLY_ACTIONS = [
  "owner_assignment",
  "duplicate_merge",
] as const;

// FR-12: a lead introduced by a referral partner (who already understands
// AtliQ's typical scope and budget) lands directly in "Qualified", skipping
// the "New" stage that a cold/unknown-channel lead needs. Matched loosely
// against whatever channel string the extraction call reported.
const REFERRAL_LIKE_SOURCE_KEYWORDS = ["referral", "channel partner", "partner"];

export function initialStageForSource(source: string | null): "New" | "Qualified" {
  if (!source) return "New";
  const lower = source.toLowerCase();
  return REFERRAL_LIKE_SOURCE_KEYWORDS.some((kw) => lower.includes(kw)) ? "Qualified" : "New";
}
