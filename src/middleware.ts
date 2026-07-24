import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export function middleware(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const expected = process.env.SESSION_SECRET;

  if (!expected || cookie !== expected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
