import { getAnthropicClient, MODEL } from "@/lib/anthropic";
import { EXTRACTION_SYSTEM_PROMPT, buildUserMessage } from "./prompt";
import { ExtractionResultSchema, type ExtractionResult } from "./types";

/**
 * Runs the single AI extraction pass over one source event (email, meeting
 * note, or founder reply). Returns a validated ExtractionResult or throws if
 * the model's output doesn't match the expected shape - callers should catch
 * and log rather than let a bad response silently corrupt the CRM.
 */
export async function extractSignals(input: {
  sourceType: string;
  filename: string | null;
  occurredAt: string | null;
  fromWhom: string | null;
  subject: string | null;
  body: string;
  dealContext: string | null;
}): Promise<ExtractionResult> {
  const anthropic = getAnthropicClient();

  // 3000 tokens gives headroom for source events that reference many deals at
  // once (e.g. an internal pipeline-review note touching 5+ companies) - 1200
  // was enough for a typical single-deal email but truncated mid-JSON on
  // busier documents, which surfaced as a JSON parse error rather than a
  // clean "ran out of room" signal.
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserMessage(input),
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Extraction call returned no text content.");
  }

  if (message.stop_reason === "max_tokens") {
    throw new Error(
      `Extraction response was truncated at the token limit before completing - increase max_tokens further for this source event. Partial text: ${textBlock.text.slice(-300)}`
    );
  }

  const raw = extractJsonObject(textBlock.text);
  const parsed = ExtractionResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Extraction output did not match expected schema: ${parsed.error.message}\nRaw: ${textBlock.text}`
    );
  }
  return parsed.data;
}

/** The model is instructed to return only JSON, but this strips any accidental
 * wrapping (markdown fences, stray prose) defensively. */
function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Could not find a JSON object in model output: ${trimmed}`);
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}
