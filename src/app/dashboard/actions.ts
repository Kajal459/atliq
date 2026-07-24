"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function signOut() {
  cookies().delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
