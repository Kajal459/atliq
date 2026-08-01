import { NextRequest, NextResponse } from "next/server";
import { refreshStaleFlags } from "@/lib/automation/stale";
import { checkDueDeferrals } from "@/lib/automation/deferral";
import { sendDailyDigestEmail } from "@/lib/email/digest-email";
import { isDailyDigestEnabled } from "@/lib/digest/recipients";

// Runs daily via Vercel Cron (see vercel.json). Jobs that need to happen on a
// schedule rather than at extraction time:
//  1. Stale-flagging - re-check every open deal for 30+ days of no activity.
//  2. Deferral reach-back - fire the reminder + drafted email for any deal
//     whose next_followup_date has arrived (FR-8).
//  3. Daily digest email - pushed via Resend (RESEND_API_KEY) to whoever is
//     added as a recipient in Settings, unless the "send automatically"
//     toggle there has been switched off.
// Vercel Cron calls this with an Authorization header matching CRON_SECRET;
// anyone else hitting this URL gets rejected so it can't be triggered or
// scraped by an outside party.

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const staleCount = await refreshStaleFlags();
  const deferralCount = await checkDueDeferrals();

  let digestEmailsSent = 0;
  let digestError: string | null = null;
  let digestSkipped = false;

  if (await isDailyDigestEnabled()) {
    try {
      const digestResult = await sendDailyDigestEmail();
      digestEmailsSent = digestResult.sent;
    } catch (err) {
      // Don't let a missing RESEND_API_KEY or a bad recipient fail the whole
      // cron run - stale-flagging and deferrals still matter even if email
      // isn't configured yet.
      digestError = err instanceof Error ? err.message : "unknown error";
    }
  } else {
    digestSkipped = true;
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    dealsFlaggedStale: staleCount,
    deferralRemindersCreated: deferralCount,
    digestEmailsSent,
    digestSkipped,
    ...(digestError ? { digestError } : {}),
  });
}
