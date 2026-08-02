import { getAnthropicClient, MODEL } from "@/lib/anthropic";

// The "AtliQ AI" chat launcher's only AI call - answers a founder's
// free-text question about one specific deal. Deliberately narrow (one deal,
// grounded in its own CRM record + activity + approvals + audit history)
// rather than an open-ended pipeline chatbot, so every answer stays
// checkable against the same source data the rest of the app already shows.

const SYSTEM_PROMPT = `You answer a founder's question about one AtliQ sales deal, using only the facts given below - the CRM record, recent activity, pending approvals, and audit history. Never invent a status, date, or next step that isn't supported by what's given; if the context doesn't contain enough to answer the question, say so plainly instead of guessing.

Answer in 1-4 short sentences of plain conversational text. No markdown, no headers, no bullet points.`;

export async function answerDealQuestion(params: {
  question: string;
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
  const anthropic = getAnthropicClient();

  const userMessage = `DEAL: ${params.company}
STAGE: ${params.stage}
OWNER: ${params.owner ?? "unassigned"}
VALUE: ${params.estValueUsd != null ? `$${params.estValueUsd.toLocaleString()}` : "unknown"}
NEXT FOLLOW-UP: ${params.nextFollowupDate ?? "none set"}
STALE: ${params.stale ? "yes - 30+ days no activity" : "no"}

RECENT ACTIVITY:
${params.recentActivity.length ? params.recentActivity.map((a) => `- ${a}`).join("\n") : "(none recorded)"}

PENDING APPROVALS:
${params.pendingApprovals.length ? params.pendingApprovals.map((a) => `- ${a}`).join("\n") : "(none)"}

NEEDS REVIEW:
${params.needsReviewItems.length ? params.needsReviewItems.map((a) => `- ${a}`).join("\n") : "(none)"}

QUESTION: ${params.question}`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Assistant call returned no text content.");
  }
  return textBlock.text.trim();
}
