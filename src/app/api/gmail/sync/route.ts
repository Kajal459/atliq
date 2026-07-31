import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, expectedSessionValue } from "@/lib/auth/session";
import { syncGmailInbox } from "@/lib/gmail/sync";

export async function POST() {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  try {
    if (cookie !== expectedSessionValue()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "SESSION_SECRET not configured" }, { status: 500 });
  }

  try {
    const result = await syncGmailInbox();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Manual Gmail sync failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
