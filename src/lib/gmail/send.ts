import { getValidAccessToken } from "./client";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Sends via the one connected Gmail account's send scope - reuses the same
 * OAuth connection as the inbox watcher, so there's only one integration to
 * set up for both directions (per Karandeep's "keep it light" guidance). */
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const auth = await getValidAccessToken();
  if (!auth) throw new Error("No Gmail connection configured - connect Gmail in Settings first.");

  const raw = buildRawMessage(params);
  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    throw new Error(`Gmail send failed: ${res.status} ${await res.text()}`);
  }
}

function buildRawMessage(params: { to: string; subject: string; html: string }): string {
  const message = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    params.html,
  ].join("\r\n");
  return Buffer.from(message).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
