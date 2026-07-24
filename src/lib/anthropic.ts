import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** Lazily-constructed singleton so the app doesn't crash at import time if the key is missing - it only fails when an extraction call is actually attempted. */
export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.example)."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
