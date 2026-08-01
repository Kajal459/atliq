import { NextResponse } from "next/server";

// Gmail connector removed - see src/lib/gmail/oauth.ts for why and for the
// rm -rf that fully cleans this up.
export async function POST() {
  return NextResponse.json({ error: "The Gmail connector has been removed." }, { status: 410 });
}
