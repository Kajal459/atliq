import { getAnthropicClient, MODEL } from "@/lib/anthropic";

// Estimates how likely a deal is to close Won, grounded only in its own
// recorded history - every email/meeting-note/quick-capture event and every
// audit-logged action, in order. Same guardrail as the rest of the app's AI
// calls: no facts outside what's given, and say so plainly if the record is
// too thin to judge rather than inventing confidence.

const SYSTEM_PROMPT = `You estimate how likely an AtliQ sales deal is to close as Won, using only the facts given below - the CRM record and the full chronological timeline of events and actions on this deal. Base the score only on concrete evidence in that record: momentum (recent activity vs. silence), buyer engagement signals (questions asked, urgency expressed, budget or timeline confirmed), stalled or repeatedly-deferred follow-ups, negotiation or compliance blockers, and how long the deal has sat in its current stage. Do not invent facts that aren't in the timeline. If the record is too thin to judge confidently, say so and give a score near 50.

Respond with exactly two lines, nothing else:
SCORE: <a whole number from 0 to 100>
WHY: <one or two plain sentences citing the specific evidence that drove the score>`;

export async function scoreDealSuccess(params: {
  company: string;
  stage: string;
  estValueUsd: number | null;
  stale: boolean;
  nextFollowupDate: string | null;
  timeline: string[];
}): Promise<{ score: number; rationale: string }> {
  const anthropic = getAnthropicClient();

  const userMessage = `DEAL: ${params.company}
STAGE: ${params.stage}
VALUE: ${params.estValueUsd != null ? `$${params.estValueUsd.toLocaleString()}` : "unknown"}
STALE: ${params.stale ? "yes - 30+ days no activity" : "no"}
NEXT FOLLOW-UP: ${params.nextFollowupDate ?? "none set"}

TIMELINE (chronological):
${params.timeline.length ? params.timeline.map((t) => `- ${t}`).join("\n") : "(no recorded activity)"}`;

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Success-score call returned no text content.");
  }
  const text = textBlock.text.trim();
  const scoreMatch = text.match(/SCORE:\s*(\d{1,3})/i);
  const whyMatch = text.match(/WHY:\s*([\s\S]*)/i);
  const score = scoreMatch ? Math.max(0, Math.min(100, parseInt(scoreMatch[1], 10))) : 50;
  const rationale = whyMatch ? whyMatch[1].trim() : text;
  return { score, rationale };
}
