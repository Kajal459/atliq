// Outbound email via Resend - a plain API-key call, no OAuth consent screen
// or Google Cloud project needed. Replaces the Gmail-OAuth-based sender for
// the daily digest/reminder emails now that the Gmail connector is shelved;
// reading email still isn't needed for this path at all, only sending is.
//
// Setup: set RESEND_API_KEY (from resend.com) and, once a sending domain is
// verified there, RESEND_FROM_EMAIL (e.g. "AtliQ <digest@yourdomain.com>").
// Until a domain is verified, Resend's shared "onboarding@resend.dev" sender
// only delivers to the account owner's own verified email - fine for local
// testing with one recipient, not for the full DIGEST_RECIPIENTS list.

const RESEND_API = "https://api.resend.com/emails";

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set - add it to .env.local to send email via Resend.");

  const from = process.env.RESEND_FROM_EMAIL || "AtliQ <onboarding@resend.dev>";

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
}
