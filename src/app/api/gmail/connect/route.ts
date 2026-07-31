import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, expectedSessionValue } from "@/lib/auth/session";
import { buildAuthUrl } from "@/lib/gmail/oauth";

export async function GET() {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  try {
    if (cookie !== expectedSessionValue()) {
      return NextResponse.redirect(new URL("/login", process.env.APP_BASE_URL || "http://localhost:3000"));
    }
  } catch {
    return NextResponse.json({ error: "SESSION_SECRET not configured" }, { status: 500 });
  }

  return NextResponse.redirect(buildAuthUrl());
}
