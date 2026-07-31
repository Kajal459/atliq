import { prisma } from "@/lib/db";
import { refreshAccessToken } from "./oauth";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Returns a valid access token for the one shared Gmail connection,
 * refreshing it first if it's expired (Google access tokens last ~1 hour). */
export async function getValidAccessToken(): Promise<{ token: string; connectionId: string } | null> {
  const connection = await prisma.gmailConnection.findFirst({ orderBy: { createdAt: "desc" } });
  if (!connection) return null;

  if (connection.expiresAt > new Date(Date.now() + 60_000)) {
    return { token: connection.accessToken, connectionId: connection.id };
  }

  const refreshed = await refreshAccessToken(connection.refreshToken);
  await prisma.gmailConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: refreshed.access_token,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  });
  return { token: refreshed.access_token, connectionId: connection.id };
}

export interface ParsedEmail {
  id: string;
  from: string | null;
  subject: string | null;
  date: Date | null;
  body: string;
}

/** Lists message IDs newer than `afterEpochSeconds`, most Gmail queries cap
 * at 500/page which is far more than this dataset's ~25/week volume needs. */
export async function listMessageIdsSince(token: string, afterEpochSeconds: number): Promise<string[]> {
  const params = new URLSearchParams({ q: `after:${afterEpochSeconds} -in:sent -in:drafts` });
  const res = await fetch(`${GMAIL_API}/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail list failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.messages ?? []).map((m: { id: string }) => m.id);
}

export async function getMessage(token: string, id: string): Promise<ParsedEmail> {
  const res = await fetch(`${GMAIL_API}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail get message failed: ${res.status} ${await res.text()}`);
  const data = await res.json();

  const headers: { name: string; value: string }[] = data.payload?.headers ?? [];
  const getHeader = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;

  return {
    id,
    from: getHeader("From"),
    subject: getHeader("Subject"),
    date: getHeader("Date") ? new Date(getHeader("Date") as string) : null,
    body: extractPlainText(data.payload) ?? data.snippet ?? "",
  };
}

/** Gmail messages are MIME trees - walk them looking for text/plain first,
 * falling back to a crude HTML-tag strip if only text/html is present. */
function extractPlainText(payload: unknown): string | null {
  const node = payload as {
    mimeType?: string;
    body?: { data?: string };
    parts?: unknown[];
  } | undefined;
  if (!node) return null;

  if (node.mimeType === "text/plain" && node.body?.data) {
    return decodeBase64Url(node.body.data);
  }

  if (node.parts) {
    for (const part of node.parts) {
      const found = extractPlainText(part);
      if (found) return found;
    }
  }

  if (node.mimeType === "text/html" && node.body?.data) {
    return decodeBase64Url(node.body.data)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return null;
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}
