import crypto from "node:crypto";

// Signs a compact token so a digest email's "Approve"/"Reject" links can
// resolve a signal without the clicker having an active browser session -
// email clients don't carry cookies. HMAC-signed and time-limited so a
// forwarded or leaked email can't be used indefinitely.

const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export interface QuickActionPayload {
  signalId: string;
  action: "approve" | "reject";
  actor: string;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set.");
  return s;
}

export function signQuickAction(payload: QuickActionPayload): string {
  const body = JSON.stringify({ ...payload, exp: Date.now() + TOKEN_TTL_MS });
  const encoded = Buffer.from(body).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyQuickAction(token: string): QuickActionPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expectedSignature = crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return { signalId: parsed.signalId, action: parsed.action, actor: parsed.actor };
  } catch {
    return null;
  }
}
