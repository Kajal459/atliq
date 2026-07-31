import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeCodeForTokens, getUserEmail } from "@/lib/gmail/oauth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const base = process.env.APP_BASE_URL || "http://localhost:3000";

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard/settings?gmail_error=missing_code", base));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await getUserEmail(tokens.access_token);

    if (!tokens.refresh_token) {
      // Google only sends a refresh_token on the FIRST consent, or when
      // prompt=consent forces it again (which buildAuthUrl always sets) -
      // if it's still missing something's off with the OAuth app config.
      return NextResponse.redirect(new URL("/dashboard/settings?gmail_error=no_refresh_token", base));
    }

    await prisma.gmailConnection.upsert({
      where: { emailAddress: email },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      create: {
        emailAddress: email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return NextResponse.redirect(new URL("/dashboard/settings?gmail_connected=1", base));
  } catch (err) {
    console.error("Gmail OAuth callback failed:", err);
    return NextResponse.redirect(new URL("/dashboard/settings?gmail_error=exchange_failed", base));
  }
}
