"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, expectedSessionValue, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!checkPassword(password)) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  cookies().set(SESSION_COOKIE_NAME, expectedSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days - this is a shared internal tool, not a high-security login
  });

  redirect(next || "/dashboard");
}
