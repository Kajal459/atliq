import { getAnthropicClient, MODEL } from "@/lib/anthropic";

// Directly answers Dhaval's own story on the follow-up Q&A call: before any
// trip, he'd sit with Bhavin and manually build a handover brief. This
// generates that brief on demand instead - either for one deal, or across
// the whole open pipeline - so nobody has to remember to do it before
// disappearing for two days.

const DEAL_BRIEF_SYSTEM_PROMPT = `You write a short handoff brief for one AtliQ sales deal, for a founder who is about to be unavailable and needs someone else to be able to pick this up cold. Use only the facts given - CRM record, recent email/note activity, pending approvals, and recent audit history. Do not invent status, dates, or next steps that aren't supported by what's given.

Structure the brief in this order, plain text, no markdown headers, short paragraphs:
1. Where things stand right now (stage, value, owner, last real activity).
2. What's pending or waiting on someone (approvals, deadlines, open questions).
3. Anything flagged as needing review or looking stale.
4. The single most useful next action for whoever picks this up.

Keep it under 200 words. Write for someone with zero context on this deal.`;

const PIPELINE_BRIEF_SYSTEM_PROMPT = `You write a short handoff brief across an entire open sales pipeline, for a founder who is about to be unavailable (a trip, an emergency) and wants their co-founder or colleague to be able to cover for them without a verbal handover. Use only the summary data given - do not invent specifics about any individual deal beyond what's provided.

Structure the brief in this order, plain text, no markdown headers, short paragraphs:
1. The overall picture - how many deals are open, how much value is at risk right now, and why (process failure, not fit or budget).
2. The 3-5 deals that most need a human decision this week, named specifically, with the one-line reason each is on the list.
3. Anything sitting in the approval queue that shouldn't wait.
4. A closing line on what "good" looks like by the time the founder is back.

Keep it under 250 words. Write for someone with zero context on this pipeline.`;

async function callClaude(system: string, userMessage: string): Promise<string> {
  const anthropic = getAnthropicClient();
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 700,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Handoff brief call returned no text content.");
  }
  return textBlock.text.trim();
}

export async function generateDealHandoffBrief(params: {
  company: string;
  stage: string;
  owner: string | null;
  estValueUsd: number | null;
  nextFollowupDate: string | null;
  stale: boolean;
  recentActivity: string[];
  pendingApprovals: string[];
  needsReviewItems: string[];
}): Promise<string> {
  const userMessage = `DEAL: ${params.company}
STAGE: ${params.stage}
OWNER: ${params.owner ?? "unassigned"}
VALUE: ${params.estValueUsd != null ? `$${params.estValueUsd.toLocaleString()}` : "unknown"}
NEXT FOLLOW-UP: ${params.nextFollowupDate ?? "none set"}
STALE: ${params.stale ? "yes - 30+ days no activity" : "no"}

RECENT ACTIVITY (most recent first):
${params.recentActivity.length ? params.recentActivity.map((a) => `- ${a}`).join("\n") : "(none recorded)"}

PENDING APPROVALS:
${params.pendingApprovals.length ? params.pendingApprovals.map((a) => `- ${a}`).join("\n") : "(none)"}

NEEDS REVIEW:
${params.needsReviewItems.length ? params.needsReviewItems.map((a) => `- ${a}`).join("\n") : "(none)"}`;

  return callClaude(DEAL_BRIEF_SYSTEM_PROMPT, userMessage);
}

export async function generatePipelineHandoffBrief(params: {
  openDealCount: number;
  atRiskValueUsd: number;
  atRiskDealCount: number;
  topPriorityDeals: string[];
  pendingApprovalCount: number;
  pendingApprovalHighlights: string[];
}): Promise<string> {
  const userMessage = `OPEN DEALS: ${params.openDealCount}
VALUE AT RISK THIS WEEK: $${params.atRiskValueUsd.toLocaleString()} across ${params.atRiskDealCount} deal(s)
PENDING APPROVALS WAITING: ${params.pendingApprovalCount}

TOP PRIORITY DEALS THIS WEEK:
${params.topPriorityDeals.length ? params.topPriorityDeals.map((d) => `- ${d}`).join("\n") : "(none flagged)"}

NOTABLE PENDING APPROVALS:
${params.pendingApprovalHighlights.length ? params.pendingApprovalHighlights.map((d) => `- ${d}`).join("\n") : "(none)"}`;

  return callClaude(PIPELINE_BRIEF_SYSTEM_PROMPT, userMessage);
}
