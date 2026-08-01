import { NextResponse } from "next/server";

// Gmail connector removed - see src/lib/gmail/oauth.ts for why and for the
// rm -rf that fully cleans this up. Left as a 410 rather than a 404 so it's
// clear this endpoint existed on purpose and was retired, not missing.
export async function GET() {
  return NextResponse.json({ error: "The Gmail connector has been removed." }, { status: 410 });
}
