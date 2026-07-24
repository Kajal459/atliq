import { NextRequest, NextResponse } from "next/server";
import { refreshStaleFlags } from "@/lib/automation/stale";
import { checkDueDeferrals } from "@/lib/automation/deferral";

// Runs daily via Vercel Cron (see vercel.json). Two jobs that need to happen
// on a schedule rather than at extraction time:
//  1. Stale-flagging - re-check every open deal for 30+ days of no activity.
//  2. Deferral reach-back - fire the reminder + drafted email for any deal
//     whose next_followup_date has arrived (FR-8).
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

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    dealsFlaggedStale: staleCount,
    deferralRemindersCreated: deferralCount,
  });
}
