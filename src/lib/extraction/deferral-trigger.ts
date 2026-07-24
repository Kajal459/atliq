import { getAnthropicClient, MODEL } from "@/lib/anthropic";
import { z } from "zod";

// FR-8's actual trigger moment: a deal's next_followup_date (set from an
// approved deferral signal) has arrived. This is a separate, smaller call
// from the main single-pass extraction - costed out on its own line in the
// Cost Estimation worksheet ("Deferral trigger, ~13/month") because it does
// a different job: drafting outreach, not extracting signals.

const DeferralTriggerSchema = z.object({
  draft_email: z.string().describe("A short, ready-to-edit email picking the conversation back up, referencing what the client actually said"),
  recommended_action: z.string().describe("One line telling the owner what to do beyond just sending the email, if anything"),
});

export type DeferralTrigger = z.infer<typeof DeferralTriggerSchema>;

const SYSTEM_PROMPT = `You draft a single reach-back email for AtliQ, a small consultancy, when a client-stated "check back later" date has arrived. You will be given the deal's context and the original quote where the client asked to be revisited. Write a short, warm, professional draft email picking the conversation back up - reference the specific reason they gave for waiting, don't invent new details. Also give one line of recommended next action for the deal owner beyond sending the email (e.g. "confirm budget is unfrozen before re-quoting" or "check if their board met as planned"). The founder will edit and send this themselves - you are never sending anything.

Respond with a single JSON object and nothing else:
{
  "draft_email": string,
  "recommended_action": string
}`;

export async function generateDeferralTrigger(params: {
  company: string;
  contactName: string | null;
  serviceInterest: string | null;
  owner: string | null;
  originalQuote: string;
}): Promise<DeferralTrigger> {
  const anthropic = getAnthropicClient();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 750,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `COMPANY: ${params.company}
CONTACT: ${params.contactName ?? "unknown"}
SERVICE INTEREST: ${params.serviceInterest ?? "unknown"}
DEAL OWNER: ${params.owner ?? "unassigned"}

ORIGINAL QUOTE (why they asked to be revisited):
"""
${params.originalQuote}
"""`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Deferral trigger call returned no text content.");
  }

  const trimmed = textBlock.text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`Could not find a JSON object in deferral trigger output: ${trimmed}`);
  }
  const raw = JSON.parse(trimmed.slice(start, end + 1));
  return DeferralTriggerSchema.parse(raw);
}
